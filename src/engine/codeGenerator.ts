import type { SoundRecipe } from './types';

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
