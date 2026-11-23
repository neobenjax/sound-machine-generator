import {
  AudioWaveform,
  Check,
  Code2,
  Copy,
  Download,
  Piano,
  Play,
  Plus,
  Repeat,
  Save,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { soundEngine } from '../engine/audioEngine';
import {
  generateDawToneJsCode,
  generateDawVanillaWebAudioCode,
} from '../engine/codeGenerator';
import type { DawProject, DawTrack, SoundRecipe } from '../engine/types';
import { createDefaultDawTrack, downloadJsonFile } from '../storage/localStore';

interface DawWorkspaceProps {
  project: DawProject;
  allSounds: SoundRecipe[];
  selectedTrackId: string;
  isPlaying: boolean;
  currentStep: number;
  onSelectTrack: (trackId: string) => void;
  onChangeProject: (updater: (prev: DawProject) => DawProject) => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onSaveProject: () => void;
  onOpenPiano: () => void;
  onOpenWavImport: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function formatMidi(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

const PAINT_NOTES = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 79];

export function DawWorkspace({
  project,
  allSounds,
  selectedTrackId,
  isPlaying,
  currentStep,
  onSelectTrack,
  onChangeProject,
  onTogglePlay,
  onStop,
  onSaveProject,
  onOpenPiano,
  onOpenWavImport,
}: DawWorkspaceProps) {
  const [paintMidi, setPaintMidi] = useState<number>(60);
  const [codeMode, setCodeMode] = useState<'webaudio' | 'tone' | 'json'>('webaudio');
  const [copied, setCopied] = useState(false);

  const resolveRecipe = (recipeId: string, snapshot?: SoundRecipe): SoundRecipe | undefined =>
    allSounds.find((s) => s.id === recipeId) ?? snapshot ?? allSounds[0];

  const codeText = useMemo(() => {
    if (codeMode === 'tone') return generateDawToneJsCode(project, resolveRecipe);
    if (codeMode === 'webaudio') return generateDawVanillaWebAudioCode(project, resolveRecipe);
    return JSON.stringify(project, null, 2);
  }, [codeMode, project, allSounds]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleAddTrack = () => {
    if (project.tracks.length >= 8) return;
    const defaultRecipe = allSounds[project.tracks.length % allSounds.length] ?? allSounds[0];
    if (!defaultRecipe) return;
    const newTrack = createDefaultDawTrack(project.tracks.length, defaultRecipe);
    onChangeProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
    onSelectTrack(newTrack.id);
  };

  const handleDeleteTrack = (trackId: string) => {
    if (project.tracks.length <= 1) return;
    onChangeProject((prev) => {
      const remaining = prev.tracks.filter((t) => t.id !== trackId);
      if (selectedTrackId === trackId && remaining[0]) {
        onSelectTrack(remaining[0].id);
      }
      return { ...prev, tracks: remaining };
    });
  };

  const updateTrack = (trackId: string, updater: (t: DawTrack) => DawTrack) => {
    onChangeProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? updater(t) : t)),
    }));
  };

  const toggleStep = (track: DawTrack, stepIdx: number) => {
    const existing = track.steps.find((s) => s.step === stepIdx);
    if (existing) {
      updateTrack(track.id, (t) => ({
        ...t,
        steps: t.steps.filter((s) => s.step !== stepIdx),
      }));
    } else {
      const recipe = resolveRecipe(track.recipeId, track.recipeSnapshot);
      if (recipe) {
        void soundEngine.playRecipeAtNote(recipe, paintMidi, {
          velocity: 0.85,
          trackVolumeDb: track.volumeDb,
          trackPan: track.pan,
        });
      }
      updateTrack(track.id, (t) => ({
        ...t,
        steps: [
          ...t.steps,
          { step: stepIdx, midiNote: paintMidi, velocity: 0.85, lengthSteps: 1 },
        ].sort((a, b) => a.step - b.step),
      }));
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="flex flex-col gap-4 rounded-xl border border-[#334155] bg-[#1B2336] p-4 sm:p-5">
        {/* Transport & Project Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155] pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={project.name}
              onChange={(e) =>
                onChangeProject((prev) => ({ ...prev, name: e.target.value }))
              }
              aria-label="DAW project name"
              className="w-44 rounded-lg border border-[#475569] bg-[#0F172A] px-3 py-1.5 font-display text-sm font-semibold text-[#F8FAFC] focus:border-[#22C55E] focus:outline-none"
            />
            <button
              type="button"
              onClick={onTogglePlay}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#22C55E] px-3.5 py-1.5 text-sm font-semibold text-[#0F172A] hover:bg-[#16A34A]"
            >
              {isPlaying ? <Square size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Stop' : 'Play'}</span>
            </button>
            {isPlaying && (
              <button
                type="button"
                onClick={onStop}
                className="flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-[#475569] bg-[#272F42] px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-[#F8FAFC]"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onChangeProject((prev) => ({ ...prev, loop: !prev.loop }))
              }
              aria-pressed={project.loop}
              className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                project.loop
                  ? 'border-[#22C55E]/60 bg-[#22C55E]/15 text-[#22C55E]'
                  : 'border-[#475569] bg-[#272F42] text-[#94A3B8]'
              }`}
            >
              <Repeat size={13} />
              <span>Loop</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#0F172A] px-2.5 py-1.5 text-xs text-[#94A3B8]">
              <span>BPM</span>
              <input
                type="number"
                min={60}
                max={200}
                value={project.bpm}
                onChange={(e) =>
                  onChangeProject((prev) => ({
                    ...prev,
                    bpm: Math.max(60, Math.min(200, Number(e.target.value) || 120)),
                  }))
                }
                className="w-12 bg-transparent font-mono font-semibold text-[#F8FAFC] focus:outline-none"
              />
            </label>

            <div className="flex rounded-lg border border-[#334155] bg-[#0F172A] p-0.5 text-xs">
              {([16, 32] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() =>
                    onChangeProject((prev) => ({ ...prev, stepCount: count }))
                  }
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-medium ${
                    project.stepCount === count
                      ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {count} Steps
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenPiano}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#272F42] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E]"
            >
              <Piano size={14} />
              <span>Piano</span>
            </button>

            <button
              type="button"
              onClick={onOpenWavImport}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#272F42] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E]"
            >
              <AudioWaveform size={14} />
              <span>Decode .WAV</span>
            </button>

            <button
              type="button"
              onClick={onSaveProject}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#22C55E]/50 bg-[#22C55E]/15 px-3 py-1.5 text-xs font-semibold text-[#22C55E] hover:bg-[#22C55E]/25"
            >
              <Save size={14} />
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Paint Note Selector + Track Count */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-[#94A3B8]">Step Pitch:</span>
            {PAINT_NOTES.map((midi) => (
              <button
                key={midi}
                type="button"
                onClick={() => setPaintMidi(midi)}
                className={`cursor-pointer rounded px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  paintMidi === midi
                    ? 'bg-[#22C55E] text-[#0F172A]'
                    : 'border border-[#334155] bg-[#0F172A] text-[#CBD5E1] hover:border-[#475569]'
                }`}
              >
                {formatMidi(midi)}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={project.tracks.length >= 8}
            onClick={handleAddTrack}
            className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#272F42] px-3 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus size={14} />
            <span>Add Track ({project.tracks.length}/8)</span>
          </button>
        </div>

        {/* Tracks Sequencer */}
        <div className="flex flex-col gap-3 overflow-x-auto">
          {project.tracks.map((track) => {
            const isSelected = track.id === selectedTrackId;
            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                className={`flex flex-col gap-2.5 rounded-xl border p-3 transition-colors ${
                  isSelected
                    ? 'border-[#22C55E]/70 bg-[#0F172A]/95'
                    : 'border-[#334155] bg-[#0F172A]/65 hover:border-[#475569]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) =>
                        updateTrack(track.id, (t) => ({ ...t, name: e.target.value }))
                      }
                      aria-label="Track name"
                      className="w-28 rounded border border-[#334155] bg-[#1B2336] px-2 py-1 text-xs font-semibold text-[#F8FAFC] focus:border-[#22C55E] focus:outline-none"
                    />
                    <select
                      value={track.recipeId}
                      onChange={(e) => {
                        const chosen = allSounds.find((s) => s.id === e.target.value);
                        updateTrack(track.id, (t) => ({
                          ...t,
                          recipeId: e.target.value,
                          recipeSnapshot: chosen
                            ? (JSON.parse(JSON.stringify(chosen)) as SoundRecipe)
                            : t.recipeSnapshot,
                        }));
                      }}
                      aria-label="Track sound recipe"
                      className="max-w-[200px] rounded border border-[#334155] bg-[#1B2336] px-2 py-1 text-xs text-[#CBD5E1] focus:border-[#22C55E] focus:outline-none"
                    >
                      {allSounds.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(track.id, (t) => ({ ...t, muted: !t.muted }));
                      }}
                      className={`cursor-pointer rounded px-2 py-1 text-[11px] font-bold ${
                        track.muted
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-[#1B2336] text-[#94A3B8] border border-[#334155]'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(track.id, (t) => ({ ...t, solo: !t.solo }));
                      }}
                      className={`cursor-pointer rounded px-2 py-1 text-[11px] font-bold ${
                        track.solo
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#1B2336] text-[#94A3B8] border border-[#334155]'
                      }`}
                    >
                      S
                    </button>
                    <label className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                      <Volume2 size={12} />
                      <input
                        type="range"
                        min={-24}
                        max={6}
                        step={1}
                        value={track.volumeDb}
                        onChange={(e) =>
                          updateTrack(track.id, (t) => ({
                            ...t,
                            volumeDb: Number(e.target.value),
                          }))
                        }
                        className="w-16 accent-[#22C55E]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={project.tracks.length <= 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrack(track.id);
                      }}
                      title={
                        project.tracks.length <= 1
                          ? 'Minimum 1 track required'
                          : 'Delete track'
                      }
                      className="cursor-pointer rounded p-1 text-[#94A3B8] hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Step Grid */}
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${project.stepCount}, minmax(26px, 1fr))`,
                  }}
                >
                  {Array.from({ length: project.stepCount }, (_, stepIdx) => {
                    const note = track.steps.find((s) => s.step === stepIdx);
                    const isPlayhead = currentStep === stepIdx;
                    const isBeatStart = stepIdx % 4 === 0;
                    return (
                      <button
                        key={stepIdx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStep(track, stepIdx);
                        }}
                        title={
                          note
                            ? `Step ${stepIdx + 1}: ${formatMidi(note.midiNote)} (click to remove)`
                            : `Step ${stepIdx + 1}: click to add ${formatMidi(paintMidi)}`
                        }
                        className={`flex h-9 cursor-pointer flex-col items-center justify-center rounded border font-mono text-[10px] font-semibold transition-all ${
                          note
                            ? 'border-[#22C55E] bg-[#22C55E]/25 text-[#F8FAFC]'
                            : isBeatStart
                              ? 'border-[#475569] bg-[#1B2336] text-[#64748B] hover:border-[#22C55E]/60'
                              : 'border-[#334155]/70 bg-[#141B2D] text-[#475569] hover:border-[#22C55E]/60'
                        } ${isPlayhead ? 'ring-2 ring-[#22C55E]' : ''}`}
                      >
                        {note ? formatMidi(note.midiNote) : stepIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Right Panel: DAW Generated Code Inspector */}
      <aside
        className="flex flex-col overflow-hidden rounded-xl border border-[#334155] bg-[#1B2336]"
        aria-label="Generated DAW composition code"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#334155] bg-[#0F172A]/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-[#22C55E]" aria-hidden="true" />
            <span className="font-display text-sm font-semibold text-[#F8FAFC]">
              DAW Export Code
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                downloadJsonFile(`${slug || 'daw-project'}.json`, project);
              }}
              title="Download DAW project as JSON"
              className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] hover:text-[#22C55E]"
            >
              <Download size={14} />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] hover:text-[#22C55E]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-[#334155] bg-[#1B2336] px-3 py-2">
          {(
            [
              { id: 'webaudio', label: 'Web Audio API' },
              { id: 'tone', label: 'Tone.js' },
              { id: 'json', label: 'JSON' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCodeMode(tab.id)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium ${
                codeMode === tab.id
                  ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                  : 'text-[#CBD5E1] hover:bg-[#272F42]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <pre className="max-h-[640px] overflow-auto bg-[#0F172A] p-4 font-mono text-xs leading-relaxed text-[#CBD5E1]">
          <code>{codeText}</code>
        </pre>
      </aside>
    </div>
  );
}
