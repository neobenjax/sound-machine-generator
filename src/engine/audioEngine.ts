import * as Tone from 'tone';
import type { SoundLayer, SoundRecipe } from './types';

class SoundEngine {
  private analyser: Tone.Analyser | null = null;
  private masterGain: Tone.Gain | null = null;
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
      const limiter = new Tone.Limiter(-1).toDestination();
      this.analyser = new Tone.Analyser('waveform', 256);
      this.masterGain.connect(this.analyser);
      this.masterGain.connect(limiter);
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

    const hasSolo = recipe.layers.some((l) => l.enabled && l.solo);
    const activeLayers = recipe.layers.filter((l) => l.enabled && (!hasSolo || l.solo));

    if (activeLayers.length === 0) {
      return 0;
    }

    const baseTime = Tone.now() + 0.015;
    let maxEndMs = 0;

    for (const layer of activeLayers) {
      this.scheduleLayer(layer, baseTime);
      const tailMs =
        layer.delayMs +
        layer.durationMs +
        (layer.envelope.attack + layer.envelope.decay + layer.envelope.release) * 1000;
      if (tailMs > maxEndMs) {
        maxEndMs = tailMs;
      }
    }

    return maxEndMs;
  }

  private scheduleLayer(layer: SoundLayer, baseTime: number): void {
    if (!this.masterGain) return;

    const startTime = baseTime + layer.delayMs / 1000;
    const durationSec = Math.max(0.005, layer.durationMs / 1000);
    const { attack, decay, sustain, release } = layer.envelope;

    const panner = new Tone.Panner(layer.pan).connect(this.masterGain);
    const layerGain = new Tone.Gain(layer.gain).connect(panner);
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

    const cleanupNodes: Array<{ dispose: () => void }> = [panner, layerGain, filter];

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
      }).connect(filter);

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

    cleanupNodes.forEach((n) => this.activeDisposables.add(n));

    const disposeDelayMs = Math.ceil((layer.delayMs + layer.durationMs + (attack + decay + release) * 1000) + 250);
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
