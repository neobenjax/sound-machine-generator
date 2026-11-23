import * as Tone from 'tone';
import type { DawProject, SoundLayer, SoundRecipe } from './types';

export function midiToHz(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

const C4_HZ = 261.6255653005986;

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
  private activePianoVoices: Map<
    number,
    Array<{ release: (time: number) => void; dispose: () => void; releaseSec: number }>
  > = new Map();
  private dawLoop: Tone.Loop | null = null;
  private dawStepIndex = 0;
  private dawProjectRef: DawProject | null = null;
  private dawResolveRecipe: ((recipeId: string, snapshot?: SoundRecipe) => SoundRecipe | undefined) | null = null;
  private dawOnStepTick: ((step: number) => void) | null = null;
  private dawOnStop: (() => void) | null = null;
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
    this.stopDawPlayback();
    for (const midi of Array.from(this.activePianoVoices.keys())) {
      this.noteOff(midi);
    }
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

    const startTime = Math.max(Tone.now() + 0.002, baseTime + layer.delayMs / 1000);
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
  public async playRecipeAtNote(
    recipe: SoundRecipe,
    midiNote: number,
    options?: {
      time?: number;
      durationMsOverride?: number;
      velocity?: number;
      trackVolumeDb?: number;
      trackPan?: number;
    }
  ): Promise<number> {
    if (!this.isUnlocked || Tone.getContext().state !== 'running') {
      await this.unlock();
    }
    return this.playRecipeAtNoteSync(recipe, midiNote, options);
  }

  public playRecipeAtNoteSync(
    recipe: SoundRecipe,
    midiNote: number,
    options?: {
      time?: number;
      durationMsOverride?: number;
      velocity?: number;
      trackVolumeDb?: number;
      trackPan?: number;
    }
  ): number {
    this.ensureMasterChain();

    const reverbMix = recipe.reverbMix ?? 0;
    const reverbDecaySec = recipe.reverbDecaySec ?? 0.65;
    this.updateReverb(reverbMix, reverbDecaySec);

    const hasSolo = recipe.layers.some((l) => l.enabled && l.solo);
    const activeLayers = recipe.layers.filter((l) => l.enabled && (!hasSolo || l.solo));
    if (activeLayers.length === 0) return 0;

    const baseTime = options?.time ?? Tone.now() + 0.015;
    const pitchRatio = midiToHz(midiNote) / C4_HZ;
    const velocity = Math.max(0.05, Math.min(1, options?.velocity ?? 1));
    const recipeGainMult = Tone.dbToGain(recipe.masterVolumeDb);
    const trackGainMult = Tone.dbToGain(options?.trackVolumeDb ?? 0);
    const trackPanOffset = options?.trackPan ?? 0;
    let maxEndMs = 0;

    for (const layer of activeLayers) {
      // Preserve short percussive transient layers (< 80ms) instead of stretching them
      const effectiveDurationMs =
        options?.durationMsOverride !== undefined && layer.durationMs >= 80
          ? options.durationMsOverride
          : layer.durationMs;

      const transposed: SoundLayer = {
        ...layer,
        durationMs: effectiveDurationMs,
        frequency:
          layer.type === 'noise'
            ? layer.frequency
            : Math.max(20, Math.min(18000, layer.frequency * pitchRatio)),
        frequencyEnd:
          layer.type === 'noise'
            ? layer.frequencyEnd
            : Math.max(20, Math.min(18000, layer.frequencyEnd * pitchRatio)),
        gain: Math.min(1.2, layer.gain * velocity * recipeGainMult * trackGainMult),
        pan: Math.max(-1, Math.min(1, layer.pan + trackPanOffset)),
      };
      this.scheduleLayer(transposed, baseTime, reverbMix > 0 ? reverbDecaySec : 0);
      const tailMs =
        transposed.delayMs +
        transposed.durationMs +
        (transposed.envelope.attack + transposed.envelope.decay + transposed.envelope.release) * 1000;
      if (tailMs > maxEndMs) maxEndMs = tailMs;
    }

    return maxEndMs + (reverbMix > 0 ? reverbDecaySec * 400 : 0);
  }

  public async noteOn(midiNote: number, recipe: SoundRecipe, velocity = 0.85): Promise<void> {
    await this.unlock();
    this.ensureMasterChain();
    if (!this.masterGain) return;

    this.noteOff(midiNote);
    this.masterGain.gain.rampTo(Tone.dbToGain(recipe.masterVolumeDb), 0.01);
    this.updateReverb(recipe.reverbMix ?? 0, recipe.reverbDecaySec ?? 0.65);

    const hasSolo = recipe.layers.some((l) => l.enabled && l.solo);
    const activeLayers = recipe.layers.filter((l) => l.enabled && (!hasSolo || l.solo));
    if (activeLayers.length === 0) return;

    const pitchRatio = midiToHz(midiNote) / C4_HZ;
    const now = Tone.now() + 0.008;
    const handles: Array<{ release: (t: number) => void; dispose: () => void; releaseSec: number }> = [];

    for (const layer of activeLayers) {
      const startTime = now + layer.delayMs / 1000;
      const { attack, decay, sustain, release } = layer.envelope;
      const effectiveSustain = layer.type === 'noise' ? sustain : Math.max(0.25, sustain);
      const releaseSec = Math.max(0.04, release);

      const panner = new Tone.Panner(Math.max(-1, Math.min(1, layer.pan))).connect(this.masterGain);
      const layerGain = new Tone.Gain(layer.gain * velocity).connect(panner);
      const filter = new Tone.Filter({
        type: layer.filter.type,
        frequency: Math.max(20, layer.filter.frequency),
        Q: Math.max(0.1, layer.filter.Q),
      }).connect(layerGain);

      if (layer.type === 'noise') {
        const env = new Tone.AmplitudeEnvelope({
          attack: Math.max(0.001, attack),
          decay: Math.max(0.005, decay),
          sustain: Math.min(1, Math.max(0, effectiveSustain)),
          release: releaseSec,
        }).connect(filter);
        const noise = new Tone.Noise(layer.noiseType).connect(env);
        noise.start(startTime);
        env.triggerAttack(startTime);
        handles.push({
          releaseSec,
          release: (t) => {
            try {
              env.triggerRelease(t);
              noise.stop(t + releaseSec + 0.05);
            } catch {
              // ignore
            }
          },
          dispose: () => {
            noise.dispose();
            env.dispose();
            filter.dispose();
            layerGain.dispose();
            panner.dispose();
          },
        });
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
            sustain: Math.min(1, Math.max(0, effectiveSustain)),
            release: releaseSec,
          },
          modulationEnvelope: {
            attack: 0.001,
            decay: modDecaySec,
            sustain: 0.04,
            release: 0.08,
          },
        }).connect(filter);
        const targetFreq = Math.max(20, Math.min(18000, layer.frequency * pitchRatio));
        synth.triggerAttack(targetFreq, startTime);
        handles.push({
          releaseSec,
          release: (t) => {
            try {
              synth.triggerRelease(t);
            } catch {
              // ignore
            }
          },
          dispose: () => {
            synth.dispose();
            filter.dispose();
            layerGain.dispose();
            panner.dispose();
          },
        });
      } else {
        const synth = new Tone.Synth({
          oscillator: { type: layer.oscillatorType },
          envelope: {
            attack: Math.max(0.001, attack),
            decay: Math.max(0.005, decay),
            sustain: Math.min(1, Math.max(0, effectiveSustain)),
            release: releaseSec,
          },
        }).connect(filter);
        const targetFreq = Math.max(20, Math.min(18000, layer.frequency * pitchRatio));
        synth.triggerAttack(targetFreq, startTime);
        handles.push({
          releaseSec,
          release: (t) => {
            try {
              synth.triggerRelease(t);
            } catch {
              // ignore
            }
          },
          dispose: () => {
            synth.dispose();
            filter.dispose();
            layerGain.dispose();
            panner.dispose();
          },
        });
      }
    }

    this.activePianoVoices.set(midiNote, handles);
  }

  public noteOff(midiNote: number): void {
    const handles = this.activePianoVoices.get(midiNote);
    if (!handles) return;
    this.activePianoVoices.delete(midiNote);

    const now = Tone.now();
    let maxRelease = 0.08;
    for (const h of handles) {
      h.release(now);
      if (h.releaseSec > maxRelease) maxRelease = h.releaseSec;
    }
    window.setTimeout(() => {
      for (const h of handles) {
        try {
          h.dispose();
        } catch {
          // ignore
        }
      }
    }, Math.ceil((maxRelease + 0.18) * 1000));
  }

  public updateDawProject(
    project: DawProject,
    resolveRecipe: (recipeId: string, snapshot?: SoundRecipe) => SoundRecipe | undefined
  ): void {
    this.dawProjectRef = project;
    this.dawResolveRecipe = resolveRecipe;
    if (Tone.getTransport().state === 'started') {
      Tone.getTransport().bpm.rampTo(project.bpm, 0.05);
    }
  }

  public async startDawPlayback(
    project: DawProject,
    resolveRecipe: (recipeId: string, snapshot?: SoundRecipe) => SoundRecipe | undefined,
    onStepTick: (step: number) => void,
    onStop?: () => void
  ): Promise<void> {
    this.dawOnStop = null;
    this.stopDawPlayback();
    await this.unlock();
    this.ensureMasterChain();

    this.dawProjectRef = project;
    this.dawResolveRecipe = resolveRecipe;
    this.dawOnStepTick = onStepTick;
    this.dawOnStop = onStop ?? null;
    this.dawStepIndex = 0;

    const transport = Tone.getTransport();
    transport.bpm.value = project.bpm;

    this.dawLoop = new Tone.Loop((time) => {
      const currentProject = this.dawProjectRef;
      const resolver = this.dawResolveRecipe;
      if (!currentProject || !resolver) return;

      const step = this.dawStepIndex;
      const stepDurationSec = 60 / currentProject.bpm / 4;

      const hasSolo = currentProject.tracks.some((t) => !t.muted && t.solo);
      for (const track of currentProject.tracks) {
        if (track.muted || (hasSolo && !track.solo)) continue;
        const recipe = resolver(track.recipeId, track.recipeSnapshot);
        if (!recipe) continue;

        for (const note of track.steps) {
          if (note.step === step) {
            const noteDurMs = Math.max(40, note.lengthSteps * stepDurationSec * 1000);
            this.playRecipeAtNoteSync(recipe, note.midiNote, {
              time,
              durationMsOverride: noteDurMs,
              velocity: note.velocity,
              trackVolumeDb: track.volumeDb,
              trackPan: track.pan,
            });
          }
        }
      }

      Tone.getDraw().schedule(() => {
        this.dawOnStepTick?.(step);
      }, time);

      this.dawStepIndex += 1;
      if (this.dawStepIndex >= currentProject.stepCount) {
        if (currentProject.loop) {
          this.dawStepIndex = 0;
        } else {
          Tone.getDraw().schedule(() => {
            this.stopDawPlayback();
          }, time + stepDurationSec);
        }
      }
    }, '16n');

    this.dawLoop.start(0);
    transport.start('+0.02');
  }

  public stopDawPlayback(): void {
    if (this.dawLoop) {
      try {
        this.dawLoop.stop();
        this.dawLoop.dispose();
      } catch {
        // ignore
      }
      this.dawLoop = null;
    }
    const transport = Tone.getTransport();
    if (transport.state !== 'stopped') {
      transport.stop();
      transport.cancel(0);
    }
    this.dawStepIndex = 0;
    this.dawOnStepTick?.(-1);
    this.dawOnStop?.();
  }
}

export const soundEngine = new SoundEngine();
