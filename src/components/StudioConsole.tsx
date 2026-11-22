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

          // Subtle center grid line
          ctx.strokeStyle = 'rgba(194, 211, 214, 0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          const samples = soundEngine.getWaveformData();
          ctx.strokeStyle = '#54DDF2';
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

  return (
    <section className={`console-panel ${className}`} aria-label="Sound composer console">
      <div className="surface-card console-header">
        <div className="console-title-row">
          <div style={{ flex: 1, minInlineSize: '200px' }}>
            <input
              type="text"
              className="console-name-input"
              value={recipe.name}
              onChange={(e) => onUpdateRecipe((prev) => ({ ...prev, name: e.target.value }))}
              aria-label="Sound name"
            />
            <input
              type="text"
              value={recipe.description}
              onChange={(e) => onUpdateRecipe((prev) => ({ ...prev, description: e.target.value }))}
              aria-label="Sound description"
              style={{
                display: 'block',
                inlineSize: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
                padding: '2px 0',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {recipe.isCustom && (
              <button type="button" className="btn-primary" onClick={onSaveModification} disabled={!isDirty}>
                <Save size={15} />
                <span>Save Changes</span>
              </button>
            )}
            <select
              className="select-control"
              value={targetPlaylistId}
              onChange={(e) => onChangeTargetPlaylist(e.target.value)}
              aria-label="Target playlist for saving"
              title="Target playlist when saving"
            >
              {customPlaylists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  Save to: {pl.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary" onClick={onSaveAsNew}>
              <Plus size={15} />
              <span>Save as New</span>
            </button>
            <button type="button" className="btn-icon" onClick={onReset} title="Reset modifications">
              <RotateCcw size={15} />
            </button>
            <button type="button" className="btn-icon" onClick={onExportSingle} title="Export this sound as JSON">
              <Download size={15} />
            </button>
          </div>
        </div>

        <div className="transport-bar">
          <button type="button" className="btn-pill" onClick={onPlay}>
            <Play size={16} fill="currentColor" />
            <span>Audition Sound</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onToggleLoop}
            aria-pressed={isLooping}
            style={
              isLooping
                ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-primary)', borderColor: 'var(--color-accent)' }
                : undefined
            }
          >
            <Repeat size={15} />
            <span>{isLooping ? 'Looping' : 'Loop'}</span>
          </button>

          <button type="button" className="btn-secondary" onClick={onStop}>
            <Square size={14} />
            <span>Stop</span>
          </button>

          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minInlineSize: '155px' }}>
              <span className="control-label" style={{ whiteSpace: 'nowrap' }}>
                Reverb: <strong className="control-value">{Math.round((recipe.reverbMix ?? 0) * 100)}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.02}
                value={recipe.reverbMix ?? 0}
                onChange={(e) =>
                  onUpdateRecipe((prev) => ({ ...prev, reverbMix: Number(e.target.value) }))
                }
                aria-label="Procedural stereo reverb mix"
              />
            </div>

            {(recipe.reverbMix ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minInlineSize: '150px' }}>
                <span className="control-label" style={{ whiteSpace: 'nowrap' }}>
                  Tail: <strong className="control-value">{(recipe.reverbDecaySec ?? 0.65).toFixed(2)}s</strong>
                </span>
                <input
                  type="range"
                  min={0.15}
                  max={2.5}
                  step={0.05}
                  value={recipe.reverbDecaySec ?? 0.65}
                  onChange={(e) =>
                    onUpdateRecipe((prev) => ({ ...prev, reverbDecaySec: Number(e.target.value) }))
                  }
                  aria-label="Reverb tail decay in seconds"
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minInlineSize: '170px' }}>
              <span className="control-label" style={{ whiteSpace: 'nowrap' }}>
                Master: <strong className="control-value">{recipe.masterVolumeDb} dB</strong>
              </span>
              <input
                type="range"
                min={-24}
                max={0}
                step={1}
                value={recipe.masterVolumeDb}
                onChange={(e) =>
                  onUpdateRecipe((prev) => ({ ...prev, masterVolumeDb: Number(e.target.value) }))
                }
                aria-label="Master volume in decibels"
              />
            </div>
          </div>
        </div>

        <div className="oscilloscope-wrap">
          <canvas ref={canvasRef} className="oscilloscope-canvas" width={640} height={110} />
          <span className="oscilloscope-label">REAL-TIME WEB AUDIO WAVEFORM</span>
        </div>
      </div>

      <div className="layers-section">
        <div className="section-header">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} />
            <span>Synthesis Layer Rack ({recipe.layers.length})</span>
          </h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              onUpdateRecipe((prev) => ({
                ...prev,
                layers: [...prev.layers, createDefaultLayer(prev.layers.length)],
              }))
            }
          >
            <Plus size={15} />
            <span>Add Layer</span>
          </button>
        </div>

        {recipe.layers.map((layer) => (
          <article key={layer.id} className={`surface-card layer-card ${!layer.enabled ? 'muted' : ''}`}>
            <div className="layer-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="layer-badge">{layer.type.toUpperCase()}</span>
                <input
                  type="text"
                  value={layer.name}
                  onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                  aria-label="Layer name"
                  style={{
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                    padding: '4px 8px',
                    inlineSize: '170px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => updateLayer(layer.id, { enabled: !layer.enabled })}
                  title={layer.enabled ? 'Mute layer' : 'Unmute layer'}
                  aria-pressed={!layer.enabled}
                >
                  {layer.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => updateLayer(layer.id, { solo: !layer.solo })}
                  title="Solo layer"
                  aria-pressed={layer.solo}
                  style={
                    layer.solo
                      ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-primary)' }
                      : undefined
                  }
                >
                  <Headphones size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => duplicateLayer(layer)}
                  title="Duplicate layer"
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  className="btn-icon btn-danger"
                  onClick={() => removeLayer(layer.id)}
                  disabled={recipe.layers.length <= 1}
                  title="Remove layer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="controls-grid">
              <div className="control-group">
                <label className="control-label">Generator Type</label>
                <select
                  className="select-control"
                  value={layer.type}
                  onChange={(e) => updateLayer(layer.id, { type: e.target.value as GeneratorType })}
                >
                  <option value="tone">Tone Oscillator</option>
                  <option value="noise">Noise Generator</option>
                  <option value="fm">FM Bell / Metallic</option>
                </select>
              </div>

              {layer.type === 'noise' ? (
                <div className="control-group">
                  <label className="control-label">Noise Color</label>
                  <select
                    className="select-control"
                    value={layer.noiseType}
                    onChange={(e) => updateLayer(layer.id, { noiseType: e.target.value as NoiseShape })}
                  >
                    <option value="white">White (Crisp Paper)</option>
                    <option value="pink">Pink (Soft Felt)</option>
                    <option value="brown">Brown (Warm Thud)</option>
                  </select>
                </div>
              ) : (
                <div className="control-group">
                  <label className="control-label">Waveform</label>
                  <select
                    className="select-control"
                    value={layer.oscillatorType}
                    onChange={(e) =>
                      updateLayer(layer.id, { oscillatorType: e.target.value as OscillatorShape })
                    }
                  >
                    <option value="sine">Sine (Pure / Sub)</option>
                    <option value="triangle">Triangle (Woody / Card)</option>
                    <option value="sawtooth">Sawtooth (Buzzy / Brass)</option>
                    <option value="square">Square (Retro / Chiptune)</option>
                  </select>
                </div>
              )}

              <div className="control-group">
                <label className="control-label">
                  <span>Delay Offset</span>
                  <span className="control-value">{layer.delayMs} ms</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={5}
                  value={layer.delayMs}
                  onChange={(e) => updateLayer(layer.id, { delayMs: Number(e.target.value) })}
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Duration</span>
                  <span className="control-value">{layer.durationMs} ms</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={1200}
                  step={5}
                  value={layer.durationMs}
                  onChange={(e) => updateLayer(layer.id, { durationMs: Number(e.target.value) })}
                />
              </div>

              {layer.type !== 'noise' && (
                <>
                  <div className="control-group">
                    <label className="control-label">
                      <span>Start Freq</span>
                      <span className="control-value">{Math.round(layer.frequency)} Hz</span>
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={4000}
                      step={5}
                      value={layer.frequency}
                      onChange={(e) => updateLayer(layer.id, { frequency: Number(e.target.value) })}
                    />
                  </div>

                  <div className="control-group">
                    <label className="control-label">
                      <span>End Freq (Sweep)</span>
                      <span className="control-value">{Math.round(layer.frequencyEnd)} Hz</span>
                    </label>
                    <input
                      type="range"
                      min={30}
                      max={4000}
                      step={5}
                      value={layer.frequencyEnd}
                      onChange={(e) => updateLayer(layer.id, { frequencyEnd: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}

              {layer.type === 'fm' && (
                <>
                  <div className="control-group">
                    <label className="control-label">
                      <span>Harmonicity</span>
                      <span className="control-value">{layer.harmonicity.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={8}
                      step={0.1}
                      value={layer.harmonicity}
                      onChange={(e) => updateLayer(layer.id, { harmonicity: Number(e.target.value) })}
                    />
                  </div>

                  <div className="control-group">
                    <label className="control-label">
                      <span>FM Mod Index</span>
                      <span className="control-value">{layer.modulationIndex.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={16}
                      step={0.5}
                      value={layer.modulationIndex}
                      onChange={(e) => updateLayer(layer.id, { modulationIndex: Number(e.target.value) })}
                    />
                  </div>

                  <div className="control-group">
                    <label className="control-label">
                      <span>FM Mod Decay</span>
                      <span className="control-value">{Math.round(layer.fmDecayMs ?? 120)} ms</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={600}
                      step={5}
                      value={layer.fmDecayMs ?? 120}
                      onChange={(e) => updateLayer(layer.id, { fmDecayMs: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}

              {layer.type !== 'noise' && (
                <>
                  <div className="control-group">
                    <label className="control-label">
                      <span>Unison Voices</span>
                      <span className="control-value">{layer.unisonVoices ?? 1}x</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={1}
                      value={layer.unisonVoices ?? 1}
                      onChange={(e) => updateLayer(layer.id, { unisonVoices: Number(e.target.value) })}
                    />
                  </div>

                  {(layer.unisonVoices ?? 1) > 1 && (
                    <div className="control-group">
                      <label className="control-label">
                        <span>Detune Spread</span>
                        <span className="control-value">{Math.round(layer.detuneCents ?? 10)} ct</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={layer.detuneCents ?? 10}
                        onChange={(e) => updateLayer(layer.id, { detuneCents: Number(e.target.value) })}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="control-group">
                <label className="control-label">Filter Type</label>
                <select
                  className="select-control"
                  value={layer.filter.type}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      filter: { ...layer.filter, type: e.target.value as FilterShape },
                    })
                  }
                >
                  <option value="lowpass">Lowpass</option>
                  <option value="highpass">Highpass</option>
                  <option value="bandpass">Bandpass</option>
                </select>
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Filter Cutoff</span>
                  <span className="control-value">{Math.round(layer.filter.frequency)} Hz</span>
                </label>
                <input
                  type="range"
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

              <div className="control-group">
                <label className="control-label">
                  <span>Filter Sweep End</span>
                  <span className="control-value">{Math.round(layer.filter.frequencyEnd)} Hz</span>
                </label>
                <input
                  type="range"
                  min={80}
                  max={12000}
                  step={20}
                  value={layer.filter.frequencyEnd}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      filter: { ...layer.filter, frequencyEnd: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Resonance (Q)</span>
                  <span className="control-value">{layer.filter.Q.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={0.2}
                  max={12}
                  step={0.1}
                  value={layer.filter.Q}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      filter: { ...layer.filter, Q: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Layer Gain</span>
                  <span className="control-value">{Math.round(layer.gain * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={layer.gain}
                  onChange={(e) => updateLayer(layer.id, { gain: Number(e.target.value) })}
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Stereo Pan</span>
                  <span className="control-value">{layer.pan.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={layer.pan}
                  onChange={(e) => updateLayer(layer.id, { pan: Number(e.target.value) })}
                />
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <AdsrVisualizer envelope={layer.envelope} />

              <div className="control-group">
                <label className="control-label">
                  <span>Attack</span>
                  <span className="control-value">{Math.round(layer.envelope.attack * 1000)} ms</span>
                </label>
                <input
                  type="range"
                  min={0.001}
                  max={0.4}
                  step={0.002}
                  value={layer.envelope.attack}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      envelope: { ...layer.envelope, attack: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Decay</span>
                  <span className="control-value">{Math.round(layer.envelope.decay * 1000)} ms</span>
                </label>
                <input
                  type="range"
                  min={0.005}
                  max={0.8}
                  step={0.005}
                  value={layer.envelope.decay}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      envelope: { ...layer.envelope, decay: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Sustain</span>
                  <span className="control-value">{Math.round(layer.envelope.sustain * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={layer.envelope.sustain}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      envelope: { ...layer.envelope, sustain: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="control-group">
                <label className="control-label">
                  <span>Release</span>
                  <span className="control-value">{Math.round(layer.envelope.release * 1000)} ms</span>
                </label>
                <input
                  type="range"
                  min={0.005}
                  max={1.0}
                  step={0.005}
                  value={layer.envelope.release}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      envelope: { ...layer.envelope, release: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
