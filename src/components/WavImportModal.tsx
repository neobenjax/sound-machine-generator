import { AudioWaveform, Play, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { soundEngine } from '../engine/audioEngine';
import {
  analyzeAudioArrayBufferToRecipe,
  type AudioAnalysisSummary,
} from '../engine/audioToLayers';
import type { SoundRecipe } from '../engine/types';

interface WavImportModalProps {
  open: boolean;
  onClose: () => void;
  onLoadIntoConsole: (recipe: SoundRecipe) => void;
  onSendToDaw: (recipe: SoundRecipe) => void;
}

export function WavImportModal({
  open,
  onClose,
  onLoadIntoConsole,
  onSendToDaw,
}: WavImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<{
    recipe: SoundRecipe;
    analysis: AudioAnalysisSummary;
    fileName: string;
  } | null>(null);

  if (!open) return null;

  const processFile = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'Decoded Sample';
      const result = await analyzeAudioArrayBufferToRecipe(buf, baseName);
      setDecoded({ ...result, fileName: file.name });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not decode audio: ${err.message}`
          : 'Could not decode audio file.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wav-import-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#334155] bg-[#1B2336] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AudioWaveform size={18} className="text-[#22C55E]" aria-hidden="true" />
            <h2 id="wav-import-title" className="font-display text-base font-bold text-[#F8FAFC]">
              Decode .WAV to SoundLayers
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="cursor-pointer rounded-md p-1.5 text-[#94A3B8] hover:bg-[#272F42] hover:text-[#F8FAFC]"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-[#94A3B8]">
          Upload a monophonic <code className="text-[#CBD5E1]">.wav</code> (or browser-supported audio)
          tone or SFX. The DSP analyzer extracts pitch sweep, ADSR envelope, and noise transients into
          pure procedural <code className="text-[#CBD5E1]">SoundLayer[]</code>—no audio files kept.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void processFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? 'border-[#22C55E] bg-[#22C55E]/10'
              : 'border-[#475569] bg-[#0F172A]/70 hover:border-[#22C55E]/70'
          }`}
        >
          <Upload size={22} className="mb-2 text-[#22C55E]" aria-hidden="true" />
          <p className="text-sm font-medium text-[#F8FAFC]">
            {isAnalyzing ? 'Analyzing waveform…' : 'Drop .wav file here or click to browse'}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">Best for short SFX, chimes, kicks, and synth tones</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {decoded && (
          <div className="mt-4 rounded-lg border border-[#334155] bg-[#0F172A] p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-[#F8FAFC]">
                {decoded.recipe.name}
              </span>
              <span className="rounded bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                {decoded.analysis.detectedCharacter}
              </span>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs text-[#94A3B8]">
              <div>
                Duration: <span className="text-[#F8FAFC]">{decoded.analysis.durationMs}ms</span>
              </div>
              <div>
                Pitch:{' '}
                <span className="text-[#F8FAFC]">
                  {decoded.analysis.startHz}→{decoded.analysis.endHz}Hz
                </span>
              </div>
              <div>
                Layers: <span className="text-[#F8FAFC]">{decoded.analysis.layerCount}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void soundEngine.playRecipe(decoded.recipe)}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#475569] bg-[#272F42] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E]"
              >
                <Play size={13} aria-hidden="true" />
                <span>Audition</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onLoadIntoConsole(decoded.recipe);
                  onClose();
                }}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#22C55E] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#16A34A]"
              >
                <Sparkles size={13} aria-hidden="true" />
                <span>Load in Console</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSendToDaw(decoded.recipe);
                  onClose();
                }}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#22C55E]/50 bg-[#22C55E]/15 px-3 py-1.5 text-xs font-semibold text-[#22C55E] hover:bg-[#22C55E]/25"
              >
                <span>Add to DAW Track</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
