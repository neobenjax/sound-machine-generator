import {
  AudioWaveform,
  BookOpen,
  Download,
  ExternalLink,
  Grid,
  Piano,
  Sliders,
  Upload,
  Volume2,
} from 'lucide-react';

export type AppView = 'studio' | 'daw' | 'integrate';

interface HeaderProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  audioState: AudioContextState;
  onUnlockAudio: () => void;
  onExportLibrary: () => void;
  onImportLibrary: (file: File) => void;
  isPianoOpen: boolean;
  onTogglePiano: () => void;
  onOpenWavImport: () => void;
}

export function Header({
  activeView,
  onChangeView,
  audioState,
  onUnlockAudio,
  onExportLibrary,
  onImportLibrary,
  isPianoOpen,
  onTogglePiano,
  onOpenWavImport,
}: HeaderProps) {
  const isReady = audioState === 'running';

  return (
    <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#0F172A]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
            aria-hidden="true"
          >
            <AudioWaveform size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-base font-bold tracking-tight text-[#F8FAFC] sm:text-lg">
                Sound Machine
              </h1>
              <span className="rounded border border-[#22C55E]/40 bg-[#22C55E]/15 px-1.5 py-0.5 font-display text-[11px] font-semibold text-[#22C55E]">
                v2
              </span>
            </div>
            <p className="truncate text-xs text-[#94A3B8]">
              Procedural Web Audio &amp; Tone.js Studio
            </p>
          </div>
        </div>

        <nav
          className="flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1B2336] p-1"
          aria-label="Primary sections"
        >
          <button
            type="button"
            aria-current={activeView === 'studio' ? 'page' : undefined}
            onClick={() => onChangeView('studio')}
            className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              activeView === 'studio'
                ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                : 'text-[#CBD5E1] hover:bg-[#272F42] hover:text-[#F8FAFC]'
            }`}
          >
            <Sliders size={15} aria-hidden="true" />
            <span>Studio</span>
          </button>
          <button
            type="button"
            aria-current={activeView === 'daw' ? 'page' : undefined}
            onClick={() => onChangeView('daw')}
            className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              activeView === 'daw'
                ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                : 'text-[#CBD5E1] hover:bg-[#272F42] hover:text-[#F8FAFC]'
            }`}
          >
            <Grid size={15} aria-hidden="true" />
            <span>DAW</span>
          </button>
          <button
            type="button"
            aria-current={activeView === 'integrate' ? 'page' : undefined}
            onClick={() => onChangeView('integrate')}
            className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              activeView === 'integrate'
                ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                : 'text-[#CBD5E1] hover:bg-[#272F42] hover:text-[#F8FAFC]'
            }`}
          >
            <BookOpen size={15} aria-hidden="true" />
            <span>Integrate &amp; WebMCP</span>
          </button>
          <a
            href="./website-example/"
            className="flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-[#CBD5E1] transition-colors duration-150 hover:bg-[#272F42] hover:text-[#F8FAFC]"
          >
            <span>Arcade Demo</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePiano}
            aria-pressed={isPianoOpen}
            title="Toggle interactive piano drawer"
            className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 sm:text-sm ${
              isPianoOpen
                ? 'border-[#22C55E] bg-[#22C55E]/20 text-[#22C55E]'
                : 'border-[#475569] bg-[#1B2336] text-[#F8FAFC] hover:border-[#22C55E]/60'
            }`}
          >
            <Piano size={15} aria-hidden="true" />
            <span>Piano</span>
          </button>

          <button
            type="button"
            onClick={onOpenWavImport}
            title="Decode a .wav file into SoundLayers"
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#1B2336] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E]/60 sm:text-sm"
          >
            <AudioWaveform size={15} aria-hidden="true" />
            <span>Decode .WAV</span>
          </button>

          <button
            type="button"
            onClick={onUnlockAudio}
            title="Browser audio requires a user gesture to unlock"
            className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 sm:text-sm ${
              isReady
                ? 'border-[#22C55E]/50 bg-[#22C55E]/15 text-[#22C55E]'
                : 'border-[#475569] bg-[#1B2336] text-[#F8FAFC] hover:border-[#22C55E]/60'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                isReady ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
              }`}
              aria-hidden="true"
            />
            <Volume2 size={15} aria-hidden="true" />
            <span>{isReady ? 'Audio Ready' : 'Unlock Audio'}</span>
          </button>

          <button
            type="button"
            onClick={onExportLibrary}
            title="Export your custom playlists and sounds as JSON"
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#1B2336] px-3 py-1.5 text-xs font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#64748B] hover:bg-[#272F42] sm:text-sm"
          >
            <Download size={15} aria-hidden="true" />
            <span>Export</span>
          </button>

          <label
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#1B2336] px-3 py-1.5 text-xs font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#64748B] hover:bg-[#272F42] sm:text-sm"
            title="Import JSON sounds"
          >
            <Upload size={15} aria-hidden="true" />
            <span>Import</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportLibrary(file);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>
      </div>
    </header>
  );
}
