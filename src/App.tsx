import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './engine/audioEngine';
import {
  RemoteAgentSession,
  type RemoteAgentActivity,
  type RemoteAgentStatus,
} from './engine/remoteAgent';
import type { DawProject, PianoRecordedNote, Playlist, SoundRecipe } from './engine/types';
import { registerSoundMachineWebMCP, type WebMCPStatus } from './engine/webmcp';
import { BUILT_IN_PLAYLISTS, BUILT_IN_SAMPLES } from './samples';
import {
  createDefaultDawProject,
  createDefaultDawTrack,
  DEFAULT_CUSTOM_PLAYLIST,
  downloadJsonFile,
  loadCustomPlaylists,
  loadCustomSounds,
  loadDawProjects,
  parseImportedBundle,
  saveCustomPlaylists,
  saveCustomSounds,
  saveDawProjects,
} from './storage/localStore';
import { CodeInspector } from './components/CodeInspector';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DawWorkspace } from './components/DawWorkspace';
import { Header, type AppView } from './components/Header';
import { IntegrationGuide } from './components/IntegrationGuide';
import { PianoDrawer } from './components/PianoDrawer';
import { PlaylistSidebar } from './components/PlaylistSidebar';
import { RemoteAgentPopover } from './components/RemoteAgentPopover';
import { StudioConsole } from './components/StudioConsole';
import { WavImportModal } from './components/WavImportModal';

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
  const [isPianoOpen, setIsPianoOpen] = useState(false);
  const [pianoOctave, setPianoOctave] = useState(4);
  const [isPianoRecording, setIsPianoRecording] = useState(false);
  const [pianoRecordedNotes, setPianoRecordedNotes] = useState<PianoRecordedNote[]>([]);
  const [pianoExternalActiveMidi, setPianoExternalActiveMidi] = useState<Set<number>>(new Set());
  const [isWavModalOpen, setIsWavModalOpen] = useState(false);
  const [isRemotePopoverOpen, setIsRemotePopoverOpen] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<RemoteAgentStatus>({
    state: 'off',
    sessionId: null,
    version: 0,
  });
  const [remoteActivities, setRemoteActivities] = useState<RemoteAgentActivity[]>([]);
  const remoteSessionRef = useRef<RemoteAgentSession | null>(null);
  const pianoRecStartRef = useRef<number>(0);

  const [dawProject, setDawProject] = useState<DawProject>(() => {
    const saved = loadDawProjects();
    return saved[0] ?? createDefaultDawProject([...BUILT_IN_SAMPLES, ...loadCustomSounds()]);
  });
  const [selectedDawTrackId, setSelectedDawTrackId] = useState<string>(
    () => dawProject.tracks[0]?.id ?? ''
  );
  const [isDawPlaying, setIsDawPlaying] = useState(false);
  const [dawStep, setDawStep] = useState(-1);

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
    const storedDaw = loadDawProjects();
    const dawProjects = [dawProject, ...storedDaw.filter((p) => p.id !== dawProject.id)];
    downloadJsonFile('sound-machine-library.json', {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      playlists: customPlaylists,
      sounds: customSounds,
      dawProjects,
    });
    showToast('Exported custom library & DAW JSON');
  };

  const handleExportSingle = useCallback(() => {
    const slug = draftRecipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadJsonFile(`${slug || 'sound'}.json`, draftRecipe);
    showToast(`Exported "${draftRecipe.name}"`);
  }, [draftRecipe, showToast]);

  const resolveDawRecipe = useCallback(
    (recipeId: string, snapshot?: SoundRecipe) =>
      allSounds.find((s) => s.id === recipeId) ?? snapshot ?? allSounds[0],
    [allSounds]
  );

  useEffect(() => {
    soundEngine.updateDawProject(dawProject, resolveDawRecipe);
  }, [dawProject, resolveDawRecipe]);

  const handleToggleDawPlay = useCallback(async () => {
    if (isDawPlaying) {
      soundEngine.stopDawPlayback();
      setIsDawPlaying(false);
      setDawStep(-1);
    } else {
      stopLoop();
      setIsDawPlaying(true);
      await soundEngine.startDawPlayback(
        dawProject,
        resolveDawRecipe,
        (step) => setDawStep(step),
        () => {
          setIsDawPlaying(false);
          setDawStep(-1);
        }
      );
      syncAudioState();
    }
  }, [dawProject, isDawPlaying, resolveDawRecipe, stopLoop, syncAudioState]);

  const handleStopDaw = useCallback(() => {
    soundEngine.stopDawPlayback();
    setIsDawPlaying(false);
    setDawStep(-1);
  }, []);

  const handleSaveDawProject = useCallback(() => {
    const existing = loadDawProjects();
    const updated: DawProject = { ...dawProject, updatedAt: new Date().toISOString() };
    const next = [updated, ...existing.filter((p) => p.id !== updated.id)];
    saveDawProjects(next);
    setDawProject(updated);
    showToast(`Saved DAW project "${updated.name}"`);
  }, [dawProject, showToast]);

  const handleSendPianoNotesToDaw = useCallback(
    (notes: PianoRecordedNote[], targetTrackIdOverride?: string) => {
      if (notes.length === 0) return;
      const targetId = targetTrackIdOverride ?? selectedDawTrackId;
      const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
      const firstStartMs = sorted[0].startMs;
      const stepMs = (60 / dawProject.bpm / 4) * 1000;
      const maxRelStep = Math.round((sorted[sorted.length - 1].startMs - firstStartMs) / stepMs);
      const targetStepCount: 16 | 32 =
        maxRelStep >= 16 || dawProject.stepCount === 32 ? 32 : 16;

      const occupied = new Set<number>();
      const mappedSteps: Array<{
        step: number;
        midiNote: number;
        velocity: number;
        lengthSteps: number;
      }> = [];

      for (const n of sorted) {
        let step = Math.max(
          0,
          Math.min(targetStepCount - 1, Math.round((n.startMs - firstStartMs) / stepMs))
        );
        while (occupied.has(step) && step < targetStepCount - 1) {
          step += 1;
        }
        if (occupied.has(step)) continue;
        occupied.add(step);
        mappedSteps.push({
          step,
          midiNote: n.midiNote,
          velocity: n.velocity,
          lengthSteps: Math.max(1, Math.min(2, Math.round(n.durationMs / stepMs))),
        });
      }

      setDawProject((prev) => ({
        ...prev,
        stepCount: targetStepCount,
        tracks: prev.tracks.map((t) =>
          t.id === targetId ? { ...t, steps: mappedSteps } : t
        ),
      }));
      setActiveView('daw');
      showToast(`Sent ${mappedSteps.length} notes to DAW track (${targetStepCount} steps)`);
      return mappedSteps.length;
    },
    [dawProject.bpm, dawProject.stepCount, selectedDawTrackId, showToast]
  );

  const webMcpRef = useRef({
    activeView,
    audioState,
    allPlaylists,
    allSounds,
    draftRecipe,
    playCurrent,
    handleSaveAsNew,
    handleExportSingle,
    dawProject,
    selectedDawTrackId,
    isDawPlaying,
    handleToggleDawPlay,
    handleStopDaw,
    resolveDawRecipe,
    isPianoOpen,
    pianoOctave,
    isPianoRecording,
    pianoRecordedNotes,
    handleSendPianoNotesToDaw,
  });
  webMcpRef.current = {
    activeView,
    audioState,
    allPlaylists,
    allSounds,
    draftRecipe,
    playCurrent,
    handleSaveAsNew,
    handleExportSingle,
    dawProject,
    selectedDawTrackId,
    isDawPlaying,
    handleToggleDawPlay,
    handleStopDaw,
    resolveDawRecipe,
    isPianoOpen,
    pianoOctave,
    isPianoRecording,
    pianoRecordedNotes,
    handleSendPianoNotesToDaw,
  };

  useEffect(() => {
    const registry = registerSoundMachineWebMCP({
      getActiveView: () => webMcpRef.current.activeView,
      setActiveView: (view) => setActiveView(view),
      getAudioState: () => webMcpRef.current.audioState,
      getPlaylists: () => webMcpRef.current.allPlaylists,
      getSounds: () => webMcpRef.current.allSounds,
      getActiveRecipe: () => webMcpRef.current.draftRecipe,
      loadRecipe: (recipe) => {
        setBaseRecipe(cloneRecipe(recipe));
        setDraftRecipe(cloneRecipe(recipe));
        setActiveView('studio');
      },
      updateActiveRecipe: (recipe) => {
        setDraftRecipe(cloneRecipe(recipe));
      },
      playActive: () => webMcpRef.current.playCurrent(),
      saveAsNew: () => webMcpRef.current.handleSaveAsNew(),
      downloadActiveJson: () => webMcpRef.current.handleExportSingle(),
      getDawProject: () => webMcpRef.current.dawProject,
      setDawProject: (proj) => setDawProject(proj),
      getSelectedDawTrackId: () => webMcpRef.current.selectedDawTrackId,
      playDawProject: async () => {
        if (!webMcpRef.current.isDawPlaying) {
          await webMcpRef.current.handleToggleDawPlay();
        }
      },
      stopDawProject: () => webMcpRef.current.handleStopDaw(),
      getPianoState: () => ({
        open: webMcpRef.current.isPianoOpen,
        octave: webMcpRef.current.pianoOctave,
        isRecording: webMcpRef.current.isPianoRecording,
        recordedNotes: webMcpRef.current.pianoRecordedNotes,
      }),
      setPianoDrawer: (open, octave) => {
        setIsPianoOpen(open);
        if (typeof octave === 'number') {
          setPianoOctave(octave);
        }
      },
      startPianoRecording: () => {
        setPianoRecordedNotes([]);
        pianoRecStartRef.current = performance.now();
        setIsPianoRecording(true);
      },
      stopPianoRecording: () => {
        setIsPianoRecording(false);
        return webMcpRef.current.pianoRecordedNotes;
      },
      clearPianoRecording: () => {
        setPianoRecordedNotes([]);
      },
      sendPianoRecordingToDaw: (trackIndex) => {
        const notes = webMcpRef.current.pianoRecordedNotes;
        if (notes.length === 0) {
          return { error: 'No recorded piano notes to send.' };
        }
        const proj = webMcpRef.current.dawProject;
        const targetTrack =
          typeof trackIndex === 'number'
            ? proj.tracks[trackIndex]
            : proj.tracks.find((t) => t.id === webMcpRef.current.selectedDawTrackId) ??
              proj.tracks[0];
        if (!targetTrack) {
          return { error: `Invalid DAW trackIndex ${trackIndex}.` };
        }
        setSelectedDawTrackId(targetTrack.id);
        const sentCount =
          webMcpRef.current.handleSendPianoNotesToDaw(notes, targetTrack.id) ?? 0;
        return {
          sentCount,
          trackName: targetTrack.name,
          stepCount: proj.stepCount,
        };
      },
      playPianoNotes: async (notes) => {
        const selectedTrack = webMcpRef.current.dawProject.tracks.find(
          (t) => t.id === webMcpRef.current.selectedDawTrackId
        );
        const recipe =
          webMcpRef.current.activeView === 'daw' && selectedTrack
            ? (webMcpRef.current.resolveDawRecipe(
                selectedTrack.recipeId,
                selectedTrack.recipeSnapshot
              ) ?? webMcpRef.current.draftRecipe)
            : webMcpRef.current.draftRecipe;
        let maxMs = 0;
        for (const n of notes) {
          const delay = Math.max(0, n.delayMs ?? 0);
          const dur = Math.max(40, n.durationMs ?? 240);
          const vel = n.velocity ?? 0.85;
          window.setTimeout(() => {
            setPianoExternalActiveMidi((prev) => new Set(prev).add(n.midiNote));
            window.setTimeout(() => {
              setPianoExternalActiveMidi((prev) => {
                const next = new Set(prev);
                next.delete(n.midiNote);
                return next;
              });
            }, dur);
            void soundEngine.playRecipeAtNote(recipe, n.midiNote, {
              durationMsOverride: dur,
              velocity: vel,
            });
            if (webMcpRef.current.isPianoRecording) {
              setPianoRecordedNotes((prev) => [
                ...prev,
                {
                  id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  midiNote: n.midiNote,
                  startMs: Math.max(0, Math.round(delay)),
                  durationMs: Math.round(dur),
                  velocity: vel,
                },
              ]);
            }
          }, delay);
          if (delay + dur > maxMs) maxMs = delay + dur;
        }
        return maxMs;
      },
    });
    setWebMcpStatus(registry.status);

    if (!remoteSessionRef.current) {
      remoteSessionRef.current = new RemoteAgentSession({
        toolExecutor: registry,
        onStatus: setRemoteStatus,
        onActivity: (entry) =>
          setRemoteActivities((prev) => [entry, ...prev].slice(0, 40)),
      });
    } else {
      remoteSessionRef.current.setToolExecutor(registry);
    }

    return () => {
      remoteSessionRef.current?.disable();
    };
  }, []);

  useEffect(() => {
    remoteSessionRef.current?.notifyUserChange('studio_recipe_updated');
  }, [draftRecipe]);

  useEffect(() => {
    remoteSessionRef.current?.notifyUserChange('daw_project_updated');
  }, [dawProject]);

  useEffect(() => {
    remoteSessionRef.current?.notifyUserChange('ui_context_updated');
  }, [activeView, isPianoOpen, pianoOctave, pianoRecordedNotes]);

  const handleEnableRemote = useCallback(
    async (customBrokerUrl?: string) => {
      await soundEngine.unlock();
      syncAudioState();
      const id = await remoteSessionRef.current?.enable(customBrokerUrl);
      if (id) {
        showToast(`Remote AI Copilot enabled (${id})`);
      }
    },
    [showToast, syncAudioState]
  );

  const handleDisableRemote = useCallback(() => {
    remoteSessionRef.current?.disable();
    showToast('Remote AI Copilot disabled');
  }, [showToast]);

  const handleImportLibrary = async (file: File) => {
    try {
      const text = await file.text();
      const {
        playlists: importedPlaylists,
        sounds: importedSounds,
        dawProjects: importedDawProjects,
      } = parseImportedBundle(text);

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

      if (normalizedImported.length > 0) {
        const nextSounds = [...normalizedImported, ...customSounds];
        setCustomSounds(nextSounds);
        saveCustomSounds(nextSounds);
        handleSelectSound(normalizedImported[0]);
      }

      if (importedDawProjects.length > 0) {
        const existingDaw = loadDawProjects();
        const mergedDaw = [
          ...importedDawProjects,
          ...existingDaw.filter((p) => !importedDawProjects.some((imp) => imp.id === p.id)),
        ];
        saveDawProjects(mergedDaw);
        const firstProj = importedDawProjects[0];
        setDawProject(firstProj);
        if (firstProj.tracks[0]) {
          setSelectedDawTrackId(firstProj.tracks[0].id);
        }
        if (normalizedImported.length === 0) {
          setActiveView('daw');
        }
      }

      if (normalizedImported.length === 0 && importedDawProjects.length === 0) {
        showToast('No custom sounds or DAW projects found in JSON');
      } else {
        const parts: string[] = [];
        if (normalizedImported.length > 0) parts.push(`${normalizedImported.length} sound(s)`);
        if (importedDawProjects.length > 0) parts.push(`${importedDawProjects.length} DAW project(s)`);
        showToast(`Imported ${parts.join(' & ')}`);
      }
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
        isPianoOpen={isPianoOpen}
        onTogglePiano={() => setIsPianoOpen((v) => !v)}
        onOpenWavImport={() => setIsWavModalOpen(true)}
        remoteState={remoteStatus.state}
        isRemotePopoverOpen={isRemotePopoverOpen}
        onToggleRemotePopover={() => setIsRemotePopoverOpen((v) => !v)}
      />

      <RemoteAgentPopover
        open={isRemotePopoverOpen}
        status={remoteStatus}
        activities={remoteActivities}
        onClose={() => setIsRemotePopoverOpen(false)}
        onEnable={handleEnableRemote}
        onDisable={handleDisableRemote}
        onOpenIntegrate={() => setActiveView('integrate')}
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
        ) : activeView === 'daw' ? (
          <DawWorkspace
            project={dawProject}
            allSounds={allSounds}
            selectedTrackId={selectedDawTrackId}
            isPlaying={isDawPlaying}
            currentStep={dawStep}
            onSelectTrack={setSelectedDawTrackId}
            onChangeProject={setDawProject}
            onTogglePlay={() => void handleToggleDawPlay()}
            onStop={handleStopDaw}
            onSaveProject={handleSaveDawProject}
            onOpenPiano={() => setIsPianoOpen(true)}
            onOpenWavImport={() => setIsWavModalOpen(true)}
          />
        ) : (
          <IntegrationGuide
            activeRecipe={draftRecipe}
            allSounds={allSounds}
            webMcpStatus={webMcpStatus}
            remoteStatus={remoteStatus}
            onOpenRemoteCopilot={() => setIsRemotePopoverOpen(true)}
          />
        )}
      </main>

      <PianoDrawer
        open={isPianoOpen}
        recipe={
          activeView === 'daw'
            ? (resolveDawRecipe(
                dawProject.tracks.find((t) => t.id === selectedDawTrackId)?.recipeId ?? '',
                dawProject.tracks.find((t) => t.id === selectedDawTrackId)?.recipeSnapshot
              ) ?? draftRecipe)
            : draftRecipe
        }
        canSendToDaw={dawProject.tracks.length > 0}
        octave={pianoOctave}
        onChangeOctave={setPianoOctave}
        isRecording={isPianoRecording}
        onToggleRecording={() => {
          if (isPianoRecording) {
            setIsPianoRecording(false);
          } else {
            setPianoRecordedNotes([]);
            pianoRecStartRef.current = performance.now();
            setIsPianoRecording(true);
          }
        }}
        recordedNotes={pianoRecordedNotes}
        onAddRecordedNote={(note) => setPianoRecordedNotes((prev) => [...prev, note])}
        onClearRecordedNotes={() => setPianoRecordedNotes([])}
        externalActiveMidi={pianoExternalActiveMidi}
        onClose={() => setIsPianoOpen(false)}
        onSendToDawTrack={(notes) => void handleSendPianoNotesToDaw(notes)}
      />

      <WavImportModal
        open={isWavModalOpen}
        onClose={() => setIsWavModalOpen(false)}
        onLoadIntoConsole={(recipe) => {
          setBaseRecipe(cloneRecipe(recipe));
          setDraftRecipe(cloneRecipe(recipe));
          setActiveView('studio');
          showToast(`Decoded "${recipe.name}" into Console`);
        }}
        onSendToDaw={(recipe) => {
          const nextSounds = [recipe, ...customSounds];
          setCustomSounds(nextSounds);
          saveCustomSounds(nextSounds);
          setDawProject((prev) => {
            if (prev.tracks.length < 8) {
              const newTrack = createDefaultDawTrack(prev.tracks.length, recipe);
              setSelectedDawTrackId(newTrack.id);
              return { ...prev, tracks: [...prev.tracks, newTrack] };
            }
            return {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === selectedDawTrackId
                  ? { ...t, recipeId: recipe.id, recipeSnapshot: recipe }
                  : t
              ),
            };
          });
          setActiveView('daw');
          showToast(`Added decoded "${recipe.name}" to DAW`);
        }}
      />

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
