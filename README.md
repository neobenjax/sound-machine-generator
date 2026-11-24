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
- **WebMCP & Remote AI Copilot Ready**: Exposes 24 unified tools via `navigator.modelContext.registerTool()` (`window.__soundMachineWebMCP`) **and** a real-time **Remote AI Copilot** bridge (MQTT-over-WebSocket + zero-dependency MCP stdio server in `mcp-server/`) so external harness agents (Claude Code, Cursor, Codex, Antigravity) can connect to a live browser session via a temporary `sm-xxxxxxxx` Session ID:
  - **Session & Navigation**: `get_session_state`, `switch_view`, `ping_session`
  - **Console**: `list_sound_presets`, `load_sound_preset`, `compose_sound`, `tune_sound_layer`, `add_sound_layer`, `remove_sound_layer`, `play_current_sound`, `export_current_sound`, `save_current_sound`
  - **DAW**: `get_daw_project`, `configure_daw_project`, `add_daw_track`, `remove_daw_track`, `update_daw_track`, `set_daw_track_steps`, `play_daw_project`, `stop_daw_project`, `export_daw_composition`
  - **Piano & Recording**: `set_piano_drawer`, `piano_recording`, `play_piano_notes`
  - **Decoder**: `analyze_audio_to_layers`
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

### Remote AI Copilot (Claude Code, Cursor, Codex, Antigravity)

Connect any external harness AI agent to a live Sound Machine browser tab (local or GitHub Pages) in real time:

1. Open Sound Machine in your browser, click **AI Copilot** in the header, and click **Enable Access**.
2. Copy the temporary **Session ID** (e.g. `sm-a8f3k9m2`).
3. Register the zero-dependency MCP server in your AI client config:

```json
{
  "mcpServers": {
    "sound-machine": {
      "command": "node",
      "args": ["D:/AI/Vibe Coding/Sound Machine/mcp-server/index.mjs"]
    }
  }
}
```

4. Prompt your agent with the Session ID — it can inspect live state (`get_session_state`), add/edit/remove Console layers, manage DAW tracks & steps, show the Piano keyboard, play notes, and record melodies to DAW tracks while you also edit in the browser.

#### One-Shot CLI

```bash
node mcp-server/cli.mjs sm-a8f3k9m2 get_session_state
node mcp-server/cli.mjs sm-a8f3k9m2 set_piano_drawer '{"open":true,"octave":4}'
```

### Testing WebMCP Locally in Chrome
1. Open `chrome://flags/#enable-webmcp-testing` in Chrome and set **WebMCP for testing** to **Enabled**.
2. Relaunch Chrome and open the Composer Studio.
3. Connected WebMCP agents can now discover and invoke the registered sound tools directly in the active browser tab, including composing sounds with `unisonVoices`, `detuneCents`, `fmDecayMs`, `reverbMix`, and `reverbDecaySec`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on branching, design tokens, adding sound samples, and opening Pull Requests.
