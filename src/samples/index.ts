import type { Playlist, SoundRecipe } from '../engine/types';
import { CARD_SAMPLES } from './cards';
import { GAME_SAMPLES } from './game';

export const BUILT_IN_PLAYLISTS: Playlist[] = [
  {
    id: 'cards',
    name: 'Card Table Foley',
    description: 'Tactile Solitaire & Blackjack sounds: slides, snaps, flips, thuds, and cascades.',
    isBuiltIn: true,
  },
  {
    id: 'game',
    name: 'Game & UI Feedback',
    description: 'Arcade & UI cues: Winning, Error, Failing, Sparkles, Cheers, and micro-ticks.',
    isBuiltIn: true,
  },
];

export const BUILT_IN_SAMPLES: SoundRecipe[] = [...CARD_SAMPLES, ...GAME_SAMPLES];
