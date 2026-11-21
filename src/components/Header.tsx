import { AudioWaveform, BookOpen, Download, Sliders, Upload, Volume2 } from 'lucide-react';

export type AppView = 'studio' | 'integrate';

interface HeaderProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  audioState: AudioContextState;
  onUnlockAudio: () => void;
  onExportLibrary: () => void;
  onImportLibrary: (file: File) => void;
}

export function Header({
  activeView,
  onChangeView,
  audioState,
  onUnlockAudio,
  onExportLibrary,
  onImportLibrary,
}: HeaderProps) {
  const isReady = audioState === 'running';

  return (
    <header className="global-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <AudioWaveform size={22} />
          </div>
          <div>
            <h1 className="brand-title">Sound Machine</h1>
            <p className="brand-subtitle">Procedural Web Audio &amp; Tone.js Studio</p>
          </div>
        </div>

        <nav className="header-nav" aria-label="Primary sections">
          <button
            type="button"
            className="nav-tab"
            aria-selected={activeView === 'studio'}
            onClick={() => onChangeView('studio')}
          >
            <Sliders size={16} />
            <span>Composer Studio</span>
          </button>
          <button
            type="button"
            className="nav-tab"
            aria-selected={activeView === 'integrate'}
            onClick={() => onChangeView('integrate')}
          >
            <BookOpen size={16} />
            <span>Integrate &amp; AI Guide</span>
          </button>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className={`audio-status-btn ${isReady ? 'ready' : ''}`}
            onClick={onUnlockAudio}
            title="Browser audio requires a user gesture to unlock"
          >
            <span className="status-dot" />
            <Volume2 size={14} />
            <span>{isReady ? 'Audio Ready' : 'Unlock Audio'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onExportLibrary}
            title="Export your custom playlists and sounds as JSON"
          >
            <Download size={16} />
            <span>Export</span>
          </button>

          <label className="btn-secondary" style={{ cursor: 'pointer' }} title="Import JSON sounds">
            <Upload size={16} />
            <span>Import</span>
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
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
