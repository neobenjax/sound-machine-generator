import { generateToneJsCode, generateVanillaWebAudioCode } from './codeGenerator';
import type { Playlist, SoundLayer, SoundRecipe } from './types';

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

export interface SoundMachineBridgeHandlers {
  getPlaylists: () => Playlist[];
  getSounds: () => SoundRecipe[];
  getActiveRecipe: () => SoundRecipe;
  loadRecipe: (recipe: SoundRecipe) => void;
  playActive: () => Promise<number>;
  saveAsNew: () => SoundRecipe;
  downloadActiveJson: () => void;
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

export function registerSoundMachineWebMCP(handlers: SoundMachineBridgeHandlers): WebMCPStatus {
  const tools: WebMCPToolDefinition[] = [
    {
      name: 'list_sound_presets',
      description:
        'List all available sound playlists and sound recipes (built-in Card Table Foley, Game & UI Feedback, and custom saved sounds).',
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
                gain: { type: 'number' },
                pan: { type: 'number' },
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
      description: 'Tune parameters of a layer (by 0-based index) or masterVolumeDb on the active console sound.',
      inputSchema: {
        type: 'object',
        properties: {
          layerIndex: { type: 'number', description: '0-based index of the layer to modify.' },
          masterVolumeDb: { type: 'number', description: 'Optional new master volume (-24 to 0).' },
          patch: { type: 'object', description: 'Partial layer properties to update.' },
        },
      },
      execute: (args) => {
        const current = JSON.parse(JSON.stringify(handlers.getActiveRecipe())) as SoundRecipe;
        if (typeof args.masterVolumeDb === 'number') {
          current.masterVolumeDb = args.masterVolumeDb;
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
        handlers.loadRecipe(current);
        return { updated: current.name, layerCount: current.layers.length };
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

  return {
    supported: ctx !== null,
    apiSurface: surface,
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
  };
}
