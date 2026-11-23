# Sound Machine Generator

A browser-based procedural sound composer, **WebMCP** agent studio, and Web Audio code generator built with **Tone.js**, **React**, and the **Native Web Audio API**.

- **Live Studio**: https://neobenjax.github.io/sound-machine-generator/
- **Example Showcase Website (Sound Machine Arcade)**: https://neobenjax.github.io/sound-machine-generator/website-example/

## Features

- **Composer Console**: Layer `tone` (Sine, Triangle, Sawtooth, Square), `noise` (White, Pink, Brown), and `fm` synthesizers with:
  - **Unison / Detune (`1x–3x` voices, `0–50 ct` spread)** for lush stereo warmth.
  - **Dynamic FM Modulation Decay (`10–600 ms`)** for glassy marimba, chime, and bell transients.
  - **Procedural Stereo Reverb (`0%–60%` mix, `0.15s–2.50s` tail)** using an algorithmically generated impulse response (`ConvolverNode` / `Tone.Convolver`)—zero external audio files.
  - **Master Glue Compressor & Limiter** (`DynamicsCompressorNode` / `Tone.Compressor` + `Tone.Limiter`) plus a real-time oscilloscope.
- **Built-in Sample Playlists (`src/samples/`)**:
  - **Modern App & Chimes (`modern.ts`)**: Correct Answer Chime (Duolingo-style), Streak Milestone Bloom, Lesson Complete Fanfare, Gentle Nudge / Try Again, XP Gem Collect, Glassy Toggle Pop, Notification Bloom, Level Up Shimmer.
  - **Card Table Foley (`cards.ts`)**: Card Slide, Card Snap/Placement, Card Flip, Card Thud, Riffle Shuffle, Card Fan, Chip Tap, Win Cascade.
  - **Game & UI Feedback (`game.ts`)**: Winning Fanfare, Error, Failing, Sparkles, Cheers, Level Up, Coin Pickup, Soft UI Tick.
- **1:1 Code Output**: Generates copy-ready **Tone.js**, zero-dependency **Vanilla Web Audio API** (including native FM synthesis, pink/brown noise buffers, unison detune, compressor, and procedural `ConvolverNode` reverb), and **JSON** recipes.
- **DAW Workspace (1–8 Tracks)**: Pattern-based multi-track step sequencer starting with 4 tracks (min 1, max 8) using any built-in or custom `SoundRecipe` as the track instrument, with BPM (`60–200`), 16/32 steps, Mute/Solo, Volume, and live **Tone.js**, **Vanilla Web Audio API**, and **JSON** composition export.
- **Global Piano Drawer**: Slide-up interactive keyboard accessible from both **Studio** and **DAW**, with QWERTY bindings (`A`–`;`, `Z`/`X` octave shift), live `noteOn`/`noteOff` sustain, recording/playback, **Send to DAW Track**, and melody code export.
- **`.WAV` to `SoundLayer[]` DSP Decoder**: Client-side monophonic pitch, ADSR envelope, and zero-crossing noise analyzer that converts uploaded `.wav` files into pure procedural `SoundLayer[]` recipes for the Console or DAW—zero audio files kept.
- **LocalStorage & JSON Export/Import**: Persist custom playlists, remixes, and DAW projects in `localStorage`, and export/import `.json` bundles (including standalone DAW project files).
- **WebMCP Agent Ready**: Exposes 17 tools via `navigator.modelContext.registerTool()` (and `window.__soundMachineWebMCP`), including Console tools (`list_sound_presets`, `load_sound_preset`, `compose_sound`, `tune_sound_layer`, `play_current_sound`, `export_current_sound`, `save_current_sound`), DAW & Piano tools (`get_daw_project`, `configure_daw_project`, `add_daw_track`, `remove_daw_track`, `set_daw_track_steps`, `play_daw_project`, `stop_daw_project`, `export_daw_composition`, `play_piano_notes`), and the sample decoder (`analyze_audio_to_layers`).
- **Example Website (`example-website/` & `website-example/`)**: Videogame-inspired **Sound Machine Arcade** showcase featuring an interactive Sound Deck, 3 WebMCP videogame prompt quests, an **8-Track WebMCP DAW Showcase ("Neon Citadel Boss Loop")**, a 5-step developer slideshow, and a 19-layer Treasure Chest grand finale.

## How to Install

### Prerequisites
- **Node.js** `>= 20` (tested on `v22.17.1`)
- **npm** `>= 10`

### Local Setup

```bash
# 1. Clone the repository
git clone git@github.com:neobenjax/sound-machine-generator.git
cd sound-machine-generator

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev
```

Open `http://localhost:5173/sound-machine-generator/` for the Composer Studio, or `http://localhost:5173/sound-machine-generator/website-example/` for the **Sound Machine Arcade** Example Website.

### Production Build & Preview

```bash
npm run typecheck
npm run build
npm run preview
```

### Testing WebMCP Locally in Chrome
1. Open `chrome://flags/#enable-webmcp-testing` in Chrome and set **WebMCP for testing** to **Enabled**.
2. Relaunch Chrome and open the Composer Studio.
3. Connected WebMCP agents can now discover and invoke the registered sound tools directly in the active browser tab, including composing sounds with `unisonVoices`, `detuneCents`, `fmDecayMs`, `reverbMix`, and `reverbDecaySec`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on branching, design tokens, adding sound samples, and opening Pull Requests.
