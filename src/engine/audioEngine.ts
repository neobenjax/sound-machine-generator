import * as Tone from 'tone';
import type { SoundLayer, SoundRecipe } from './types';

function createStereoImpulseBuffer(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const clampedDecay = Math.max(0.1, Math.min(3.0, decaySec));
  const length = Math.max(1, Math.floor(ctx.sampleRate * clampedDecay));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      // Exponential decay with soft high-frequency damping for warm app chimes
      const env = Math.pow(1 - progress, 2.4) * Math.exp(-2.2 * progress);
      const white = Math.random() * 2 - 1;
      smooth = smooth * 0.48 + white * 0.52;
      data[i] = smooth * env * 0.65;
    }
  }
  return buffer;
}

class SoundEngine {
  private analyser: Tone.Analyser | null = null;
  private masterGain: Tone.Gain | null = null;
  private reverbWetGain: Tone.Gain | null = null;
  private convolver: Tone.Convolver | null = null;
  private lastReverbDecayKey = -1;
  private activeDisposables: Set<{ dispose: () => void }> = new Set();
  private isUnlocked = false;

  public async unlock(): Promise<boolean> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    this.ensureMasterChain();
    this.isUnlocked = Tone.getContext().state === 'running';
    return this.isUnlocked;
  }

  public getAudioState(): AudioContextState {
    return Tone.getContext().state;
  }

  private ensureMasterChain(): void {
    if (!this.masterGain) {
      this.masterGain = new Tone.Gain(1);
      const compressor = new Tone.Compressor({
        threshold: -14,
        ratio: 3.5,
        attack: 0.004,
        release: 0.12,
      });
      const limiter = new Tone.Limiter(-1).toDestination();
      this.analyser = new Tone.Analyser('waveform', 256);

      // Dry path -> compressor -> limiter + analyser
      this.masterGain.connect(compressor);

      // Wet procedural stereo reverb send -> compressor
      const rawCtx = Tone.getContext().rawContext;
      const initialIr = createStereoImpulseBuffer(rawCtx, 0.65);
      this.lastReverbDecayKey = 0.65;
      this.convolver = new Tone.Convolver(initialIr);
      this.reverbWetGain = new Tone.Gain(0);
      this.masterGain.connect(this.reverbWetGain);
      this.reverbWetGain.connect(this.convolver);
      this.convolver.connect(compressor);

      compressor.connect(this.analyser);
      compressor.connect(limiter);
    }
  }

  private updateReverb(reverbMix: number, reverbDecaySec: number): void {
    if (!this.reverbWetGain || !this.convolver) return;

    const clampedMix = Math.max(0, Math.min(0.6, reverbMix));
    this.reverbWetGain.gain.rampTo(clampedMix, 0.01);

    if (clampedMix > 0) {
      const quantizedDecay = Math.round(Math.max(0.15, Math.min(2.5, reverbDecaySec)) * 20) / 20;
      if (Math.abs(quantizedDecay - this.lastReverbDecayKey) >= 0.04) {
        const rawCtx = Tone.getContext().rawContext;
        this.convolver.buffer = new Tone.ToneAudioBuffer(
          createStereoImpulseBuffer(rawCtx, quantizedDecay)
        );
        this.lastReverbDecayKey = quantizedDecay;
      }
    }
  }

  public getWaveformData(): Float32Array {
    if (!this.analyser) {
      return new Float32Array(256);
    }
    const val = this.analyser.getValue();
    return val instanceof Float32Array ? val : new Float32Array(256);
  }

  public stopAll(): void {
    for (const node of this.activeDisposables) {
      try {
        node.dispose();
      } catch {
        // Ignore already-disposed nodes
      }
    }
    this.activeDisposables.clear();
  }

  public async playRecipe(recipe: SoundRecipe, masterVolumeOverrideDb?: number): Promise<number> {
    await this.unlock();
    this.ensureMasterChain();

    const masterDb = masterVolumeOverrideDb ?? recipe.masterVolumeDb;
    if (this.masterGain) {
      this.masterGain.gain.rampTo(Tone.dbToGain(masterDb), 0.01);
    }

    const reverbMix = recipe.reverbMix ?? 0;
    const reverbDecaySec = recipe.reverbDecaySec ?? 0.65;
    this.updateReverb(reverbMix, reverbDecaySec);

    const hasSolo = recipe.layers.some((l) => l.enabled && l.solo);
    const activeLayers = recipe.layers.filter((l) => l.enabled && (!hasSolo || l.solo));

    if (activeLayers.length === 0) {
      return 0;
    }

    const baseTime = Tone.now() + 0.015;
    let maxEndMs = 0;

    for (const layer of activeLayers) {
      this.scheduleLayer(layer, baseTime, reverbMix > 0 ? reverbDecaySec : 0);
      const tailMs =
        layer.delayMs +
        layer.durationMs +
        (layer.envelope.attack + layer.envelope.decay + layer.envelope.release) * 1000;
      if (tailMs > maxEndMs) {
        maxEndMs = tailMs;
      }
    }

    return maxEndMs + (reverbMix > 0 ? reverbDecaySec * 400 : 0);
  }

  private scheduleLayer(layer: SoundLayer, baseTime: number, extraReverbSec: number): void {
    if (!this.masterGain) return;

    const startTime = baseTime + layer.delayMs / 1000;
    const durationSec = Math.max(0.005, layer.durationMs / 1000);
    const { attack, decay, sustain, release } = layer.envelope;

    const voices =
      layer.type === 'noise' ? 1 : Math.min(3, Math.max(1, Math.round(layer.unisonVoices ?? 1)));
    const detuneSpread = Math.max(0, layer.detuneCents ?? 0);
    const cleanupNodes: Array<{ dispose: () => void }> = [];

    for (let v = 0; v < voices; v++) {
      const offsetRatio = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;
      const detuneCents = offsetRatio * detuneSpread;
      const voicePan = Math.max(-1, Math.min(1, layer.pan + (voices > 1 ? offsetRatio * 0.22 : 0)));
      const voiceGain = layer.gain / Math.sqrt(voices);

      const panner = new Tone.Panner(voicePan).connect(this.masterGain);
      const layerGain = new Tone.Gain(voiceGain).connect(panner);
      const filter = new Tone.Filter({
        type: layer.filter.type,
        frequency: Math.max(20, layer.filter.frequency),
        Q: Math.max(0.1, layer.filter.Q),
      }).connect(layerGain);

      // Filter frequency sweep
      const endFilterFreq = Math.max(20, layer.filter.frequencyEnd);
      if (Math.abs(endFilterFreq - layer.filter.frequency) > 1) {
        filter.frequency.setValueAtTime(Math.max(20, layer.filter.frequency), startTime);
        filter.frequency.exponentialRampToValueAtTime(endFilterFreq, startTime + durationSec);
      }

      cleanupNodes.push(panner, layerGain, filter);

      if (layer.type === 'noise') {
        const env = new Tone.AmplitudeEnvelope({
          attack: Math.max(0.001, attack),
          decay: Math.max(0.005, decay),
          sustain: Math.min(1, Math.max(0, sustain)),
          release: Math.max(0.005, release),
        }).connect(filter);

        const noise = new Tone.Noise(layer.noiseType).connect(env);
        noise.start(startTime);
        env.triggerAttackRelease(durationSec, startTime);
        noise.stop(startTime + durationSec + release + 0.05);

        cleanupNodes.push(env, noise);
      } else if (layer.type === 'fm') {
        const modDecaySec =
          layer.fmDecayMs !== undefined ? Math.max(0.005, layer.fmDecayMs / 1000) : 0.12;
        const synth = new Tone.FMSynth({
          harmonicity: Math.max(0.1, layer.harmonicity),
          modulationIndex: Math.max(0.1, layer.modulationIndex),
          oscillator: { type: layer.oscillatorType },
          envelope: {
            attack: Math.max(0.001, attack),
            decay: Math.max(0.005, decay),
            sustain: Math.min(1, Math.max(0, sustain)),
            release: Math.max(0.005, release),
          },
          modulationEnvelope: {
            attack: 0.001,
            decay: modDecaySec,
            sustain: 0.04,
            release: 0.08,
          },
        }).connect(filter);

        if (detuneCents !== 0) {
          synth.detune.value = detuneCents;
        }

        const startFreq = Math.max(20, layer.frequency);
        const endFreq = Math.max(20, layer.frequencyEnd);

        synth.triggerAttackRelease(startFreq, durationSec, startTime);
        if (Math.abs(endFreq - startFreq) > 0.5) {
          if (layer.pitchCurve === 'exponential') {
            synth.frequency.exponentialRampToValueAtTime(endFreq, startTime + durationSec);
          } else {
            synth.frequency.linearRampToValueAtTime(endFreq, startTime + durationSec);
          }
        }

        cleanupNodes.push(synth);
      } else {
        const synth = new Tone.Synth({
          oscillator: { type: layer.oscillatorType },
          envelope: {
            attack: Math.max(0.001, attack),
            decay: Math.max(0.005, decay),
            sustain: Math.min(1, Math.max(0, sustain)),
            release: Math.max(0.005, release),
          },
        }).connect(filter);

        if (detuneCents !== 0) {
          synth.detune.value = detuneCents;
        }

        const startFreq = Math.max(20, layer.frequency);
        const endFreq = Math.max(20, layer.frequencyEnd);

        synth.triggerAttackRelease(startFreq, durationSec, startTime);
        if (Math.abs(endFreq - startFreq) > 0.5) {
          if (layer.pitchCurve === 'exponential') {
            synth.frequency.exponentialRampToValueAtTime(endFreq, startTime + durationSec);
          } else {
            synth.frequency.linearRampToValueAtTime(endFreq, startTime + durationSec);
          }
        }

        cleanupNodes.push(synth);
      }
    }

    cleanupNodes.forEach((n) => this.activeDisposables.add(n));

    const disposeDelayMs = Math.ceil(
      layer.delayMs + layer.durationMs + (attack + decay + release + extraReverbSec) * 1000 + 250
    );
    window.setTimeout(() => {
      for (const n of cleanupNodes) {
        this.activeDisposables.delete(n);
        try {
          n.dispose();
        } catch {
          // Ignore already disposed
        }
      }
    }, disposeDelayMs);
  }
}

export const soundEngine = new SoundEngine();
