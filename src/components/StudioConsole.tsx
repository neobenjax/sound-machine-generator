import {
  Copy,
  Download,
  Headphones,
  Layers,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { soundEngine } from '../engine/audioEngine';
import type {
  FilterShape,
  GeneratorType,
  NoiseShape,
  OscillatorShape,
  Playlist,
  SoundLayer,
  SoundRecipe,
} from '../engine/types';
import { AdsrVisualizer } from './AdsrVisualizer';

interface StudioConsoleProps {
  recipe: SoundRecipe;
  isDirty: boolean;
  isLooping: boolean;
  customPlaylists: Playlist[];
  targetPlaylistId: string;
  onChangeTargetPlaylist: (id: string) => void;
  onUpdateRecipe: (updater: (prev: SoundRecipe) => SoundRecipe) => void;
  onPlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onSaveModification: () => void;
  onSaveAsNew: () => void;
  onReset: () => void;
  onExportSingle: () => void;
  className?: string;
}

function createDefaultLayer(index: number): SoundLayer {
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Layer ${index + 1}`,
    enabled: true,
    solo: false,
    type: 'tone',
    oscillatorType: 'triangle',
    noiseType: 'white',
    delayMs: 0,
    durationMs: 65,
    frequency: 320,
    frequencyEnd: 120,
    pitchCurve: 'exponential',
    harmonicity: 2,
    modulationIndex: 3,
    envelope: { attack: 0.002, decay: 0.055, sustain: 0.0, release: 0.02 },
    filter: { type: 'lowpass', frequency: 2400, frequencyEnd: 800, Q: 1.2 },
    gain: 0.7,
    pan: 0,
  };
}

export function StudioConsole({
  recipe,
  isDirty,
  isLooping,
  customPlaylists,
  targetPlaylistId,
  onChangeTargetPlaylist,
  onUpdateRecipe,
  onPlay,
  onStop,
  onToggleLoop,
  onSaveModification,
  onSaveAsNew,
  onReset,
  onExportSingle,
  className = '',
}: StudioConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          const samples = soundEngine.getWaveformData();
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const step = w / samples.length;
          for (let i = 0; i < samples.length; i++) {
            const x = i * step;
            const y = h / 2 + samples[i] * (h * 0.42);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const updateLayer = (layerId: string, patch: Partial<SoundLayer>) => {
    onUpdateRecipe((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
    }));
  };

  const duplicateLayer = (layer: SoundLayer) => {
    const copy: SoundLayer = {
      ...layer,
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${layer.name} (Copy)`,
      envelope: { ...layer.envelope },
      filter: { ...layer.filter },
    };
    onUpdateRecipe((prev) => ({ ...prev, layers: [...prev.layers, copy] }));
  };

  const removeLayer = (layerId: string) => {
    onUpdateRecipe((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== layerId),
    }));
  };

  const reverbMix = recipe.reverbMix ?? 0;
  const reverbDecay = recipe.reverbDecaySec ?? 0.65;

  return (
    <section
      className={`flex flex-col gap-4 ${className}`}
      aria-label="Sound composer console"
    >
      {/* Master Header & Transport Rack */}
      <div className="rounded-xl border border-[#334155] bg-[#1B2336] p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <label htmlFor="recipe-name-input" className="sr-only">
              Sound name
            </label>
            <input
              id="recipe-name-input"
              type="text"
              value={recipe.name}
              onChange={(e) => onUpdateRecipe((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-lg font-bold text-[#F8FAFC] transition-colors hover:border-[#334155] focus:border-[#22C55E] focus:bg-[#0F172A] sm:text-xl"
            />
            <label htmlFor="recipe-desc-input" className="sr-only">
              Sound description
            </label>
            <input
              id="recipe-desc-input"
              type="text"
              value={recipe.description}
              onChange={(e) =>
                onUpdateRecipe((prev) => ({ ...prev, description: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-[#CBD5E1] transition-colors hover:border-[#334155] focus:border-[#22C55E] focus:bg-[#0F172A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {recipe.isCustom && (
              <button
                type="button"
                onClick={onSaveModification}
                disabled={!isDirty}
                className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#22C55E] px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
              >
                <Save size={15} aria-hidden="true" />
                <span>Save Changes</span>
              </button>
            )}

            <label htmlFor="target-playlist-select" className="sr-only">
              Target playlist for saving
            </label>
            <select
              id="target-playlist-select"
              value={targetPlaylistId}
              onChange={(e) => onChangeTargetPlaylist(e.target.value)}
              className="min-h-9 cursor-pointer rounded-lg border border-[#475569] bg-[#0F172A] px-2.5 py-1.5 text-xs font-medium text-[#F8FAFC] sm:text-sm"
            >
              {customPlaylists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  Save to: {pl.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onSaveAsNew}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#22C55E]/50 bg-[#22C55E]/15 px-3 py-1.5 text-xs font-semibold text-[#22C55E] transition-colors duration-150 hover:bg-[#22C55E] hover:text-[#0F172A] sm:text-sm"
            >
              <Save size={15} aria-hidden="true" />
              <span>Save As New</span>
            </button>
          </div>
        </div>

        {/* Oscilloscope */}
        <div className="mt-4 overflow-hidden rounded-lg border border-[#334155] bg-[#0F172A] p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="font-display text-xs font-medium text-[#94A3B8]">
              Real-time Oscilloscope
            </span>
            <span className="font-display text-xs tabular-nums text-[#22C55E]">
              {recipe.layers.filter((l) => l.enabled).length}/{recipe.layers.length} active layers
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={640}
            height={84}
            className="block h-20 w-full rounded bg-[#0F172A]"
            aria-label="Live audio waveform oscilloscope"
          />
        </div>

        {/* Transport & Master Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPlay}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90"
            >
              <Play size={16} aria-hidden="true" />
              <span>Audition (Space)</span>
            </button>

            <button
              type="button"
              onClick={onStop}
              aria-label="Stop playback"
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#272F42] px-3 py-2 text-sm font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#64748B] hover:bg-[#334155]"
            >
              <Square size={14} aria-hidden="true" />
              <span>Stop</span>
            </button>

            <button
              type="button"
              onClick={onToggleLoop}
              aria-pressed={isLooping}
              className={`flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isLooping
                  ? 'border-[#22C55E] bg-[#22C55E]/15 text-[#22C55E]'
                  : 'border-[#475569] bg-[#272F42] text-[#CBD5E1] hover:border-[#64748B] hover:text-[#F8FAFC]'
              }`}
            >
              <Repeat size={14} aria-hidden="true" />
              <span>{isLooping ? 'Looping' : 'Loop'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!isDirty}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#0F172A] px-3 py-2 text-xs font-medium text-[#CBD5E1] transition-colors duration-150 hover:border-[#64748B] hover:text-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={onExportSingle}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#0F172A] px-3 py-2 text-xs font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E] sm:text-sm"
            >
              <Download size={14} aria-hidden="true" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Master Bus & Stereo Reverb */}
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-[#334155] bg-[#0F172A]/80 p-3 sm:grid-cols-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label htmlFor="master-vol-slider" className="font-medium text-[#CBD5E1]">
                Master Gain
              </label>
              <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                {recipe.masterVolumeDb} dB
              </span>
            </div>
            <input
              id="master-vol-slider"
              type="range"
              className="studio-slider"
              min={-24}
              max={0}
              step={1}
              value={recipe.masterVolumeDb}
              onChange={(e) =>
                onUpdateRecipe((prev) => ({ ...prev, masterVolumeDb: Number(e.target.value) }))
              }
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label htmlFor="reverb-mix-slider" className="font-medium text-[#CBD5E1]">
                Stereo Reverb Mix
              </label>
              <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                {Math.round(reverbMix * 100)}%
              </span>
            </div>
            <input
              id="reverb-mix-slider"
              type="range"
              className="studio-slider"
              min={0}
              max={0.6}
              step={0.02}
              value={reverbMix}
              onChange={(e) =>
                onUpdateRecipe((prev) => ({ ...prev, reverbMix: Number(e.target.value) }))
              }
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label htmlFor="reverb-decay-slider" className="font-medium text-[#CBD5E1]">
                Reverb Decay
              </label>
              <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                {reverbDecay.toFixed(2)} s
              </span>
            </div>
            <input
              id="reverb-decay-slider"
              type="range"
              className="studio-slider"
              min={0.15}
              max={2.5}
              step={0.05}
              value={reverbDecay}
              onChange={(e) =>
                onUpdateRecipe((prev) => ({ ...prev, reverbDecaySec: Number(e.target.value) }))
              }
            />
          </div>
        </div>
      </div>

      {/* Synthesis Layers */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#22C55E]" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
            Synthesis Layers ({recipe.layers.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdateRecipe((prev) => ({
              ...prev,
              layers: [...prev.layers, createDefaultLayer(prev.layers.length)],
            }))
          }
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#1B2336] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Add Layer</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {recipe.layers.map((layer, index) => (
          <article
            key={layer.id}
            className={`rounded-xl border p-4 transition-colors duration-150 ${
              layer.enabled
                ? 'border-[#334155] bg-[#1B2336]'
                : 'border-[#334155]/60 bg-[#1B2336]/50 opacity-75'
            }`}
          >
            {/* Layer Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155] pb-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="rounded border border-[#475569] bg-[#0F172A] px-2 py-0.5 font-display text-xs font-semibold tabular-nums text-[#22C55E]">
                  L{index + 1}
                </span>
                <label htmlFor={`layer-name-${layer.id}`} className="sr-only">
                  Layer {index + 1} name
                </label>
                <input
                  id={`layer-name-${layer.id}`}
                  type="text"
                  value={layer.name}
                  onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-[#F8FAFC] hover:border-[#334155] focus:border-[#22C55E] focus:bg-[#0F172A]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateLayer(layer.id, { enabled: !layer.enabled })}
                  aria-pressed={layer.enabled}
                  aria-label={layer.enabled ? `Mute ${layer.name}` : `Enable ${layer.name}`}
                  title={layer.enabled ? 'Mute layer' : 'Enable layer'}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors duration-150 ${
                    layer.enabled
                      ? 'border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]'
                      : 'border-[#475569] bg-[#272F42] text-[#94A3B8]'
                  }`}
                >
                  {layer.enabled ? (
                    <Volume2 size={14} aria-hidden="true" />
                  ) : (
                    <VolumeX size={14} aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => updateLayer(layer.id, { solo: !layer.solo })}
                  aria-pressed={layer.solo}
                  aria-label={`Solo ${layer.name}`}
                  title="Solo layer"
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md border transition-colors duration-150 ${
                    layer.solo
                      ? 'border-[#F59E0B] bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'border-[#475569] bg-[#272F42] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <Headphones size={14} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => duplicateLayer(layer)}
                  aria-label={`Duplicate ${layer.name}`}
                  title="Duplicate layer"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-[#475569] bg-[#272F42] text-[#CBD5E1] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>

                {recipe.layers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLayer(layer.id)}
                    aria-label={`Remove ${layer.name}`}
                    title="Remove layer"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-[#475569] bg-[#272F42] text-[#94A3B8] transition-colors duration-150 hover:border-[#EF4444] hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Source & Timing Controls */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor={`type-${layer.id}`}
                  className="mb-1 block text-xs font-medium text-[#CBD5E1]"
                >
                  Generator
                </label>
                <select
                  id={`type-${layer.id}`}
                  value={layer.type}
                  onChange={(e) =>
                    updateLayer(layer.id, { type: e.target.value as GeneratorType })
                  }
                  className="w-full cursor-pointer rounded-lg border border-[#475569] bg-[#0F172A] px-2.5 py-1.5 text-sm text-[#F8FAFC]"
                >
                  <option value="tone">Tone Oscillator</option>
                  <option value="fm">FM Synth</option>
                  <option value="noise">Noise Generator</option>
                </select>
              </div>

              {layer.type === 'noise' ? (
                <div>
                  <label
                    htmlFor={`noise-${layer.id}`}
                    className="mb-1 block text-xs font-medium text-[#CBD5E1]"
                  >
                    Noise Color
                  </label>
                  <select
                    id={`noise-${layer.id}`}
                    value={layer.noiseType}
                    onChange={(e) =>
                      updateLayer(layer.id, { noiseType: e.target.value as NoiseShape })
                    }
                    className="w-full cursor-pointer rounded-lg border border-[#475569] bg-[#0F172A] px-2.5 py-1.5 text-sm text-[#F8FAFC]"
                  >
                    <option value="white">White</option>
                    <option value="pink">Pink</option>
                    <option value="brown">Brown</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor={`osc-${layer.id}`}
                    className="mb-1 block text-xs font-medium text-[#CBD5E1]"
                  >
                    Waveform
                  </label>
                  <select
                    id={`osc-${layer.id}`}
                    value={layer.oscillatorType}
                    onChange={(e) =>
                      updateLayer(layer.id, {
                        oscillatorType: e.target.value as OscillatorShape,
                      })
                    }
                    className="w-full cursor-pointer rounded-lg border border-[#475569] bg-[#0F172A] px-2.5 py-1.5 text-sm text-[#F8FAFC]"
                  >
                    <option value="sine">Sine</option>
                    <option value="triangle">Triangle</option>
                    <option value="sawtooth">Sawtooth</option>
                    <option value="square">Square</option>
                  </select>
                </div>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor={`delay-${layer.id}`} className="font-medium text-[#CBD5E1]">
                    Delay
                  </label>
                  <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                    {layer.delayMs} ms
                  </span>
                </div>
                <input
                  id={`delay-${layer.id}`}
                  type="range"
                  className="studio-slider"
                  min={0}
                  max={1000}
                  step={5}
                  value={layer.delayMs}
                  onChange={(e) => updateLayer(layer.id, { delayMs: Number(e.target.value) })}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor={`dur-${layer.id}`} className="font-medium text-[#CBD5E1]">
                    Duration
                  </label>
                  <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                    {layer.durationMs} ms
                  </span>
                </div>
                <input
                  id={`dur-${layer.id}`}
                  type="range"
                  className="studio-slider"
                  min={15}
                  max={2500}
                  step={5}
                  value={layer.durationMs}
                  onChange={(e) => updateLayer(layer.id, { durationMs: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Pitch & FM / Unison Controls */}
            {layer.type !== 'noise' && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-[#334155]/80 bg-[#0F172A]/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor={`freq-${layer.id}`} className="font-medium text-[#CBD5E1]">
                      Start Pitch
                    </label>
                    <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                      {layer.frequency} Hz
                    </span>
                  </div>
                  <input
                    id={`freq-${layer.id}`}
                    type="range"
                    className="studio-slider"
                    min={30}
                    max={4000}
                    step={5}
                    value={layer.frequency}
                    onChange={(e) => updateLayer(layer.id, { frequency: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor={`freq-end-${layer.id}`} className="font-medium text-[#CBD5E1]">
                      End Pitch
                    </label>
                    <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                      {layer.frequencyEnd} Hz
                    </span>
                  </div>
                  <input
                    id={`freq-end-${layer.id}`}
                    type="range"
                    className="studio-slider"
                    min={30}
                    max={4000}
                    step={5}
                    value={layer.frequencyEnd}
                    onChange={(e) =>
                      updateLayer(layer.id, { frequencyEnd: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor={`unison-${layer.id}`} className="font-medium text-[#CBD5E1]">
                      Unison Voices
                    </label>
                    <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                      {layer.unisonVoices ?? 1}x
                    </span>
                  </div>
                  <input
                    id={`unison-${layer.id}`}
                    type="range"
                    className="studio-slider"
                    min={1}
                    max={3}
                    step={1}
                    value={layer.unisonVoices ?? 1}
                    onChange={(e) =>
                      updateLayer(layer.id, { unisonVoices: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor={`detune-${layer.id}`} className="font-medium text-[#CBD5E1]">
                      Detune
                    </label>
                    <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                      {layer.detuneCents ?? 0} ct
                    </span>
                  </div>
                  <input
                    id={`detune-${layer.id}`}
                    type="range"
                    className="studio-slider"
                    min={0}
                    max={45}
                    step={1}
                    value={layer.detuneCents ?? 0}
                    onChange={(e) =>
                      updateLayer(layer.id, { detuneCents: Number(e.target.value) })
                    }
                  />
                </div>

                {layer.type === 'fm' && (
                  <>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <label htmlFor={`harm-${layer.id}`} className="font-medium text-[#CBD5E1]">
                          Harmonicity
                        </label>
                        <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                          {layer.harmonicity.toFixed(1)}
                        </span>
                      </div>
                      <input
                        id={`harm-${layer.id}`}
                        type="range"
                        className="studio-slider"
                        min={0.5}
                        max={12}
                        step={0.5}
                        value={layer.harmonicity}
                        onChange={(e) =>
                          updateLayer(layer.id, { harmonicity: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <label htmlFor={`mod-${layer.id}`} className="font-medium text-[#CBD5E1]">
                          Mod Index
                        </label>
                        <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                          {layer.modulationIndex.toFixed(1)}
                        </span>
                      </div>
                      <input
                        id={`mod-${layer.id}`}
                        type="range"
                        className="studio-slider"
                        min={0}
                        max={24}
                        step={0.5}
                        value={layer.modulationIndex}
                        onChange={(e) =>
                          updateLayer(layer.id, { modulationIndex: Number(e.target.value) })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Filter & Mix */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor={`flt-type-${layer.id}`}
                  className="mb-1 block text-xs font-medium text-[#CBD5E1]"
                >
                  Filter Type
                </label>
                <select
                  id={`flt-type-${layer.id}`}
                  value={layer.filter.type}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      filter: { ...layer.filter, type: e.target.value as FilterShape },
                    })
                  }
                  className="w-full cursor-pointer rounded-lg border border-[#475569] bg-[#0F172A] px-2.5 py-1.5 text-sm text-[#F8FAFC]"
                >
                  <option value="lowpass">Lowpass</option>
                  <option value="bandpass">Bandpass</option>
                  <option value="highpass">Highpass</option>
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor={`flt-freq-${layer.id}`} className="font-medium text-[#CBD5E1]">
                    Filter Cutoff
                  </label>
                  <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                    {layer.filter.frequency} Hz
                  </span>
                </div>
                <input
                  id={`flt-freq-${layer.id}`}
                  type="range"
                  className="studio-slider"
                  min={80}
                  max={12000}
                  step={20}
                  value={layer.filter.frequency}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      filter: { ...layer.filter, frequency: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor={`gain-${layer.id}`} className="font-medium text-[#CBD5E1]">
                    Layer Gain
                  </label>
                  <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                    {Math.round(layer.gain * 100)}%
                  </span>
                </div>
                <input
                  id={`gain-${layer.id}`}
                  type="range"
                  className="studio-slider"
                  min={0}
                  max={1}
                  step={0.02}
                  value={layer.gain}
                  onChange={(e) => updateLayer(layer.id, { gain: Number(e.target.value) })}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor={`pan-${layer.id}`} className="font-medium text-[#CBD5E1]">
                    Stereo Pan
                  </label>
                  <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                    {layer.pan === 0
                      ? 'C'
                      : layer.pan < 0
                        ? `L ${Math.round(Math.abs(layer.pan) * 100)}`
                        : `R ${Math.round(layer.pan * 100)}`}
                  </span>
                </div>
                <input
                  id={`pan-${layer.id}`}
                  type="range"
                  className="studio-slider"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={layer.pan}
                  onChange={(e) => updateLayer(layer.id, { pan: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* ADSR Envelope */}
            <div className="mt-3 grid grid-cols-1 items-center gap-3 rounded-lg border border-[#334155]/80 bg-[#0F172A]/60 p-3 md:grid-cols-5">
              <div className="md:col-span-1">
                <AdsrVisualizer envelope={layer.envelope} />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-4">
                {(
                  [
                    { key: 'attack', label: 'Attack', min: 0.001, max: 0.5, step: 0.002 },
                    { key: 'decay', label: 'Decay', min: 0.01, max: 1.5, step: 0.01 },
                    { key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.02 },
                    { key: 'release', label: 'Release', min: 0.01, max: 1.5, step: 0.01 },
                  ] as const
                ).map((env) => (
                  <div key={env.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <label
                        htmlFor={`env-${env.key}-${layer.id}`}
                        className="font-medium text-[#CBD5E1]"
                      >
                        {env.label}
                      </label>
                      <span className="font-display font-semibold tabular-nums text-[#F8FAFC]">
                        {env.key === 'sustain'
                          ? `${Math.round(layer.envelope[env.key] * 100)}%`
                          : `${layer.envelope[env.key].toFixed(2)}s`}
                      </span>
                    </div>
                    <input
                      id={`env-${env.key}-${layer.id}`}
                      type="range"
                      className="studio-slider"
                      min={env.min}
                      max={env.max}
                      step={env.step}
                      value={layer.envelope[env.key]}
                      onChange={(e) =>
                        updateLayer(layer.id, {
                          envelope: {
                            ...layer.envelope,
                            [env.key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
