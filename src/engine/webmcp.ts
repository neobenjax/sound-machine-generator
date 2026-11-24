import {
  analyzeAudioArrayBufferToRecipe,
  analyzePcmToSoundRecipe,
  decodeBase64ToArrayBuffer,
} from './audioToLayers';
import {
  generateDawToneJsCode,
  generateDawVanillaWebAudioCode,
  generateToneJsCode,
  generateVanillaWebAudioCode,
} from './codeGenerator';
import type {
  DawNoteStep,
  DawProject,
  PianoRecordedNote,
  Playlist,
  SoundLayer,
  SoundRecipe,
} from './types';

export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    consequentialHint?: boolean;
  };
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

interface ModelContextLike {
  registerTool: (tool: WebMCPToolDefinition) => void;
  unregisterTool?: (name: string) => void;
}

export interface WebMCPStatus {
  supported: boolean;
  apiSurface: 'document.modelContext' | 'navigator.modelContext' | 'bridge-only';
  tools: Array<{ name: string; description: string }>;
}

export interface WebMCPRegistry {
  status: WebMCPStatus;
  listTools: () => Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  executeTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
}

export interface SoundMachineBridgeHandlers {
  getActiveView: () => 'studio' | 'daw' | 'integrate';
  setActiveView: (view: 'studio' | 'daw' | 'integrate') => void;
  getAudioState: () => AudioContextState;
  getPlaylists: () => Playlist[];
  getSounds: () => SoundRecipe[];
  getActiveRecipe: () => SoundRecipe;
  loadRecipe: (recipe: SoundRecipe) => void;
  updateActiveRecipe: (recipe: SoundRecipe) => void;
  playActive: () => Promise<number>;
  saveAsNew: () => SoundRecipe;
  downloadActiveJson: () => void;
  getDawProject: () => DawProject;
  setDawProject: (project: DawProject) => void;
  getSelectedDawTrackId: () => string;
  playDawProject: () => Promise<void>;
  stopDawProject: () => void;
  getPianoState: () => {
    open: boolean;
    octave: number;
    isRecording: boolean;
    recordedNotes: PianoRecordedNote[];
  };
  setPianoDrawer: (open: boolean, octave?: number) => void;
  startPianoRecording: () => void;
  stopPianoRecording: () => PianoRecordedNote[];
  clearPianoRecording: () => void;
  sendPianoRecordingToDaw: (
    trackIndex?: number
  ) => { sentCount: number; trackName: string; stepCount: number } | { error: string };
  playPianoNotes: (
    notes: Array<{ midiNote: number; durationMs?: number; delayMs?: number; velocity?: number }>
  ) => Promise<number>;
}

function getNativeModelContext(): {
  ctx: ModelContextLike | null;
  surface: WebMCPStatus['apiSurface'];
} {
  const doc = document as unknown as { modelContext?: ModelContextLike };
  if (doc?.modelContext && typeof doc.modelContext.registerTool === 'function') {
    return { ctx: doc.modelContext, surface: 'document.modelContext' };
  }
  const nav = navigator as unknown as { modelContext?: ModelContextLike };
  if (nav?.modelContext && typeof nav.modelContext.registerTool === 'function') {
    return { ctx: nav.modelContext, surface: 'navigator.modelContext' };
  }
  return { ctx: null, surface: 'bridge-only' };
}

function normalizeLayer(raw: Partial<SoundLayer>, index: number): SoundLayer {
  return {
    id: raw.id || `webmcp-layer-${Date.now()}-${index}`,
    name: raw.name || `Layer ${index + 1}`,
    enabled: raw.enabled ?? true,
    solo: raw.solo ?? false,
    type: raw.type || 'tone',
    oscillatorType: raw.oscillatorType || 'triangle',
    noiseType: raw.noiseType || 'white',
    delayMs: Number(raw.delayMs ?? 0),
    durationMs: Number(raw.durationMs ?? 120),
    frequency: Number(raw.frequency ?? 220),
    frequencyEnd: Number(raw.frequencyEnd ?? raw.frequency ?? 110),
    pitchCurve: raw.pitchCurve || 'exponential',
    harmonicity: Number(raw.harmonicity ?? 2),
    modulationIndex: Number(raw.modulationIndex ?? 3),
    fmDecayMs: raw.fmDecayMs !== undefined ? Number(raw.fmDecayMs) : undefined,
    unisonVoices: raw.unisonVoices !== undefined ? Number(raw.unisonVoices) : 1,
    detuneCents: raw.detuneCents !== undefined ? Number(raw.detuneCents) : 0,
    envelope: {
      attack: Number(raw.envelope?.attack ?? 0.004),
      decay: Number(raw.envelope?.decay ?? 0.12),
      sustain: Number(raw.envelope?.sustain ?? 0.0),
      release: Number(raw.envelope?.release ?? 0.08),
    },
    filter: {
      type: raw.filter?.type || 'lowpass',
      frequency: Number(raw.filter?.frequency ?? 2400),
      frequencyEnd: Number(raw.filter?.frequencyEnd ?? raw.filter?.frequency ?? 800),
      Q: Number(raw.filter?.Q ?? 1.2),
    },
    gain: Number(raw.gain ?? 0.7),
    pan: Number(raw.pan ?? 0),
  };
}

export function registerSoundMachineWebMCP(handlers: SoundMachineBridgeHandlers): WebMCPRegistry {
  const tools: WebMCPToolDefinition[] = [
    {
      name: 'get_session_state',
      description:
        'Get the complete live state of the Sound Machine browser session: active view (studio/daw/integrate), audioState, active Studio sound recipe & layers, DAW project & tracks, and Piano drawer/recording state.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const activeRecipe = handlers.getActiveRecipe();
        const dawProject = handlers.getDawProject();
        const piano = handlers.getPianoState();
        return {
          activeView: handlers.getActiveView(),
          audioState: handlers.getAudioState(),
          studio: {
            id: activeRecipe.id,
            name: activeRecipe.name,
            description: activeRecipe.description,
            masterVolumeDb: activeRecipe.masterVolumeDb,
            reverbMix: activeRecipe.reverbMix ?? 0,
            reverbDecaySec: activeRecipe.reverbDecaySec ?? 0.65,
            layers: activeRecipe.layers.map((layer, index) => ({
              index,
              ...layer,
            })),
          },
          daw: {
            id: dawProject.id,
            name: dawProject.name,
            bpm: dawProject.bpm,
            stepCount: dawProject.stepCount,
            loop: dawProject.loop,
            selectedTrackId: handlers.getSelectedDawTrackId(),
            tracks: dawProject.tracks.map((t, index) => ({
              index,
              id: t.id,
              name: t.name,
              recipeId: t.recipeId,
              muted: t.muted,
              solo: t.solo,
              volumeDb: t.volumeDb,
              pan: t.pan,
              steps: t.steps,
            })),
          },
          piano: {
            open: piano.open,
            octave: piano.octave,
            isRecording: piano.isRecording,
            recordedNotesCount: piano.recordedNotes.length,
            recordedNotes: piano.recordedNotes,
          },
        };
      },
    },
    {
      name: 'switch_view',
      description: 'Switch the active UI tab in Sound Machine between studio, daw, and integrate.',
      inputSchema: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['studio', 'daw', 'integrate'] },
        },
        required: ['view'],
      },
      execute: (args) => {
        const view = args.view;
        if (view !== 'studio' && view !== 'daw' && view !== 'integrate') {
          return { error: `Invalid view "${String(view)}". Expected studio, daw, or integrate.` };
        }
        handlers.setActiveView(view);
        return { activeView: view };
      },
    },
    {
      name: 'list_sound_presets',
      description:
        'List all available sound playlists and sound recipes (built-in Modern App & Chimes, Card Table Foley, Game & UI Feedback, and custom saved sounds).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ({
        playlists: handlers.getPlaylists(),
        sounds: handlers.getSounds().map((s) => ({
          id: s.id,
          name: s.name,
          playlistId: s.playlistId,
          description: s.description,
          tags: s.tags,
          layerCount: s.layers.length,
        })),
      }),
    },
    {
      name: 'load_sound_preset',
      description: 'Load an existing sound preset into the Composer Console by id or name.',
      inputSchema: {
        type: 'object',
        properties: {
          idOrName: { type: 'string', description: 'Exact sound id or case-insensitive name.' },
        },
        required: ['idOrName'],
      },
      execute: (args) => {
        const query = String(args.idOrName || '').trim().toLowerCase();
        const match = handlers
          .getSounds()
          .find((s) => s.id.toLowerCase() === query || s.name.toLowerCase() === query);
        if (!match) {
          return { error: `Sound "${args.idOrName}" not found.` };
        }
        handlers.loadRecipe(JSON.parse(JSON.stringify(match)) as SoundRecipe);
        return { loaded: match.name, id: match.id, layers: match.layers.length };
      },
    },
    {
      name: 'compose_sound',
      description:
        'Compose a brand-new procedural sound (e.g., explosion, laser, siren, card snap) by specifying synthesis layers and load it into the Composer Console.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the new sound.' },
          description: { type: 'string', description: 'Short description of the sound.' },
          masterVolumeDb: { type: 'number', description: 'Master volume in dB (-24 to 0).' },
          reverbMix: { type: 'number', description: 'Procedural stereo reverb mix (0.0 to 0.6).' },
          reverbDecaySec: { type: 'number', description: 'Reverb tail decay in seconds (0.15 to 2.5).' },
          layers: {
            type: 'array',
            description: 'Array of synthesis layers (tone, noise, or fm).',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string', enum: ['tone', 'noise', 'fm'] },
                oscillatorType: { type: 'string', enum: ['sine', 'triangle', 'sawtooth', 'square'] },
                noiseType: { type: 'string', enum: ['white', 'pink', 'brown'] },
                delayMs: { type: 'number' },
                durationMs: { type: 'number' },
                frequency: { type: 'number' },
                frequencyEnd: { type: 'number' },
                pitchCurve: { type: 'string', enum: ['exponential', 'linear'] },
                harmonicity: { type: 'number' },
                modulationIndex: { type: 'number' },
                fmDecayMs: { type: 'number' },
                unisonVoices: { type: 'number' },
                detuneCents: { type: 'number' },
                gain: { type: 'number' },
                pan: { type: 'number' },
                envelope: { type: 'object' },
                filter: { type: 'object' },
              },
            },
          },
        },
        required: ['name', 'layers'],
      },
      execute: (args) => {
        const rawLayers = Array.isArray(args.layers) ? (args.layers as Array<Partial<SoundLayer>>) : [];
        const recipe: SoundRecipe = {
          id: `webmcp-${Date.now()}`,
          name: String(args.name || 'WebMCP Sound'),
          playlistId: 'custom',
          description: String(args.description || 'Composed via WebMCP agent tool.'),
          tags: ['webmcp', 'agent-composed'],
          masterVolumeDb: Number(args.masterVolumeDb ?? -2),
          reverbMix: args.reverbMix !== undefined ? Number(args.reverbMix) : 0,
          reverbDecaySec: args.reverbDecaySec !== undefined ? Number(args.reverbDecaySec) : 0.65,
          layers: rawLayers.length > 0 ? rawLayers.map(normalizeLayer) : [normalizeLayer({}, 0)],
          isCustom: true,
        };
        handlers.loadRecipe(recipe);
        return {
          status: 'loaded_in_console',
          name: recipe.name,
          layerCount: recipe.layers.length,
        };
      },
    },
    {
      name: 'tune_sound_layer',
      description:
        'Tune parameters of a layer (by 0-based index) or recipe-level masterVolumeDb, reverbMix, and reverbDecaySec on the active console sound.',
      inputSchema: {
        type: 'object',
        properties: {
          layerIndex: { type: 'number', description: '0-based index of the layer to modify.' },
          masterVolumeDb: { type: 'number', description: 'Optional new master volume (-24 to 0).' },
          reverbMix: { type: 'number', description: 'Optional procedural stereo reverb mix (0.0 to 0.6).' },
          reverbDecaySec: { type: 'number', description: 'Optional reverb tail decay in seconds (0.15 to 2.5).' },
          patch: {
            type: 'object',
            description:
              'Partial layer properties to update (e.g., frequency, frequencyEnd, durationMs, delayMs, gain, pan, harmonicity, modulationIndex, fmDecayMs, unisonVoices, detuneCents, envelope, filter).',
          },
        },
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getActiveRecipe())) as SoundRecipe;
        if (typeof args.masterVolumeDb === 'number') {
          current.masterVolumeDb = args.masterVolumeDb;
        }
        if (typeof args.reverbMix === 'number') {
          current.reverbMix = Math.max(0, Math.min(0.6, args.reverbMix));
        }
        if (typeof args.reverbDecaySec === 'number') {
          current.reverbDecaySec = Math.max(0.15, Math.min(2.5, args.reverbDecaySec));
        }
        if (typeof args.layerIndex === 'number' && current.layers[args.layerIndex] && args.patch) {
          const idx = args.layerIndex;
          const patch = args.patch as Partial<SoundLayer>;
          current.layers[idx] = {
            ...current.layers[idx],
            ...patch,
            envelope: { ...current.layers[idx].envelope, ...(patch.envelope || {}) },
            filter: { ...current.layers[idx].filter, ...(patch.filter || {}) },
          };
        }
        handlers.updateActiveRecipe(current);
        return { updated: current.name, layerCount: current.layers.length };
      },
    },
    {
      name: 'add_sound_layer',
      description:
        'Add a new synthesis layer (tone, noise, or fm) to the currently active Studio Console sound.',
      inputSchema: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'Optional 0-based insertion index. Omit to append at the end.',
          },
          layer: {
            type: 'object',
            description: 'Layer configuration (name, type, oscillatorType/noiseType, frequency, frequencyEnd, durationMs, delayMs, gain, pan, envelope, filter, etc.).',
          },
        },
        required: ['layer'],
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getActiveRecipe())) as SoundRecipe;
        const rawLayer = (args.layer || {}) as Partial<SoundLayer>;
        const newLayer = normalizeLayer(rawLayer, current.layers.length);
        if (
          typeof args.index === 'number' &&
          Number.isInteger(args.index) &&
          args.index >= 0 &&
          args.index <= current.layers.length
        ) {
          current.layers.splice(args.index, 0, newLayer);
        } else {
          current.layers.push(newLayer);
        }
        handlers.updateActiveRecipe(current);
        return {
          addedLayerId: newLayer.id,
          name: newLayer.name,
          layerCount: current.layers.length,
        };
      },
    },
    {
      name: 'remove_sound_layer',
      description:
        'Remove a synthesis layer from the currently active Studio Console sound by 0-based layerIndex (minimum 1 layer must remain).',
      inputSchema: {
        type: 'object',
        properties: {
          layerIndex: { type: 'number', description: '0-based index of the layer to remove.' },
        },
        required: ['layerIndex'],
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getActiveRecipe())) as SoundRecipe;
        if (current.layers.length <= 1) {
          return { error: 'Minimum of 1 layer is required.' };
        }
        const idx = Number(args.layerIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= current.layers.length) {
          return { error: `Invalid layerIndex ${args.layerIndex}.` };
        }
        const [removed] = current.layers.splice(idx, 1);
        handlers.updateActiveRecipe(current);
        return { removed: removed.name, layerCount: current.layers.length };
      },
    },
    {
      name: 'play_current_sound',
      description: 'Audition the currently loaded sound in the browser AudioContext.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const durationMs = await handlers.playActive();
        return { played: handlers.getActiveRecipe().name, durationMs };
      },
    },
    {
      name: 'export_current_sound',
      description:
        'Get the final generated sound output (Tone.js code, Vanilla Web Audio API code, and JSON recipe) for the active sound, optionally triggering a .json download.',
      inputSchema: {
        type: 'object',
        properties: {
          download: { type: 'boolean', description: 'Set true to also trigger browser JSON file download.' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: (args) => {
        const recipe = handlers.getActiveRecipe();
        if (args.download === true) {
          handlers.downloadActiveJson();
        }
        return {
          recipe,
          toneJsCode: generateToneJsCode(recipe),
          vanillaWebAudioCode: generateVanillaWebAudioCode(recipe),
          integrationHint:
            'Ask the developer which UI event (click, pointerdown, swipe, or game state transition) should trigger this sound, then paste the Tone.js or Vanilla Web Audio function into their project.',
        };
      },
    },
    {
      name: 'save_current_sound',
      description: 'Save the currently loaded sound into browser localStorage under My Studio Library.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const saved = handlers.saveAsNew();
        return { savedId: saved.id, name: saved.name, playlistId: saved.playlistId };
      },
    },
    {
      name: 'get_daw_project',
      description: 'Inspect the current DAW project (tracks 1-8, BPM, stepCount, loop, and programmed steps).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => handlers.getDawProject(),
    },
    {
      name: 'configure_daw_project',
      description:
        'Update DAW project metadata (name, bpm, stepCount 16 or 32, loop) or replace tracks (min 1, max 8 tracks).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          bpm: { type: 'number' },
          stepCount: { type: 'number', enum: [16, 32] },
          loop: { type: 'boolean' },
        },
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getDawProject())) as DawProject;
        if (typeof args.name === 'string' && args.name.trim()) current.name = args.name.trim();
        if (typeof args.bpm === 'number') current.bpm = Math.max(60, Math.min(200, args.bpm));
        if (args.stepCount === 16 || args.stepCount === 32) current.stepCount = args.stepCount;
        if (typeof args.loop === 'boolean') current.loop = args.loop;
        handlers.setDawProject(current);
        return { name: current.name, bpm: current.bpm, stepCount: current.stepCount, trackCount: current.tracks.length };
      },
    },
    {
      name: 'add_daw_track',
      description: 'Add a new track to the DAW (maximum 8 tracks) using a sound recipe id or name.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          recipeIdOrName: { type: 'string' },
        },
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getDawProject())) as DawProject;
        if (current.tracks.length >= 8) {
          return { error: 'Maximum of 8 tracks reached.' };
        }
        const sounds = handlers.getSounds();
        const query = String(args.recipeIdOrName || '').trim().toLowerCase();
        const chosen =
          sounds.find((s) => s.id.toLowerCase() === query || s.name.toLowerCase() === query) ??
          handlers.getActiveRecipe();
        const newTrack = {
          id: `daw-track-${Date.now()}-${current.tracks.length}`,
          name: String(args.name || `Track ${current.tracks.length + 1}`),
          recipeId: chosen.id,
          recipeSnapshot: JSON.parse(JSON.stringify(chosen)) as SoundRecipe,
          muted: false,
          solo: false,
          volumeDb: 0,
          pan: 0,
          steps: [],
        };
        current.tracks.push(newTrack);
        handlers.setDawProject(current);
        return { trackId: newTrack.id, name: newTrack.name, recipeId: chosen.id, trackCount: current.tracks.length };
      },
    },
    {
      name: 'remove_daw_track',
      description: 'Remove a track from the DAW by 0-based trackIndex (minimum 1 track must remain).',
      inputSchema: {
        type: 'object',
        properties: { trackIndex: { type: 'number' } },
        required: ['trackIndex'],
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getDawProject())) as DawProject;
        if (current.tracks.length <= 1) {
          return { error: 'Minimum of 1 track is required.' };
        }
        const idx = Number(args.trackIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= current.tracks.length) {
          return { error: `Invalid trackIndex ${args.trackIndex}.` };
        }
        const [removed] = current.tracks.splice(idx, 1);
        handlers.setDawProject(current);
        return { removed: removed.name, trackCount: current.tracks.length };
      },
    },
    {
      name: 'update_daw_track',
      description:
        'Modify an existing DAW track by 0-based trackIndex (rename, swap sound recipe, mute/solo, volumeDb, pan).',
      inputSchema: {
        type: 'object',
        properties: {
          trackIndex: { type: 'number', description: '0-based index of the DAW track.' },
          name: { type: 'string' },
          recipeIdOrName: { type: 'string' },
          muted: { type: 'boolean' },
          solo: { type: 'boolean' },
          volumeDb: { type: 'number' },
          pan: { type: 'number' },
        },
        required: ['trackIndex'],
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getDawProject())) as DawProject;
        const idx = Number(args.trackIndex);
        if (!Number.isInteger(idx) || !current.tracks[idx]) {
          return { error: `Invalid trackIndex ${args.trackIndex}.` };
        }
        const track = current.tracks[idx];
        if (typeof args.name === 'string' && args.name.trim()) {
          track.name = args.name.trim();
        }
        if (typeof args.recipeIdOrName === 'string' && args.recipeIdOrName.trim()) {
          const query = args.recipeIdOrName.trim().toLowerCase();
          const match = handlers
            .getSounds()
            .find((s) => s.id.toLowerCase() === query || s.name.toLowerCase() === query);
          if (!match) {
            return { error: `Sound "${args.recipeIdOrName}" not found.` };
          }
          track.recipeId = match.id;
          track.recipeSnapshot = JSON.parse(JSON.stringify(match)) as SoundRecipe;
        }
        if (typeof args.muted === 'boolean') track.muted = args.muted;
        if (typeof args.solo === 'boolean') track.solo = args.solo;
        if (typeof args.volumeDb === 'number') {
          track.volumeDb = Math.max(-24, Math.min(6, args.volumeDb));
        }
        if (typeof args.pan === 'number') {
          track.pan = Math.max(-1, Math.min(1, args.pan));
        }
        handlers.setDawProject(current);
        return {
          trackIndex: idx,
          name: track.name,
          recipeId: track.recipeId,
          muted: track.muted,
          solo: track.solo,
          volumeDb: track.volumeDb,
          pan: track.pan,
        };
      },
    },
    {
      name: 'set_daw_track_steps',
      description: 'Program note steps on a DAW track (by 0-based trackIndex).',
      inputSchema: {
        type: 'object',
        properties: {
          trackIndex: { type: 'number' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step: { type: 'number' },
                midiNote: { type: 'number' },
                velocity: { type: 'number' },
                lengthSteps: { type: 'number' },
              },
              required: ['step', 'midiNote'],
            },
          },
        },
        required: ['trackIndex', 'steps'],
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getDawProject())) as DawProject;
        const idx = Number(args.trackIndex);
        if (!current.tracks[idx]) {
          return { error: `Track index ${idx} not found.` };
        }
        const rawSteps = Array.isArray(args.steps) ? (args.steps as Array<Partial<DawNoteStep>>) : [];
        current.tracks[idx].steps = rawSteps
          .filter((s) => typeof s.step === 'number' && s.step >= 0 && s.step < current.stepCount)
          .map((s) => ({
            step: Math.floor(s.step!),
            midiNote: Math.max(21, Math.min(108, Math.round(s.midiNote ?? 60))),
            velocity: Math.max(0.1, Math.min(1, Number(s.velocity ?? 0.85))),
            lengthSteps: Math.max(1, Math.min(current.stepCount, Math.round(s.lengthSteps ?? 1))),
          }));
        handlers.setDawProject(current);
        return { track: current.tracks[idx].name, stepCount: current.tracks[idx].steps.length };
      },
    },
    {
      name: 'play_daw_project',
      description: 'Start playing the current DAW composition.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        await handlers.playDawProject();
        return { status: 'playing', name: handlers.getDawProject().name };
      },
    },
    {
      name: 'stop_daw_project',
      description: 'Stop DAW playback.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        handlers.stopDawProject();
        return { status: 'stopped' };
      },
    },
    {
      name: 'export_daw_composition',
      description: 'Export the active DAW composition as lightweight Tone.js code, Vanilla Web Audio API code, and JSON.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const project = handlers.getDawProject();
        const sounds = handlers.getSounds();
        const resolve = (id: string, snap?: SoundRecipe) =>
          sounds.find((s) => s.id === id) ?? snap ?? sounds[0];
        return {
          project,
          toneJsCode: generateDawToneJsCode(project, resolve),
          vanillaWebAudioCode: generateDawVanillaWebAudioCode(project, resolve),
        };
      },
    },
    {
      name: 'set_piano_drawer',
      description: 'Show or hide the interactive Piano Drawer keyboard and optionally set its octave (2-6).',
      inputSchema: {
        type: 'object',
        properties: {
          open: { type: 'boolean', description: 'True to show the piano keyboard, false to hide it.' },
          octave: { type: 'number', description: 'Optional octave (2 to 6, default 4).' },
        },
        required: ['open'],
      },
      execute: (args) => {
        const open = Boolean(args.open);
        const octave =
          typeof args.octave === 'number'
            ? Math.max(2, Math.min(6, Math.round(args.octave)))
            : undefined;
        handlers.setPianoDrawer(open, octave);
        const current = handlers.getPianoState();
        return {
          ...current,
          open,
          octave: octave ?? current.octave,
        };
      },
    },
    {
      name: 'piano_recording',
      description:
        'Control Piano Drawer recording: start recording, stop recording, inspect recorded notes, clear recorded notes, or send recorded notes to a DAW track.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['start', 'stop', 'get', 'clear', 'send_to_daw'],
          },
          trackIndex: {
            type: 'number',
            description: 'Optional 0-based DAW track index when action is send_to_daw.',
          },
        },
        required: ['action'],
      },
      execute: (args) => {
        const action = String(args.action || '');
        if (action === 'start') {
          handlers.setPianoDrawer(true);
          handlers.startPianoRecording();
          return { status: 'recording_started' };
        }
        if (action === 'stop') {
          const notes = handlers.stopPianoRecording();
          return { status: 'recording_stopped', recordedNotesCount: notes.length, notes };
        }
        if (action === 'get') {
          const state = handlers.getPianoState();
          return {
            isRecording: state.isRecording,
            recordedNotesCount: state.recordedNotes.length,
            notes: state.recordedNotes,
          };
        }
        if (action === 'clear') {
          handlers.clearPianoRecording();
          return { status: 'cleared' };
        }
        if (action === 'send_to_daw') {
          const trackIndex =
            typeof args.trackIndex === 'number' ? Math.floor(args.trackIndex) : undefined;
          return handlers.sendPianoRecordingToDaw(trackIndex);
        }
        return { error: `Unknown piano_recording action "${action}".` };
      },
    },
    {
      name: 'play_piano_notes',
      description:
        'Play a sequence of MIDI notes using the active recipe (or selected DAW track recipe in DAW view). Visually highlights keys when the Piano Drawer is open and records notes if recording is active.',
      inputSchema: {
        type: 'object',
        properties: {
          openDrawer: {
            type: 'boolean',
            description: 'Set true to open the Piano Drawer while playing notes.',
          },
          notes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                midiNote: { type: 'number' },
                durationMs: { type: 'number' },
                delayMs: { type: 'number' },
                velocity: { type: 'number' },
              },
              required: ['midiNote'],
            },
          },
        },
        required: ['notes'],
      },
      execute: async (args) => {
        if (args.openDrawer === true) {
          handlers.setPianoDrawer(true);
        }
        const notes = Array.isArray(args.notes)
          ? (args.notes as Array<{
              midiNote: number;
              durationMs?: number;
              delayMs?: number;
              velocity?: number;
            }>)
          : [];
        const totalMs = await handlers.playPianoNotes(notes);
        return { playedNotes: notes.length, totalMs };
      },
    },
    {
      name: 'analyze_audio_to_layers',
      description:
        'Decode a monophonic .wav / audio base64 string (or raw PCM float array + sampleRate) into procedural SoundLayer[] and return a ready-to-import SoundRecipe JSON + Tone.js / Web Audio code.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional name for the decoded sound.' },
          audioBase64: { type: 'string', description: 'Base64 or data URL of a .wav/audio file.' },
          pcmSamples: { type: 'array', items: { type: 'number' }, description: 'Optional raw mono PCM float samples (-1..1).' },
          sampleRate: { type: 'number', description: 'Sample rate when passing pcmSamples (default 44100).' },
          loadInConsole: { type: 'boolean', description: 'Set true to immediately load the decoded recipe into the Console.' },
        },
      },
      execute: async (args) => {
        const name = String(args.name || 'Decoded Sample');
        let result;
        if (typeof args.audioBase64 === 'string' && args.audioBase64.trim().length > 0) {
          const buf = decodeBase64ToArrayBuffer(args.audioBase64);
          result = await analyzeAudioArrayBufferToRecipe(buf, name);
        } else if (Array.isArray(args.pcmSamples) && args.pcmSamples.length > 0) {
          const sr = typeof args.sampleRate === 'number' ? args.sampleRate : 44100;
          result = analyzePcmToSoundRecipe(new Float32Array(args.pcmSamples as number[]), sr, name);
        } else {
          return { error: 'Provide either audioBase64 or pcmSamples.' };
        }

        if (args.loadInConsole !== false) {
          handlers.loadRecipe(result.recipe);
        }
        return {
          recipe: result.recipe,
          analysis: result.analysis,
          toneJsCode: generateToneJsCode(result.recipe),
          vanillaWebAudioCode: generateVanillaWebAudioCode(result.recipe),
        };
      },
    },
  ];

  const { ctx, surface } = getNativeModelContext();

  if (ctx) {
    for (const tool of tools) {
      try {
        ctx.unregisterTool?.(tool.name);
        ctx.registerTool(tool);
      } catch {
        // Ignore duplicate registration errors across hot reloads
      }
    }
  }

  // Expose an inspection & fallback bridge on window for testing & agent tooling
  (window as unknown as { __soundMachineWebMCP?: unknown }).__soundMachineWebMCP = {
    apiSurface: surface,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      execute: t.execute,
    })),
  };

  const status: WebMCPStatus = {
    supported: ctx !== null,
    apiSurface: surface,
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
  };

  return {
    status,
    listTools: () =>
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    executeTool: async (name: string, args: Record<string, unknown> = {}) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        throw new Error(`Unknown Sound Machine tool: ${name}`);
      }
      return await tool.execute(args);
    },
  };
}
