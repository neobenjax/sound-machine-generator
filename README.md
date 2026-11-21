# Sound Machine Generator

A browser-based procedural sound composer, **WebMCP** agent studio, and Web Audio code generator built with **Tone.js**, **React**, and the **Native Web Audio API**.

- **Live Studio**: https://neobenjax.github.io/sound-machine-generator/
- **Example Showcase Website**: https://neobenjax.github.io/sound-machine-generator/website-example/

## Features

- **Composer Console**: Layer `tone` (Sine, Triangle, Sawtooth, Square), `noise` (White, Pink, Brown), and `fm` synthesizers with ADSR envelopes, filter sweeps, stereo panning, and a real-time oscilloscope.
- **Built-in Sample Playlists (`src/samples/`)**:
  - **Card Table Foley**: Card Slide, Card Snap/Placement, Card Flip, Card Thud, Riffle Shuffle, Card Fan, Chip Tap, Win Cascade.
  - **Game & UI Feedback**: Winning Fanfare, Error, Failing, Sparkles, Cheers, Level Up, Coin Pickup, Soft UI Tick.
- **Code Output**: Generates copy-ready **Tone.js**, **Vanilla Web Audio API**, and **JSON** code instructions—no audio files needed.
- **LocalStorage & JSON Export/Import**: Persist custom playlists and remixes in `localStorage` and export/import `.json` bundles.
- **WebMCP Agent Ready**: Exposes `list_sound_presets`, `load_sound_preset`, `compose_sound`, `tune_sound_layer`, `play_current_sound`, `export_current_sound`, and `save_current_sound` via `document.modelContext.registerTool()`.
- **Example Website (`example-website/`)**: Interactive showcase featuring procedural Explosions, Blowing Wind, Sirens, Fanfares, Trumpets, a Short Piano Sonata, and a 5-step developer slideshow.

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

Open `http://localhost:5173/sound-machine-generator/` for the Composer Studio, or `http://localhost:5173/sound-machine-generator/website-example/` for the Example Website.

### Production Build & Preview

```bash
npm run typecheck
npm run build
npm run preview
```

### Testing WebMCP Locally in Chrome
1. Open `chrome://flags/#enable-webmcp-testing` in Chrome and set **WebMCP for testing** to **Enabled**.
2. Relaunch Chrome and open the Composer Studio.
3. Connected WebMCP agents can now discover and invoke the registered sound tools directly in the active browser tab.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on branching, design tokens, adding sound samples, and opening Pull Requests.
