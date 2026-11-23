import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Code2,
  Copy,
  Piano,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../engine/audioEngine';
import { generateMelodyCode } from '../engine/codeGenerator';
import type { PianoRecordedNote, SoundRecipe } from '../engine/types';

interface PianoDrawerProps {
  open: boolean;
  recipe: SoundRecipe;
  canSendToDaw: boolean;
  onClose: () => void;
  onSendToDawTrack: (notes: PianoRecordedNote[]) => void;
}

interface KeyDef {
  semitone: number;
  label: string;
  isBlack: boolean;
  qwerty: string;
}

const KEY_LAYOUT: KeyDef[] = [
  { semitone: 0, label: 'C', isBlack: false, qwerty: 'A' },
  { semitone: 1, label: 'C#', isBlack: true, qwerty: 'W' },
  { semitone: 2, label: 'D', isBlack: false, qwerty: 'S' },
  { semitone: 3, label: 'D#', isBlack: true, qwerty: 'E' },
  { semitone: 4, label: 'E', isBlack: false, qwerty: 'D' },
  { semitone: 5, label: 'F', isBlack: false, qwerty: 'F' },
  { semitone: 6, label: 'F#', isBlack: true, qwerty: 'T' },
  { semitone: 7, label: 'G', isBlack: false, qwerty: 'G' },
  { semitone: 8, label: 'G#', isBlack: true, qwerty: 'Y' },
  { semitone: 9, label: 'A', isBlack: false, qwerty: 'H' },
  { semitone: 10, label: 'A#', isBlack: true, qwerty: 'U' },
  { semitone: 11, label: 'B', isBlack: false, qwerty: 'J' },
  { semitone: 12, label: 'C', isBlack: false, qwerty: 'K' },
  { semitone: 13, label: 'C#', isBlack: true, qwerty: 'O' },
  { semitone: 14, label: 'D', isBlack: false, qwerty: 'L' },
  { semitone: 15, label: 'D#', isBlack: true, qwerty: 'P' },
  { semitone: 16, label: 'E', isBlack: false, qwerty: ';' },
];

export function PianoDrawer({
  open,
  recipe,
  canSendToDaw,
  onClose,
  onSendToDawTrack,
}: PianoDrawerProps) {
  const [octave, setOctave] = useState(4); // C4 = MIDI 60
  const [activeMidi, setActiveMidi] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<PianoRecordedNote[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [codeMode, setCodeMode] = useState<'webaudio' | 'tone' | 'json'>('webaudio');
  const [copied, setCopied] = useState(false);

  const recordStartRef = useRef<number>(0);
  const heldStartRef = useRef<Map<number, number>>(new Map());

  const baseMidi = (octave + 1) * 12;

  const triggerDown = useCallback(
    (midi: number) => {
      if (heldStartRef.current.has(midi)) return;
      heldStartRef.current.set(midi, performance.now());
      setActiveMidi((prev) => new Set(prev).add(midi));
      void soundEngine.noteOn(midi, recipe, 0.85);
    },
    [recipe]
  );

  const triggerUp = useCallback(
    (midi: number) => {
      const startAt = heldStartRef.current.get(midi);
      if (startAt === undefined) return;
      heldStartRef.current.delete(midi);
      setActiveMidi((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      soundEngine.noteOff(midi);

      if (isRecording) {
        const now = performance.now();
        const startMs = Math.max(0, Math.round(startAt - recordStartRef.current));
        const durationMs = Math.max(60, Math.round(now - startAt));
        setRecordedNotes((prev) => [
          ...prev,
          {
            id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            midiNote: midi,
            startMs,
            durationMs,
            velocity: 0.85,
          },
        ]);
      }
    },
    [isRecording]
  );

  useEffect(() => {
    if (!open) return;
    const keyMap = new Map<string, number>();
    for (const k of KEY_LAYOUT) {
      keyMap.set(k.qwerty.toLowerCase(), baseMidi + k.semitone);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const lower = e.key.toLowerCase();
      if (lower === 'z') {
        setOctave((o) => Math.max(2, o - 1));
        return;
      }
      if (lower === 'x') {
        setOctave((o) => Math.min(6, o + 1));
        return;
      }
      const midi = keyMap.get(lower);
      if (midi !== undefined) {
        e.preventDefault();
        triggerDown(midi);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const midi = keyMap.get(e.key.toLowerCase());
      if (midi !== undefined) {
        triggerUp(midi);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [open, baseMidi, triggerDown, triggerUp]);

  const codeText = useMemo(
    () => generateMelodyCode(recordedNotes, recipe, codeMode),
    [recordedNotes, recipe, codeMode]
  );

  if (!open) return null;

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setRecordedNotes([]);
      recordStartRef.current = performance.now();
      setIsRecording(true);
    }
  };

  const playRecording = async () => {
    if (recordedNotes.length === 0) return;
    const baseTime = performance.now();
    for (const n of recordedNotes) {
      window.setTimeout(() => {
        void soundEngine.playRecipeAtNote(recipe, n.midiNote, {
          durationMsOverride: n.durationMs,
          velocity: n.velocity,
        });
      }, n.startMs);
    }
    void baseTime;
  };

  const whiteKeys = KEY_LAYOUT.filter((k) => !k.isBlack);
  const blackKeys = KEY_LAYOUT.filter((k) => k.isBlack);

  // Position black keys relative to white keys
  const whiteIndexBefore = (semitone: number) =>
    KEY_LAYOUT.filter((k) => !k.isBlack && k.semitone < semitone).length;

  return (
    <section
      aria-label="Interactive Piano Drawer"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#334155] bg-[#1B2336]/98 px-4 py-3 shadow-2xl backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#F8FAFC]">
              <Piano size={16} className="text-[#22C55E]" />
              <span>Piano</span>
              <span className="rounded bg-[#0F172A] px-2 py-0.5 text-xs font-normal text-[#94A3B8]">
                {recipe.name}
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-[#334155] bg-[#0F172A] px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => setOctave((o) => Math.max(2, o - 1))}
                aria-label="Octave down (Z)"
                className="cursor-pointer px-1 text-[#CBD5E1] hover:text-[#22C55E]"
              >
                <ChevronDown size={14} />
              </button>
              <span className="font-mono font-semibold text-[#F8FAFC]">
                Octave C{octave}
              </span>
              <button
                type="button"
                onClick={() => setOctave((o) => Math.min(6, o + 1))}
                aria-label="Octave up (X)"
                className="cursor-pointer px-1 text-[#CBD5E1] hover:text-[#22C55E]"
              >
                <ChevronUp size={14} />
              </button>
            </div>
            <span className="hidden text-[11px] text-[#94A3B8] sm:inline">
              Keys: A–; (Z/X octave)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleRecording}
              className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                isRecording
                  ? 'border-red-500 bg-red-500/20 text-red-300'
                  : 'border-[#475569] bg-[#272F42] text-[#F8FAFC] hover:border-red-400'
              }`}
            >
              {isRecording ? <Square size={12} /> : <Circle size={12} className="text-red-400" />}
              <span>{isRecording ? 'Stop Rec' : 'Record'}</span>
            </button>

            <button
              type="button"
              disabled={recordedNotes.length === 0}
              onClick={() => void playRecording()}
              className="flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] disabled:opacity-40"
            >
              <Play size={12} />
              <span>Play ({recordedNotes.length})</span>
            </button>

            <button
              type="button"
              disabled={recordedNotes.length === 0}
              onClick={() => setRecordedNotes([])}
              className="flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#475569] bg-[#272F42] px-2 py-1 text-xs text-[#CBD5E1] hover:text-red-300 disabled:opacity-40"
              title="Clear recording"
            >
              <Trash2 size={12} />
            </button>

            {canSendToDaw && (
              <button
                type="button"
                disabled={recordedNotes.length === 0}
                onClick={() => onSendToDawTrack(recordedNotes)}
                className="flex min-h-8 cursor-pointer items-center gap-1 rounded-lg bg-[#22C55E] px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#16A34A] disabled:opacity-40"
              >
                <ArrowUpRight size={13} />
                <span>Send to DAW Track</span>
              </button>
            )}

            <button
              type="button"
              disabled={recordedNotes.length === 0}
              onClick={() => setShowCode((v) => !v)}
              className="flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] disabled:opacity-40"
            >
              <Code2 size={13} />
              <span>Code</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close piano drawer"
              className="cursor-pointer rounded-md p-1 text-[#94A3B8] hover:bg-[#272F42] hover:text-[#F8FAFC]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Optional Recorded Melody Code Panel */}
        {showCode && recordedNotes.length > 0 && (
          <div className="rounded-lg border border-[#334155] bg-[#0F172A] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {(['webaudio', 'tone', 'json'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCodeMode(m)}
                    className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium ${
                      codeMode === m
                        ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                        : 'text-[#CBD5E1] hover:bg-[#272F42]'
                    }`}
                  >
                    {m === 'webaudio' ? 'Web Audio API' : m === 'tone' ? 'Tone.js' : 'JSON'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(codeText);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
                className="flex cursor-pointer items-center gap-1 rounded border border-[#475569] bg-[#272F42] px-2 py-0.5 text-xs text-[#F8FAFC]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="max-h-40 overflow-auto font-mono text-[11px] text-[#CBD5E1]">
              <code>{codeText}</code>
            </pre>
          </div>
        )}

        {/* Piano Keyboard */}
        <div className="relative h-28 select-none overflow-hidden rounded-lg border border-[#334155] bg-[#0F172A]">
          <div className="flex h-full w-full">
            {whiteKeys.map((k) => {
              const midi = baseMidi + k.semitone;
              const pressed = activeMidi.has(midi);
              return (
                <button
                  key={k.semitone}
                  type="button"
                  onPointerDown={() => triggerDown(midi)}
                  onPointerUp={() => triggerUp(midi)}
                  onPointerLeave={() => triggerUp(midi)}
                  className={`relative flex flex-1 cursor-pointer flex-col items-center justify-end border-r border-[#334155] pb-2 transition-colors last:border-r-0 ${
                    pressed
                      ? 'bg-[#22C55E]/35 text-[#F8FAFC]'
                      : 'bg-[#E2E8F0] text-[#0F172A] hover:bg-[#CBD5E1]'
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold">{k.label}</span>
                  <span className="font-mono text-[10px] opacity-65">{k.qwerty}</span>
                </button>
              );
            })}
          </div>

          {blackKeys.map((k) => {
            const midi = baseMidi + k.semitone;
            const pressed = activeMidi.has(midi);
            const leftPct = (whiteIndexBefore(k.semitone) / whiteKeys.length) * 100;
            const widthPct = (0.62 / whiteKeys.length) * 100;
            return (
              <button
                key={k.semitone}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerDown(midi);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  triggerUp(midi);
                }}
                onPointerLeave={() => triggerUp(midi)}
                style={{
                  left: `calc(${leftPct}% - ${widthPct / 2}%)`,
                  width: `${widthPct}%`,
                }}
                className={`absolute top-0 z-10 flex h-[60%] cursor-pointer flex-col items-center justify-end rounded-b-md border border-[#334155] pb-1.5 shadow-md transition-colors ${
                  pressed
                    ? 'bg-[#22C55E] text-[#0F172A]'
                    : 'bg-[#0F172A] text-[#CBD5E1] hover:bg-[#1E293B]'
                }`}
              >
                <span className="font-mono text-[9px] font-semibold">{k.qwerty}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
