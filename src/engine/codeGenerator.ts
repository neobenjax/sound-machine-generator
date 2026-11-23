import type { DawProject, PianoRecordedNote, SoundRecipe } from './types';

function toCamelCase(str: string): string {
  return (
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '') || 'customSound'
  );
}

export function generateToneJsCode(recipe: SoundRecipe): string {
  const fnName = `play${toCamelCase(recipe.name).replace(/^[a-z]/, (c) => c.toUpperCase())}`;
  const activeLayers = recipe.layers.filter((l) => l.enabled);
  const reverbMix = recipe.reverbMix ?? 0;
  const reverbDecaySec = recipe.reverbDecaySec ?? 0.65;

  const layerBlocks = activeLayers
    .map((layer, index) => {
      const idx = index + 1;
      const startExpr = `now + ${(layer.delayMs / 1000).toFixed(3)}`;
      const durSec = Math.max(0.005, layer.durationMs / 1000).toFixed(3);
      const voices =
        layer.type === 'noise' ? 1 : Math.min(3, Math.max(1, Math.round(layer.unisonVoices ?? 1)));
      const detuneSpread = Math.max(0, layer.detuneCents ?? 0);

      if (layer.type === 'noise') {
        const lines = [
          `  // Layer ${idx}: ${layer.name} (noise)`,
          `  const pan${idx} = new Tone.Panner(${layer.pan}).connect(master);`,
          `  const gain${idx} = new Tone.Gain(${layer.gain}).connect(pan${idx});`,
          `  const filter${idx} = new Tone.Filter({ type: '${layer.filter.type}', frequency: ${layer.filter.frequency}, Q: ${layer.filter.Q} }).connect(gain${idx});`,
        ];
        if (Math.abs(layer.filter.frequencyEnd - layer.filter.frequency) > 1) {
          lines.push(
            `  filter${idx}.frequency.setValueAtTime(${Math.max(20, layer.filter.frequency)}, ${startExpr});`,
            `  filter${idx}.frequency.exponentialRampToValueAtTime(${Math.max(20, layer.filter.frequencyEnd)}, ${startExpr} + ${durSec});`
          );
        }
        lines.push(
          `  const env${idx} = new Tone.AmplitudeEnvelope({ attack: ${layer.envelope.attack}, decay: ${layer.envelope.decay}, sustain: ${layer.envelope.sustain}, release: ${layer.envelope.release} }).connect(filter${idx});`,
          `  const noise${idx} = new Tone.Noise('${layer.noiseType}').connect(env${idx});`,
          `  noise${idx}.start(${startExpr});`,
          `  env${idx}.triggerAttackRelease(${durSec}, ${startExpr});`,
          `  noise${idx}.stop(${startExpr} + ${durSec} + ${layer.envelope.release} + 0.05);`
        );
        return lines.join('\n');
      }

      const voiceOffsets = Array.from({ length: voices }, (_, v) =>
        voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1
      );
      const voiceGain = (layer.gain / Math.sqrt(voices)).toFixed(3);
      const modDecaySec =
        layer.fmDecayMs !== undefined ? Math.max(0.005, layer.fmDecayMs / 1000).toFixed(3) : '0.120';

      const lines = [
        `  // Layer ${idx}: ${layer.name} (${layer.type}${voices > 1 ? `, ${voices}x unison` : ''})`,
        `  for (const offset of [${voiceOffsets.map((o) => o.toFixed(2)).join(', ')}]) {`,
        `    const pan = new Tone.Panner(Math.max(-1, Math.min(1, ${layer.pan} + offset * ${voices > 1 ? '0.22' : '0'}))).connect(master);`,
        `    const gain = new Tone.Gain(${voiceGain}).connect(pan);`,
        `    const filter = new Tone.Filter({ type: '${layer.filter.type}', frequency: ${layer.filter.frequency}, Q: ${layer.filter.Q} }).connect(gain);`,
      ];

      if (Math.abs(layer.filter.frequencyEnd - layer.filter.frequency) > 1) {
        lines.push(
          `    filter.frequency.setValueAtTime(${Math.max(20, layer.filter.frequency)}, ${startExpr});`,
          `    filter.frequency.exponentialRampToValueAtTime(${Math.max(20, layer.filter.frequencyEnd)}, ${startExpr} + ${durSec});`
        );
      }

      if (layer.type === 'fm') {
        lines.push(
          `    const synth = new Tone.FMSynth({`,
          `      harmonicity: ${layer.harmonicity},`,
          `      modulationIndex: ${layer.modulationIndex},`,
          `      oscillator: { type: '${layer.oscillatorType}' },`,
          `      envelope: { attack: ${layer.envelope.attack}, decay: ${layer.envelope.decay}, sustain: ${layer.envelope.sustain}, release: ${layer.envelope.release} },`,
          `      modulationEnvelope: { attack: 0.001, decay: ${modDecaySec}, sustain: 0.04, release: 0.08 }`,
          `    }).connect(filter);`
        );
      } else {
        lines.push(
          `    const synth = new Tone.Synth({`,
          `      oscillator: { type: '${layer.oscillatorType}' },`,
          `      envelope: { attack: ${layer.envelope.attack}, decay: ${layer.envelope.decay}, sustain: ${layer.envelope.sustain}, release: ${layer.envelope.release} }`,
          `    }).connect(filter);`
        );
      }

      if (voices > 1 && detuneSpread > 0) {
        lines.push(`    synth.detune.value = offset * ${detuneSpread};`);
      }

      lines.push(`    synth.triggerAttackRelease(${layer.frequency}, ${durSec}, ${startExpr});`);
      if (Math.abs(layer.frequencyEnd - layer.frequency) > 0.5) {
        const ramp =
          layer.pitchCurve === 'exponential' ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime';
        lines.push(
          `    synth.frequency.${ramp}(${Math.max(20, layer.frequencyEnd)}, ${startExpr} + ${durSec});`
        );
      }
      lines.push(`  }`);

      return lines.join('\n');
    })
    .join('\n\n');

  const reverbSetup =
    reverbMix > 0
      ? `
  const reverb = new Tone.Reverb({ decay: ${reverbDecaySec.toFixed(2)}, wet: ${reverbMix.toFixed(2)} }).connect(comp);
  await reverb.generate();
  const master = new Tone.Gain(Tone.dbToGain(${recipe.masterVolumeDb})).connect(reverb);`
      : `
  const master = new Tone.Gain(Tone.dbToGain(${recipe.masterVolumeDb})).connect(comp);`;

  return `import * as Tone from 'tone';

/**
 * ${recipe.name} — ${recipe.description}
 * Generated by Sound Machine Generator
 */
export async function ${fnName}() {
  await Tone.start(); // Required for browser & mobile Safari autoplay policy

  const comp = new Tone.Compressor({ threshold: -14, ratio: 3.5, attack: 0.004, release: 0.12 }).toDestination();${reverbSetup}
  const now = Tone.now() + 0.01;

${layerBlocks || '  // Enable at least one layer to generate sound.'}
}
`;
}

export function generateVanillaWebAudioCode(recipe: SoundRecipe): string {
  const fnName = `play${toCamelCase(recipe.name).replace(/^[a-z]/, (c) => c.toUpperCase())}`;
  const activeLayers = recipe.layers.filter((l) => l.enabled);
  const reverbMix = recipe.reverbMix ?? 0;
  const reverbDecaySec = recipe.reverbDecaySec ?? 0.65;

  const layerBlocks = activeLayers
    .map((layer, index) => {
      const idx = index + 1;
      const startExpr = `now + ${(layer.delayMs / 1000).toFixed(3)}`;
      const durSec = Math.max(0.005, layer.durationMs / 1000);
      const { attack, decay, sustain, release } = layer.envelope;
      const endSec = durSec + release;

      if (layer.type === 'noise') {
        const lines = [
          `  // Layer ${idx}: ${layer.name} (noise: ${layer.noiseType})`,
          `  const pan${idx} = ctx.createStereoPanner();`,
          `  pan${idx}.pan.setValueAtTime(${layer.pan}, ${startExpr});`,
          `  const filter${idx} = ctx.createBiquadFilter();`,
          `  filter${idx}.type = '${layer.filter.type}';`,
          `  filter${idx}.frequency.setValueAtTime(${Math.max(20, layer.filter.frequency)}, ${startExpr});`,
          `  filter${idx}.Q.setValueAtTime(${Math.max(0.1, layer.filter.Q)}, ${startExpr});`,
        ];

        if (Math.abs(layer.filter.frequencyEnd - layer.filter.frequency) > 1) {
          lines.push(
            `  filter${idx}.frequency.exponentialRampToValueAtTime(${Math.max(20, layer.filter.frequencyEnd)}, ${startExpr} + ${durSec.toFixed(3)});`
          );
        }

        lines.push(
          `  const env${idx} = ctx.createGain();`,
          `  env${idx}.gain.setValueAtTime(0.0001, ${startExpr});`,
          `  env${idx}.gain.linearRampToValueAtTime(${Math.max(0.001, layer.gain)}, ${startExpr} + ${attack.toFixed(3)});`,
          `  env${idx}.gain.exponentialRampToValueAtTime(${Math.max(0.0001, layer.gain * sustain)}, ${startExpr} + ${(attack + decay).toFixed(3)});`,
          `  env${idx}.gain.exponentialRampToValueAtTime(0.0001, ${startExpr} + ${endSec.toFixed(3)});`,
          `  const buf${idx} = createNoiseBuffer(ctx, '${layer.noiseType}', ${(endSec + 0.1).toFixed(2)});`,
          `  const src${idx} = ctx.createBufferSource();`,
          `  src${idx}.buffer = buf${idx};`,
          `  src${idx}.connect(filter${idx});`,
          `  filter${idx}.connect(env${idx});`,
          `  env${idx}.connect(pan${idx});`,
          `  pan${idx}.connect(master);`,
          `  src${idx}.start(${startExpr});`,
          `  src${idx}.stop(${startExpr} + ${(endSec + 0.05).toFixed(3)});`
        );
        return lines.join('\n');
      }

      const voices = Math.min(3, Math.max(1, Math.round(layer.unisonVoices ?? 1)));
      const detuneSpread = Math.max(0, layer.detuneCents ?? 0);
      const voiceOffsets = Array.from({ length: voices }, (_, v) =>
        voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1
      );
      const voiceGain = Math.max(0.001, layer.gain / Math.sqrt(voices));
      const startFreq = Math.max(20, layer.frequency);
      const endFreq = Math.max(20, layer.frequencyEnd);
      const modDecaySec =
        layer.fmDecayMs !== undefined ? Math.max(0.005, layer.fmDecayMs / 1000) : 0.12;

      const lines = [
        `  // Layer ${idx}: ${layer.name} (${layer.type}${voices > 1 ? `, ${voices}x unison` : ''})`,
        `  for (const offset of [${voiceOffsets.map((o) => o.toFixed(2)).join(', ')}]) {`,
        `    const pan = ctx.createStereoPanner();`,
        `    pan.pan.setValueAtTime(Math.max(-1, Math.min(1, ${layer.pan} + offset * ${voices > 1 ? '0.22' : '0'})), ${startExpr});`,
        `    const filter = ctx.createBiquadFilter();`,
        `    filter.type = '${layer.filter.type}';`,
        `    filter.frequency.setValueAtTime(${Math.max(20, layer.filter.frequency)}, ${startExpr});`,
        `    filter.Q.setValueAtTime(${Math.max(0.1, layer.filter.Q)}, ${startExpr});`,
      ];

      if (Math.abs(layer.filter.frequencyEnd - layer.filter.frequency) > 1) {
        lines.push(
          `    filter.frequency.exponentialRampToValueAtTime(${Math.max(20, layer.filter.frequencyEnd)}, ${startExpr} + ${durSec.toFixed(3)});`
        );
      }

      lines.push(
        `    const env = ctx.createGain();`,
        `    env.gain.setValueAtTime(0.0001, ${startExpr});`,
        `    env.gain.linearRampToValueAtTime(${voiceGain.toFixed(3)}, ${startExpr} + ${attack.toFixed(3)});`,
        `    env.gain.exponentialRampToValueAtTime(${Math.max(0.0001, voiceGain * sustain).toFixed(4)}, ${startExpr} + ${(attack + decay).toFixed(3)});`,
        `    env.gain.exponentialRampToValueAtTime(0.0001, ${startExpr} + ${endSec.toFixed(3)});`,
        `    const osc = ctx.createOscillator();`,
        `    osc.type = '${layer.oscillatorType}';`,
        `    osc.frequency.setValueAtTime(${startFreq}, ${startExpr});`
      );

      if (voices > 1 && detuneSpread > 0) {
        lines.push(`    osc.detune.setValueAtTime(offset * ${detuneSpread}, ${startExpr});`);
      }

      if (Math.abs(endFreq - startFreq) > 0.5) {
        const ramp =
          layer.pitchCurve === 'exponential' ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime';
        lines.push(`    osc.frequency.${ramp}(${endFreq}, ${startExpr} + ${durSec.toFixed(3)});`);
      }

      if (layer.type === 'fm') {
        const modFreq = (startFreq * Math.max(0.1, layer.harmonicity)).toFixed(2);
        const modEndFreq = (endFreq * Math.max(0.1, layer.harmonicity)).toFixed(2);
        const peakDev = Math.max(1, startFreq * Math.max(0.1, layer.modulationIndex)).toFixed(1);
        lines.push(
          `    // Native FM synthesis with decaying modulation envelope`,
          `    const mod = ctx.createOscillator();`,
          `    mod.type = 'sine';`,
          `    mod.frequency.setValueAtTime(${modFreq}, ${startExpr});`
        );
        if (Math.abs(endFreq - startFreq) > 0.5) {
          const ramp =
            layer.pitchCurve === 'exponential' ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime';
          lines.push(`    mod.frequency.${ramp}(${modEndFreq}, ${startExpr} + ${durSec.toFixed(3)});`);
        }
        lines.push(
          `    const modGain = ctx.createGain();`,
          `    modGain.gain.setValueAtTime(${peakDev}, ${startExpr});`,
          `    modGain.gain.exponentialRampToValueAtTime(${Math.max(0.5, Number(peakDev) * 0.04).toFixed(2)}, ${startExpr} + ${modDecaySec.toFixed(3)});`,
          `    mod.connect(modGain);`,
          `    modGain.connect(osc.frequency);`,
          `    mod.start(${startExpr});`,
          `    mod.stop(${startExpr} + ${(endSec + 0.05).toFixed(3)});`
        );
      }

      lines.push(
        `    osc.connect(filter);`,
        `    filter.connect(env);`,
        `    env.connect(pan);`,
        `    pan.connect(master);`,
        `    osc.start(${startExpr});`,
        `    osc.stop(${startExpr} + ${(endSec + 0.05).toFixed(3)});`,
        `  }`
      );

      return lines.join('\n');
    })
    .join('\n\n');

  const masterLinear = Math.pow(10, recipe.masterVolumeDb / 20).toFixed(3);
  const needsNoiseHelper = activeLayers.some((l) => l.type === 'noise');

  const noiseHelper = needsNoiseHelper
    ? `
function createNoiseBuffer(ctx, color, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, lastOut = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.296516;
      b2 = 0.57000 * b2 + white * 1.052691;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else if (color === 'brown') {
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buf;
}
`
    : '';

  const reverbHelper =
    reverbMix > 0
      ? `
function createStereoImpulse(ctx, decaySec) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * decaySec));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < len; i++) {
      const p = i / len;
      const env = Math.pow(1 - p, 2.4) * Math.exp(-2.2 * p);
      smooth = smooth * 0.48 + (Math.random() * 2 - 1) * 0.52;
      data[i] = smooth * env * 0.65;
    }
  }
  return buf;
}
`
      : '';

  const reverbRouting =
    reverbMix > 0
      ? `
  const convolver = ctx.createConvolver();
  convolver.buffer = createStereoImpulse(ctx, ${reverbDecaySec.toFixed(2)});
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = ${reverbMix.toFixed(2)};
  master.connect(reverbWet);
  reverbWet.connect(convolver);
  convolver.connect(comp);`
      : '';

  return `// Zero-dependency Native Web Audio API implementation
let sharedCtx = null;
${noiseHelper}${reverbHelper}
export async function ${fnName}() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  if (sharedCtx.state === 'suspended') await sharedCtx.resume();

  const ctx = sharedCtx;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3.5;
  comp.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = ${masterLinear};
  master.connect(comp);${reverbRouting}

  const now = ctx.currentTime + 0.01;

${layerBlocks || '  // Enable at least one layer to generate sound.'}
}
`;
}

function serializeCompactRecipe(recipe: SoundRecipe) {
  return {
    masterVolumeDb: recipe.masterVolumeDb,
    layers: recipe.layers
      .filter((l) => l.enabled)
      .map((l) => ({
        type: l.type,
        oscillatorType: l.oscillatorType,
        noiseType: l.noiseType,
        delayMs: l.delayMs,
        durationMs: l.durationMs,
        frequency: l.frequency,
        frequencyEnd: l.frequencyEnd,
        pitchCurve: l.pitchCurve,
        harmonicity: l.harmonicity,
        modulationIndex: l.modulationIndex,
        fmDecayMs: l.fmDecayMs ?? 120,
        envelope: l.envelope,
        filter: l.filter,
        gain: l.gain,
        pan: l.pan,
      })),
  };
}

export function generateDawToneJsCode(
  project: DawProject,
  resolveRecipe: (recipeId: string, snapshot?: SoundRecipe) => SoundRecipe | undefined
): string {
  const fnName = `play${toCamelCase(project.name).replace(/^[a-z]/, (c) => c.toUpperCase())}`;
  const hasSolo = project.tracks.some((t) => !t.muted && t.solo);
  const activeTracks = project.tracks
    .filter((t) => !t.muted && (!hasSolo || t.solo) && t.steps.length > 0)
    .map((track) => {
      const recipe = resolveRecipe(track.recipeId, track.recipeSnapshot);
      return {
        name: track.name,
        volumeDb: track.volumeDb,
        pan: track.pan,
        recipe: recipe ? serializeCompactRecipe(recipe) : null,
        steps: track.steps,
      };
    })
    .filter((t) => t.recipe !== null);

  return `// Requires: npm install tone
import * as Tone from 'tone';

const COMPOSITION = ${JSON.stringify(
    {
      name: project.name,
      bpm: project.bpm,
      stepCount: project.stepCount,
      loop: project.loop,
      tracks: activeTracks,
    },
    null,
    2
  )};

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function triggerTrackNote(recipe, midiNote, time, durSec, velocity, trackDb, trackPan) {
  const master = new Tone.Gain(Tone.dbToGain(recipe.masterVolumeDb + trackDb) * velocity).toDestination();
  const ratio = midiToHz(midiNote) / 261.6256;
  for (const layer of recipe.layers) {
    const start = time + layer.delayMs / 1000;
    const dur = Math.max(0.02, durSec);
    const pan = new Tone.Panner(Math.max(-1, Math.min(1, layer.pan + trackPan))).connect(master);
    const gain = new Tone.Gain(layer.gain).connect(pan);
    const filter = new Tone.Filter({ type: layer.filter.type, frequency: layer.filter.frequency, Q: layer.filter.Q }).connect(gain);
    if (layer.type === 'noise') {
      const env = new Tone.AmplitudeEnvelope(layer.envelope).connect(filter);
      const noise = new Tone.Noise(layer.noiseType).connect(env);
      noise.start(start);
      env.triggerAttackRelease(dur, start);
      noise.stop(start + dur + layer.envelope.release + 0.05);
    } else {
      const SynthClass = layer.type === 'fm' ? Tone.FMSynth : Tone.Synth;
      const synth = new SynthClass({
        ...(layer.type === 'fm' ? { harmonicity: layer.harmonicity, modulationIndex: layer.modulationIndex } : {}),
        oscillator: { type: layer.oscillatorType },
        envelope: layer.envelope,
      }).connect(filter);
      const f0 = Math.max(20, layer.frequency * ratio);
      const f1 = Math.max(20, layer.frequencyEnd * ratio);
      synth.triggerAttackRelease(f0, dur, start);
      if (Math.abs(f1 - f0) > 0.5) synth.frequency.exponentialRampToValueAtTime(f1, start + dur);
    }
  }
}

export async function ${fnName}() {
  await Tone.start();
  const stepSec = 60 / COMPOSITION.bpm / 4;
  const now = Tone.now() + 0.02;
  for (const track of COMPOSITION.tracks) {
    for (const s of track.steps) {
      triggerTrackNote(
        track.recipe,
        s.midiNote,
        now + s.step * stepSec,
        s.lengthSteps * stepSec,
        s.velocity,
        track.volumeDb,
        track.pan
      );
    }
  }
}
`;
}

export function generateDawVanillaWebAudioCode(
  project: DawProject,
  resolveRecipe: (recipeId: string, snapshot?: SoundRecipe) => SoundRecipe | undefined
): string {
  const fnName = `play${toCamelCase(project.name).replace(/^[a-z]/, (c) => c.toUpperCase())}`;
  const hasSolo = project.tracks.some((t) => !t.muted && t.solo);
  const activeTracks = project.tracks
    .filter((t) => !t.muted && (!hasSolo || t.solo) && t.steps.length > 0)
    .map((track) => {
      const recipe = resolveRecipe(track.recipeId, track.recipeSnapshot);
      return {
        name: track.name,
        volumeDb: track.volumeDb,
        pan: track.pan,
        recipe: recipe ? serializeCompactRecipe(recipe) : null,
        steps: track.steps,
      };
    })
    .filter((t) => t.recipe !== null);

  return `// Zero-dependency Native Web Audio API DAW Composition
let sharedCtx = null;

const COMPOSITION = ${JSON.stringify(
    {
      name: project.name,
      bpm: project.bpm,
      stepCount: project.stepCount,
      tracks: activeTracks,
    },
    null,
    2
  )};

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const dbToGain = (db) => Math.pow(10, db / 20);

function triggerLayer(ctx, dest, layer, ratio, start, dur, vel) {
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, layer.pan));
  const filter = ctx.createBiquadFilter();
  filter.type = layer.filter.type;
  filter.frequency.setValueAtTime(Math.max(20, layer.filter.frequency), start);
  filter.Q.value = layer.filter.Q;
  const amp = ctx.createGain();
  const peak = Math.max(0.0001, layer.gain * vel);
  const { attack, decay, sustain, release } = layer.envelope;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(peak, start + attack);
  amp.gain.linearRampToValueAtTime(Math.max(0.0001, peak * sustain), start + attack + decay);
  amp.gain.setValueAtTime(Math.max(0.0001, peak * sustain), start + dur);
  amp.gain.linearRampToValueAtTime(0.0001, start + dur + release);
  filter.connect(amp);
  amp.connect(pan);
  pan.connect(dest);

  if (layer.type === 'noise') {
    const len = Math.floor(ctx.sampleRate * (dur + release + 0.05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(filter);
    src.start(start);
    src.stop(start + dur + release + 0.05);
  } else {
    const osc = ctx.createOscillator();
    osc.type = layer.oscillatorType;
    const f0 = Math.max(20, layer.frequency * ratio);
    const f1 = Math.max(20, layer.frequencyEnd * ratio);
    osc.frequency.setValueAtTime(f0, start);
    if (Math.abs(f1 - f0) > 0.5) osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + release + 0.05);
  }
}

export async function ${fnName}() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  if (sharedCtx.state === 'suspended') await sharedCtx.resume();
  const ctx = sharedCtx;
  const stepSec = 60 / COMPOSITION.bpm / 4;
  const base = ctx.currentTime + 0.02;

  for (const track of COMPOSITION.tracks) {
    const trackGain = ctx.createGain();
    trackGain.gain.value = dbToGain(track.recipe.masterVolumeDb + track.volumeDb);
    trackGain.connect(ctx.destination);
    for (const s of track.steps) {
      const ratio = midiToHz(s.midiNote) / 261.6256;
      const start = base + s.step * stepSec;
      const dur = Math.max(0.02, s.lengthSteps * stepSec);
      for (const layer of track.recipe.layers) {
        triggerLayer(ctx, trackGain, layer, ratio, start + layer.delayMs / 1000, dur, s.velocity);
      }
    }
  }
}
`;
}

export function generateMelodyCode(
  notes: PianoRecordedNote[],
  recipe: SoundRecipe,
  mode: 'webaudio' | 'tone' | 'json'
): string {
  if (mode === 'json') {
    return JSON.stringify({ recipe: serializeCompactRecipe(recipe), notes }, null, 2);
  }
  const project: DawProject = {
    id: 'piano-melody',
    name: `${recipe.name} Melody`,
    bpm: 120,
    stepCount: 16,
    loop: false,
    tracks: [
      {
        id: 'melody-track',
        name: recipe.name,
        recipeId: recipe.id,
        recipeSnapshot: recipe,
        muted: false,
        solo: false,
        volumeDb: 0,
        pan: 0,
        steps: notes.map((n) => ({
          step: Math.round((n.startMs / 1000) * 8), // 16th-note quantize at 120 BPM
          midiNote: n.midiNote,
          velocity: n.velocity,
          lengthSteps: Math.max(1, Math.round((n.durationMs / 1000) * 8)),
        })),
      },
    ],
  };
  return mode === 'tone'
    ? generateDawToneJsCode(project, () => recipe)
    : generateDawVanillaWebAudioCode(project, () => recipe);
}
