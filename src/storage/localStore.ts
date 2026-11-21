import type { Playlist, SoundRecipe } from '../engine/types';

const CUSTOM_SOUNDS_KEY = 'sound_machine_custom_sounds_v1';
const CUSTOM_PLAYLISTS_KEY = 'sound_machine_custom_playlists_v1';

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

export function parseImportedBundle(rawText: string): { playlists: Playlist[]; sounds: SoundRecipe[] } {
  const parsed = JSON.parse(rawText);
  if (Array.isArray(parsed)) {
    return { playlists: [], sounds: parsed };
  }
  if (parsed && Array.isArray(parsed.sounds)) {
    return {
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      sounds: parsed.sounds,
    };
  }
  if (parsed && parsed.id && Array.isArray(parsed.layers)) {
    return { playlists: [], sounds: [parsed as SoundRecipe] };
  }
  throw new Error('Unrecognized Sound Machine JSON format.');
}
