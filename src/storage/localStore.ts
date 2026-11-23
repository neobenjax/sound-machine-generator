import type { DawProject, DawTrack, Playlist, SoundRecipe } from '../engine/types';

const CUSTOM_SOUNDS_KEY = 'sound_machine_custom_sounds_v1';
const CUSTOM_PLAYLISTS_KEY = 'sound_machine_custom_playlists_v1';
const DAW_PROJECTS_KEY = 'sound_machine_daw_projects_v1';

export const DEFAULT_CUSTOM_PLAYLIST: Playlist = {
  id: 'custom',
  name: 'My Studio Library',
  description: 'Sounds you composed or modified, persisted in browser localStorage.',
  isBuiltIn: false,
};

export interface ExportBundle {
  version: '1.0.0';
  exportedAt: string;
  playlists: Playlist[];
  sounds: SoundRecipe[];
}

export function loadCustomSounds(): SoundRecipe[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SOUNDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSounds(sounds: SoundRecipe[]): void {
  localStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(sounds));
}

export function loadCustomPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PLAYLISTS_KEY);
    if (!raw) return [DEFAULT_CUSTOM_PLAYLIST];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [DEFAULT_CUSTOM_PLAYLIST];
    }
    return parsed;
  } catch {
    return [DEFAULT_CUSTOM_PLAYLIST];
  }
}

export function saveCustomPlaylists(playlists: Playlist[]): void {
  localStorage.setItem(CUSTOM_PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportedBundle(rawText: string): {
  playlists: Playlist[];
  sounds: SoundRecipe[];
  dawProjects: DawProject[];
} {
  const parsed = JSON.parse(rawText);
  if (Array.isArray(parsed)) {
    return { playlists: [], sounds: parsed, dawProjects: [] };
  }
  if (parsed && (Array.isArray(parsed.sounds) || Array.isArray(parsed.dawProjects))) {
    return {
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      sounds: Array.isArray(parsed.sounds) ? parsed.sounds : [],
      dawProjects: Array.isArray(parsed.dawProjects) ? parsed.dawProjects : [],
    };
  }
  if (parsed && parsed.id && Array.isArray(parsed.tracks)) {
    return { playlists: [], sounds: [], dawProjects: [parsed as DawProject] };
  }
  if (parsed && parsed.id && Array.isArray(parsed.layers)) {
    return { playlists: [], sounds: [parsed as SoundRecipe], dawProjects: [] };
  }
  throw new Error('Unrecognized Sound Machine JSON format.');
}

export function createDefaultDawTrack(
  index: number,
  recipe: SoundRecipe,
  steps: DawProject['tracks'][number]['steps'] = []
): DawTrack {
  return {
    id: `daw-track-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Track ${index + 1}`,
    recipeId: recipe.id,
    recipeSnapshot: JSON.parse(JSON.stringify(recipe)) as SoundRecipe,
    muted: false,
    solo: false,
    volumeDb: 0,
    pan: 0,
    steps,
  };
}

export function createDefaultDawProject(availableSounds: SoundRecipe[]): DawProject {
  const pick = (preferredId: string, fallbackIdx: number) =>
    availableSounds.find((s) => s.id === preferredId) ??
    availableSounds[fallbackIdx % Math.max(1, availableSounds.length)] ??
    availableSounds[0];

  const t1 = pick('modern-chime-confirm', 0);
  const t2 = pick('game-coin-pickup', 1);
  const t3 = pick('card-snap', 2);
  const t4 = pick('modern-pop-tap', 3);

  return {
    id: `daw-project-${Date.now()}`,
    name: 'Arcade Loop 01',
    bpm: 120,
    stepCount: 16,
    loop: true,
    tracks: [
      createDefaultDawTrack(0, t1, [
        { step: 0, midiNote: 60, velocity: 0.85, lengthSteps: 2 },
        { step: 4, midiNote: 64, velocity: 0.85, lengthSteps: 2 },
        { step: 8, midiNote: 67, velocity: 0.9, lengthSteps: 2 },
        { step: 12, midiNote: 72, velocity: 0.95, lengthSteps: 2 },
      ]),
      createDefaultDawTrack(1, t2, [
        { step: 2, midiNote: 72, velocity: 0.75, lengthSteps: 1 },
        { step: 10, midiNote: 76, velocity: 0.8, lengthSteps: 1 },
      ]),
      createDefaultDawTrack(2, t3, [
        { step: 0, midiNote: 60, velocity: 0.9, lengthSteps: 1 },
        { step: 4, midiNote: 60, velocity: 0.8, lengthSteps: 1 },
        { step: 8, midiNote: 60, velocity: 0.9, lengthSteps: 1 },
        { step: 12, midiNote: 60, velocity: 0.8, lengthSteps: 1 },
      ]),
      createDefaultDawTrack(3, t4, [
        { step: 2, midiNote: 60, velocity: 0.65, lengthSteps: 1 },
        { step: 6, midiNote: 60, velocity: 0.65, lengthSteps: 1 },
        { step: 10, midiNote: 60, velocity: 0.65, lengthSteps: 1 },
        { step: 14, midiNote: 60, velocity: 0.75, lengthSteps: 1 },
      ]),
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function loadDawProjects(): DawProject[] {
  try {
    const raw = localStorage.getItem(DAW_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDawProjects(projects: DawProject[]): void {
  localStorage.setItem(DAW_PROJECTS_KEY, JSON.stringify(projects));
}
