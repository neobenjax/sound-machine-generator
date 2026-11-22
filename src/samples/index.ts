import type { Playlist, SoundRecipe } from '../engine/types';
import { CARD_SAMPLES } from './cards';
import { GAME_SAMPLES } from './game';
import { MODERN_SAMPLES } from './modern';

export const BUILT_IN_PLAYLISTS: Playlist[] = [
  {
    id: 'modern',
    name: 'Modern App & Chimes',
    description: 'Vivid Duolingo-style chimes, glassy marimbas, streak blooms, and tactile modern UI cues.',
    isBuiltIn: true,
  },
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

export const BUILT_IN_SAMPLES: SoundRecipe[] = [...MODERN_SAMPLES, ...CARD_SAMPLES, ...GAME_SAMPLES];
