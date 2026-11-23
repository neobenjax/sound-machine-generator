import type { OscillatorShape, SoundLayer, SoundRecipe } from './types';

export interface AudioAnalysisSummary {
  durationMs: number;
  startHz: number;
  endHz: number;
  clarity: number;
  zeroCrossingRate: number;
  detectedCharacter: 'tonal' | 'hybrid' | 'percussive-noise';
  layerCount: number;
}

export function decodeBase64ToArrayBuffer(base64OrDataUrl: string): ArrayBuffer {
  const commaIdx = base64OrDataUrl.indexOf(',');
  const cleanB64 = commaIdx >= 0 ? base64OrDataUrl.slice(commaIdx + 1) : base64OrDataUrl;
  const binary = atob(cleanB64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function decodeAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (OfflineCtx) {
    const ctx = new OfflineCtx(1, 44100, 44100);
    return ctx.decodeAudioData(arrayBuffer.slice(0));
  }
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close();
  }
}

export function mixAudioBufferToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const mono = new Float32Array(length);
  const channels = buffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channels;
    }
  }
  return mono;
}

function estimatePitchAutocorrelation(
  frame: Float32Array,
  sampleRate: number
): { hz: number; clarity: number } {
  const minLag = Math.max(2, Math.floor(sampleRate / 2800));
  const maxLag = Math.min(Math.floor(frame.length / 2), Math.floor(sampleRate / 45));
  if (maxLag <= minLag) return { hz: 220, clarity: 0 };

  let rms = 0;
  for (let i = 0; i < frame.length; i++) {
    rms += frame[i] * frame[i];
  }
  rms = Math.sqrt(rms / frame.length);
  if (rms < 0.005) return { hz: 220, clarity: 0 };

  let bestLag = minLag;
  let bestCorr = -1;
  let zeroLagEnergy = 0;
  for (let i = 0; i < frame.length - maxLag; i++) {
    zeroLagEnergy += frame[i] * frame[i];
  }
  if (zeroLagEnergy <= 1e-9) return { hz: 220, clarity: 0 };

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let lagEnergy = 0;
    const limit = frame.length - lag;
    for (let i = 0; i < limit; i++) {
      corr += frame[i] * frame[i + lag];
      lagEnergy += frame[i + lag] * frame[i + lag];
    }
    const denom = Math.sqrt(zeroLagEnergy * Math.max(1e-9, lagEnergy));
    const norm = corr / denom;
    if (norm > bestCorr) {
      bestCorr = norm;
      bestLag = lag;
    }
  }

  const hz = Math.max(40, Math.min(3500, sampleRate / bestLag));
  return { hz, clarity: Math.max(0, Math.min(1, bestCorr)) };
}

function computeZeroCrossingRate(frame: Float32Array): number {
  if (frame.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i - 1] >= 0 && frame[i] < 0) || (frame[i - 1] < 0 && frame[i] >= 0)) {
      crossings++;
    }
  }
  return crossings / (frame.length - 1);
}

function guessOscillatorShape(frame: Float32Array): OscillatorShape {
  // Estimate crest factor (peak / rms) to distinguish sine (~1.41), square (~1.0), saw/triangle (~1.73)
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < frame.length; i++) {
    const abs = Math.abs(frame[i]);
    if (abs > peak) peak = abs;
    sumSq += frame[i] * frame[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, frame.length));
  const crest = peak / Math.max(1e-6, rms);
  if (crest < 1.25) return 'square';
  if (crest < 1.52) return 'sine';
  if (crest < 1.85) return 'triangle';
  return 'sawtooth';
}

export function analyzePcmToSoundRecipe(
  samples: Float32Array,
  sampleRate: number,
  name = 'Decoded Sample'
): { recipe: SoundRecipe; analysis: AudioAnalysisSummary } {
  let globalPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > globalPeak) globalPeak = abs;
  }

  const threshold = Math.max(0.005, globalPeak * 0.025);
  let startIdx = 0;
  let endIdx = samples.length - 1;
  while (startIdx < endIdx && Math.abs(samples[startIdx]) < threshold) startIdx++;
  while (endIdx > startIdx && Math.abs(samples[endIdx]) < threshold) endIdx--;

  // Cap analysis window to 4 seconds for SFX/monophonic tones
  const maxSamples = Math.min(endIdx - startIdx + 1, Math.floor(sampleRate * 4));
  const active = samples.slice(startIdx, startIdx + Math.max(256, maxSamples));
  const durationMs = Math.max(30, Math.min(4000, Math.round((active.length / sampleRate) * 1000)));

  // Envelope tracking across 20ms frames
  const frameSize = Math.max(256, Math.min(2048, Math.floor(sampleRate * 0.025)));
  const hop = Math.max(128, Math.floor(frameSize / 2));
  const envFrames: number[] = [];
  for (let pos = 0; pos + frameSize <= active.length; pos += hop) {
    let sq = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = active[pos + i];
      sq += s * s;
    }
    envFrames.push(Math.sqrt(sq / frameSize));
  }
  if (envFrames.length === 0) envFrames.push(globalPeak);

  let peakFrameIdx = 0;
  let peakRms = 0;
  envFrames.forEach((v, idx) => {
    if (v > peakRms) {
      peakRms = v;
      peakFrameIdx = idx;
    }
  });

  const frameMs = (hop / sampleRate) * 1000;
  const attackSec = Math.max(0.002, Math.min(1.5, ((peakFrameIdx + 0.5) * frameMs) / 1000));
  const tailFrames = Math.max(1, envFrames.length - peakFrameIdx);
  const midTailVal = envFrames[Math.min(envFrames.length - 1, peakFrameIdx + Math.floor(tailFrames * 0.5))];
  const sustain = Math.max(0.0, Math.min(0.9, midTailVal / Math.max(1e-6, peakRms)));
  const decaySec = Math.max(0.015, Math.min(2.0, (tailFrames * 0.55 * frameMs) / 1000));
  const releaseSec = Math.max(0.02, Math.min(1.8, (tailFrames * 0.45 * frameMs) / 1000));

  // Pitch & ZCR on early, middle, and late slices
  const windowLen = Math.min(active.length, Math.max(1024, Math.floor(sampleRate * 0.045)));
  const earlySlice = active.slice(0, windowLen);
  const lateStart = Math.max(0, active.length - windowLen);
  const lateSlice = active.slice(lateStart, lateStart + windowLen);

  const earlyPitch = estimatePitchAutocorrelation(earlySlice, sampleRate);
  const latePitch = estimatePitchAutocorrelation(lateSlice, sampleRate);
  const avgClarity = (earlyPitch.clarity + latePitch.clarity) / 2;
  const zcr = computeZeroCrossingRate(earlySlice);
  const oscShape = guessOscillatorShape(earlySlice);

  const startHz = Math.round(earlyPitch.hz);
  const endHz = Math.round(latePitch.clarity > 0.35 ? latePitch.hz : earlyPitch.hz);
  const pitchCurve = Math.abs(endHz - startHz) > startHz * 0.15 ? 'exponential' : 'linear';

  const layers: SoundLayer[] = [];
  let detectedCharacter: AudioAnalysisSummary['detectedCharacter'] = 'tonal';

  if (avgClarity >= 0.4) {
    layers.push({
      id: `wav-tone-${Date.now()}`,
      name: 'Decoded Tone',
      enabled: true,
      solo: false,
      type: zcr > 0.18 && oscShape === 'sawtooth' ? 'fm' : 'tone',
      oscillatorType: oscShape,
      noiseType: 'white',
      delayMs: 0,
      durationMs,
      frequency: startHz,
      frequencyEnd: endHz,
      pitchCurve,
      harmonicity: 2,
      modulationIndex: 3.2,
      fmDecayMs: Math.min(220, Math.round(durationMs * 0.4)),
      unisonVoices: 1,
      detuneCents: 0,
      envelope: {
        attack: Number(attackSec.toFixed(3)),
        decay: Number(decaySec.toFixed(3)),
        sustain: Number(sustain.toFixed(2)),
        release: Number(releaseSec.toFixed(3)),
      },
      filter: {
        type: 'lowpass',
        frequency: Math.min(16000, Math.max(800, startHz * 4)),
        frequencyEnd: Math.min(16000, Math.max(400, endHz * 2.2)),
        Q: 1.2,
      },
      gain: 0.78,
      pan: 0,
    });

    if (zcr > 0.25) {
      detectedCharacter = 'hybrid';
      layers.push({
        id: `wav-transient-${Date.now() + 1}`,
        name: 'Decoded Transient',
        enabled: true,
        solo: false,
        type: 'noise',
        oscillatorType: 'triangle',
        noiseType: zcr > 0.42 ? 'white' : 'pink',
        delayMs: 0,
        durationMs: Math.min(140, Math.round(durationMs * 0.35)),
        frequency: 1200,
        frequencyEnd: 600,
        pitchCurve: 'exponential',
        harmonicity: 2,
        modulationIndex: 2,
        envelope: {
          attack: 0.002,
          decay: 0.06,
          sustain: 0.0,
          release: 0.04,
        },
        filter: {
          type: 'bandpass',
          frequency: Math.min(9000, Math.max(600, Math.round(zcr * sampleRate * 0.5))),
          frequencyEnd: 1200,
          Q: 1.4,
        },
        gain: 0.38,
        pan: 0,
      });
    }
  } else {
    detectedCharacter = 'percussive-noise';
    const noiseType = zcr > 0.38 ? 'white' : zcr > 0.18 ? 'pink' : 'brown';
    layers.push({
      id: `wav-noise-${Date.now()}`,
      name: 'Decoded Noise',
      enabled: true,
      solo: false,
      type: 'noise',
      oscillatorType: 'triangle',
      noiseType,
      delayMs: 0,
      durationMs,
      frequency: 800,
      frequencyEnd: 300,
      pitchCurve: 'exponential',
      harmonicity: 2,
      modulationIndex: 2,
      envelope: {
        attack: Number(attackSec.toFixed(3)),
        decay: Number(decaySec.toFixed(3)),
        sustain: Number(sustain.toFixed(2)),
        release: Number(releaseSec.toFixed(3)),
      },
      filter: {
        type: 'bandpass',
        frequency: Math.min(12000, Math.max(300, Math.round(zcr * sampleRate * 0.45))),
        frequencyEnd: 600,
        Q: 1.1,
      },
      gain: 0.8,
      pan: 0,
    });
  }

  const recipe: SoundRecipe = {
    id: `wav-decoded-${Date.now()}`,
    name,
    playlistId: 'custom',
    description: `Decoded from .wav audio (${durationMs}ms, ${detectedCharacter}, ${startHz}Hz → ${endHz}Hz).`,
    tags: ['wav-decoded', detectedCharacter],
    masterVolumeDb: -2,
    reverbMix: 0,
    reverbDecaySec: 0.5,
    layers,
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  return {
    recipe,
    analysis: {
      durationMs,
      startHz,
      endHz,
      clarity: Number(avgClarity.toFixed(2)),
      zeroCrossingRate: Number(zcr.toFixed(2)),
      detectedCharacter,
      layerCount: layers.length,
    },
  };
}

export async function analyzeAudioArrayBufferToRecipe(
  arrayBuffer: ArrayBuffer,
  name = 'Decoded Sample'
): Promise<{ recipe: SoundRecipe; analysis: AudioAnalysisSummary }> {
  const audioBuffer = await decodeAudioBuffer(arrayBuffer);
  const mono = mixAudioBufferToMono(audioBuffer);
  return analyzePcmToSoundRecipe(mono, audioBuffer.sampleRate, name);
}
