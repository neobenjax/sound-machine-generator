export type GeneratorType = 'tone' | 'noise' | 'fm';
export type OscillatorShape = 'sine' | 'triangle' | 'sawtooth' | 'square';
export type NoiseShape = 'white' | 'pink' | 'brown';
export type FilterShape = 'lowpass' | 'highpass' | 'bandpass';
export type PitchCurve = 'exponential' | 'linear';

export interface EnvelopeConfig {
  attack: number;   // seconds (0.001 - 2.0)
  decay: number;    // seconds (0.005 - 3.0)
  sustain: number;  // 0.0 - 1.0
  release: number;  // seconds (0.005 - 3.0)
}

export interface FilterConfig {
  type: FilterShape;
  frequency: number;     // Hz (40 - 18000)
  frequencyEnd: number;  // Hz (40 - 18000)
  Q: number;             // 0.1 - 20
}

export interface SoundLayer {
  id: string;
  name: string;
  enabled: boolean;
  solo: boolean;
  type: GeneratorType;
  oscillatorType: OscillatorShape;
  noiseType: NoiseShape;
  delayMs: number;
  durationMs: number;
  frequency: number;
  frequencyEnd: number;
  pitchCurve: PitchCurve;
  harmonicity: number;
  modulationIndex: number;
  fmDecayMs?: number; // 10 - 600 ms: modulation index decay for bell/marimba transients
  unisonVoices?: number; // 1 - 3 detuned voices for warmth
  detuneCents?: number; // 0 - 50 cents spread across unison voices
  envelope: EnvelopeConfig;
  filter: FilterConfig;
  gain: number; // 0.0 - 1.0
  pan: number;  // -1.0 - 1.0
}

export interface SoundRecipe {
  id: string;
  name: string;
  playlistId: string;
  description: string;
  tags: string[];
  masterVolumeDb: number; // -24 to 0
  reverbMix?: number; // 0.0 - 0.6 procedural stereo reverb send
  reverbDecaySec?: number; // 0.15 - 2.5s impulse response tail
  layers: SoundLayer[];
  isCustom?: boolean;
  updatedAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
}
