import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../src/engine/audioEngine';
import type { Playlist, SoundRecipe } from '../src/engine/types';
import { registerSoundMachineWebMCP, type WebMCPStatus } from '../src/engine/webmcp';
import { BUILT_IN_PLAYLISTS, BUILT_IN_SAMPLES } from '../src/samples';
import {
  DEFAULT_CUSTOM_PLAYLIST,
  downloadJsonFile,
  loadCustomPlaylists,
  loadCustomSounds,
  parseImportedBundle,
  saveCustomPlaylists,
  saveCustomSounds,
} from '../src/storage/localStore';
import { CodeInspector } from './components/CodeInspector';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Header, type AppView } from './components/Header';
import { IntegrationGuide } from './components/IntegrationGuide';
import { PlaylistSidebar } from './components/PlaylistSidebar';
import { StudioConsole } from './components/StudioConsole';

type MobilePane = 'playlists' | 'console' | 'code';

function cloneRecipe(recipe: SoundRecipe): SoundRecipe {
  return JSON.parse(JSON.stringify(recipe)) as SoundRecipe;
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('studio');
  const [mobilePane, setMobilePane] = useState<MobilePane>('console');
  const [audioState, setAudioState] = useState<AudioContextState>(() =>
    soundEngine.getAudioState()
  );

  const [customPlaylists, setCustomPlaylists] = useState<Playlist[]>(() => loadCustomPlaylists());
  const [customSounds, setCustomSounds] = useState<SoundRecipe[]>(() => loadCustomSounds());
  const [activePlaylistId, setActivePlaylistId] = useState<string>('cards');
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>(
    () => loadCustomPlaylists()[0]?.id ?? DEFAULT_CUSTOM_PLAYLIST.id
  );

  const allPlaylists = useMemo(
    () => [...BUILT_IN_PLAYLISTS, ...customPlaylists],
    [customPlaylists]
  );

  const allSounds = useMemo(
    () => [...BUILT_IN_SAMPLES, ...customSounds],
    [customSounds]
  );

  const [baseRecipe, setBaseRecipe] = useState<SoundRecipe>(() => cloneRecipe(BUILT_IN_SAMPLES[1]));
  const [draftRecipe, setDraftRecipe] = useState<SoundRecipe>(() => cloneRecipe(BUILT_IN_SAMPLES[1]));
  const [isLooping, setIsLooping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMCPStatus | null>(null);
  const [soundPendingDelete, setSoundPendingDelete] = useState<SoundRecipe | null>(null);
  const loopTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(baseRecipe) !== JSON.stringify(draftRecipe),
    [baseRecipe, draftRecipe]
  );

  const syncAudioState = useCallback(() => {
    setAudioState(soundEngine.getAudioState());
  }, []);

  const handleUnlockAudio = useCallback(async () => {
    await soundEngine.unlock();
    syncAudioState();
    showToast('Browser AudioContext unlocked');
  }, [showToast, syncAudioState]);

  const stopLoop = useCallback(() => {
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    setIsLooping(false);
    soundEngine.stopAll();
  }, []);

  const playCurrent = useCallback(async () => {
    const durationMs = await soundEngine.playRecipe(draftRecipe);
    syncAudioState();
    return durationMs;
  }, [draftRecipe, syncAudioState]);

  useEffect(() => {
    if (!isLooping) {
      if (loopTimerRef.current !== null) {
        window.clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const dur = await soundEngine.playRecipe(draftRecipe);
      syncAudioState();
      const waitMs = Math.max(250, dur + 220);
      loopTimerRef.current = window.setTimeout(() => {
        void tick();
      }, waitMs);
    };

    void tick();

    return () => {
      cancelled = true;
      if (loopTimerRef.current !== null) {
        window.clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, [isLooping, draftRecipe, syncAudioState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && activeView === 'studio') {
        e.preventDefault();
        void playCurrent();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, playCurrent]);

  const handleSelectSound = (sound: SoundRecipe) => {
    stopLoop();
    const copy = cloneRecipe(sound);
    setBaseRecipe(copy);
    setDraftRecipe(cloneRecipe(copy));
    setMobilePane('console');
  };

  const handleQuickPlay = async (sound: SoundRecipe) => {
    await soundEngine.playRecipe(sound);
    syncAudioState();
  };

  const handleCreatePlaylist = (name: string) => {
    const id = `playlist-${Date.now()}`;
    const next: Playlist = {
      id,
      name,
      description: 'Custom user playlist stored in browser localStorage.',
      isBuiltIn: false,
    };
    const updated = [...customPlaylists, next];
    setCustomPlaylists(updated);
    saveCustomPlaylists(updated);
    setActivePlaylistId(id);
    setTargetPlaylistId(id);
    showToast(`Created playlist "${name}"`);
  };

  const handleSaveModification = () => {
    if (!draftRecipe.isCustom) return;
    const updatedSound: SoundRecipe = {
      ...cloneRecipe(draftRecipe),
      updatedAt: new Date().toISOString(),
    };
    const next = customSounds.map((s) => (s.id === updatedSound.id ? updatedSound : s));
    setCustomSounds(next);
    saveCustomSounds(next);
    setBaseRecipe(cloneRecipe(updatedSound));
    setDraftRecipe(cloneRecipe(updatedSound));
    showToast(`Saved "${updatedSound.name}"`);
  };

  const handleSaveAsNew = useCallback((): SoundRecipe => {
    const newId = `custom-${Date.now()}`;
    const suffix = draftRecipe.isCustom ? ' (Remix)' : ' (Custom)';
    const newName = draftRecipe.name.endsWith(suffix)
      ? draftRecipe.name
      : `${draftRecipe.name}${suffix}`;
    const newSound: SoundRecipe = {
      ...cloneRecipe(draftRecipe),
      id: newId,
      name: newName,
      playlistId: targetPlaylistId,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    };
    const next = [newSound, ...customSounds];
    setCustomSounds(next);
    saveCustomSounds(next);
    setBaseRecipe(cloneRecipe(newSound));
    setDraftRecipe(cloneRecipe(newSound));
    setActivePlaylistId(targetPlaylistId);
    showToast(`Saved "${newName}" to localStorage`);
    return newSound;
  }, [customSounds, draftRecipe, showToast, targetPlaylistId]);

  const confirmDeleteCustomSound = () => {
    if (!soundPendingDelete) return;
    const id = soundPendingDelete.id;
    const next = customSounds.filter((s) => s.id !== id);
    setCustomSounds(next);
    saveCustomSounds(next);
    if (draftRecipe.id === id) {
      const fallback = cloneRecipe(BUILT_IN_SAMPLES[0]);
      setBaseRecipe(fallback);
      setDraftRecipe(cloneRecipe(fallback));
    }
    setSoundPendingDelete(null);
    showToast(`Deleted "${soundPendingDelete.name}"`);
  };

  const handleExportLibrary = () => {
    downloadJsonFile('sound-machine-library.json', {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      playlists: customPlaylists,
      sounds: customSounds,
    });
    showToast('Exported custom library JSON');
  };

  const handleExportSingle = useCallback(() => {
    const slug = draftRecipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadJsonFile(`${slug || 'sound'}.json`, draftRecipe);
    showToast(`Exported "${draftRecipe.name}"`);
  }, [draftRecipe, showToast]);

  const webMcpRef = useRef({
    allPlaylists,
    allSounds,
    draftRecipe,
    playCurrent,
    handleSaveAsNew,
    handleExportSingle,
  });
  webMcpRef.current = {
    allPlaylists,
    allSounds,
    draftRecipe,
    playCurrent,
    handleSaveAsNew,
    handleExportSingle,
  };

  useEffect(() => {
    const status = registerSoundMachineWebMCP({
      getPlaylists: () => webMcpRef.current.allPlaylists,
      getSounds: () => webMcpRef.current.allSounds,
      getActiveRecipe: () => webMcpRef.current.draftRecipe,
      loadRecipe: (recipe) => {
        setBaseRecipe(cloneRecipe(recipe));
        setDraftRecipe(cloneRecipe(recipe));
        setActiveView('studio');
      },
      playActive: () => webMcpRef.current.playCurrent(),
      saveAsNew: () => webMcpRef.current.handleSaveAsNew(),
      downloadActiveJson: () => webMcpRef.current.handleExportSingle(),
    });
    setWebMcpStatus(status);
  }, []);

  const handleImportLibrary = async (file: File) => {
    try {
      const text = await file.text();
      const { playlists: importedPlaylists, sounds: importedSounds } = parseImportedBundle(text);

      const mergedPlaylists = [...customPlaylists];
      for (const pl of importedPlaylists) {
        if (!pl.isBuiltIn && !mergedPlaylists.some((existing) => existing.id === pl.id)) {
          mergedPlaylists.push(pl);
        }
      }
      setCustomPlaylists(mergedPlaylists);
      saveCustomPlaylists(mergedPlaylists);

      const existingIds = new Set(customSounds.map((s) => s.id));
      const normalizedImported = importedSounds.map((s) => ({
        ...s,
        id: existingIds.has(s.id) ? `${s.id}-import-${Date.now()}` : s.id,
        playlistId: mergedPlaylists.some((p) => p.id === s.playlistId)
          ? s.playlistId
          : targetPlaylistId,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      }));

      const nextSounds = [...normalizedImported, ...customSounds];
      setCustomSounds(nextSounds);
      saveCustomSounds(nextSounds);
      if (normalizedImported[0]) {
        handleSelectSound(normalizedImported[0]);
      }
      showToast(`Imported ${normalizedImported.length} sound(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import JSON');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#0F172A] text-[#F8FAFC]">
      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        audioState={audioState}
        onUnlockAudio={() => void handleUnlockAudio()}
        onExportLibrary={handleExportLibrary}
        onImportLibrary={(file) => void handleImportLibrary(file)}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">
        {activeView === 'studio' ? (
          <>
            <div
              className="mb-4 flex gap-1 rounded-lg border border-[#334155] bg-[#1B2336] p-1 xl:hidden"
              role="tablist"
              aria-label="Studio mobile panes"
            >
              {(
                [
                  { id: 'playlists', label: 'Playlists' },
                  { id: 'console', label: 'Console' },
                  { id: 'code', label: 'Code' },
                ] as const
              ).map((pane) => (
                <button
                  key={pane.id}
                  type="button"
                  role="tab"
                  aria-selected={mobilePane === pane.id}
                  onClick={() => setMobilePane(pane.id)}
                  className={`min-h-9 flex-1 cursor-pointer rounded-md text-sm font-medium transition-colors duration-150 ${
                    mobilePane === pane.id
                      ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                      : 'text-[#CBD5E1] hover:bg-[#272F42] hover:text-[#F8FAFC]'
                  }`}
                >
                  {pane.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)_400px]">
              <PlaylistSidebar
                playlists={allPlaylists}
                activePlaylistId={activePlaylistId}
                onSelectPlaylist={setActivePlaylistId}
                onCreatePlaylist={handleCreatePlaylist}
                sounds={allSounds}
                selectedSoundId={draftRecipe.id}
                onSelectSound={handleSelectSound}
                onQuickPlay={(s) => void handleQuickPlay(s)}
                onRequestDeleteCustomSound={setSoundPendingDelete}
                className={mobilePane !== 'playlists' ? 'hidden xl:flex' : 'flex'}
              />

              <StudioConsole
                recipe={draftRecipe}
                isDirty={isDirty}
                isLooping={isLooping}
                customPlaylists={customPlaylists}
                targetPlaylistId={targetPlaylistId}
                onChangeTargetPlaylist={setTargetPlaylistId}
                onUpdateRecipe={setDraftRecipe}
                onPlay={() => void playCurrent()}
                onStop={stopLoop}
                onToggleLoop={() => setIsLooping((v) => !v)}
                onSaveModification={handleSaveModification}
                onSaveAsNew={handleSaveAsNew}
                onReset={() => {
                  stopLoop();
                  setDraftRecipe(cloneRecipe(baseRecipe));
                  showToast('Reset to saved state');
                }}
                onExportSingle={handleExportSingle}
                className={mobilePane !== 'console' ? 'hidden xl:flex' : 'flex'}
              />

              <CodeInspector
                recipe={draftRecipe}
                className={mobilePane !== 'code' ? 'hidden xl:flex' : 'flex'}
              />
            </div>
          </>
        ) : (
          <IntegrationGuide
            activeRecipe={draftRecipe}
            allSounds={allSounds}
            webMcpStatus={webMcpStatus}
          />
        )}
      </main>

      <ConfirmDialog
        open={soundPendingDelete !== null}
        title="Delete Custom Sound?"
        description={`"${soundPendingDelete?.name ?? ''}" will be permanently removed from your browser library.`}
        confirmLabel="Delete Sound"
        onConfirm={confirmDeleteCustomSound}
        onCancel={() => setSoundPendingDelete(null)}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 bottom-4 z-50 rounded-full border border-[#22C55E]/50 bg-[#1B2336] px-4 py-2 text-sm font-medium text-[#F8FAFC] shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
