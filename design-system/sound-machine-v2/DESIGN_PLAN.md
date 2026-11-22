# Sound Machine v2 — Frontend Design Plan

## 1. Visual World & Aesthetic Direction
**World:** Precision Dark-Room Audio Hardware & Developer IDE (`OLED Studio Dark`).
Rather than a generic light SaaS dashboard or neon-purple AI template, Sound Machine v2 feels like a tactile hardware-inspired digital audio workstation (DAW) paired with a crisp code editor. Surfaces are matte midnight slate (`#0F172A` / `#1B2336`), separated by 1px hairline rack borders (`#475569`), with a single disciplined **Signal Green** (`#22C55E`) accent for active audio, play/run triggers, and primary CTAs.

## 2. Core Color Tokens (from `MASTER.md`)
| Token | Hex | Role |
|---|---|---|
| `--color-background` | `#0F172A` | Primary viewport canvas |
| `--color-card` | `#1B2336` | Rack modules, panels, inspector cards |
| `--color-muted` | `#272F42` | Recessed wells, slider tracks, secondary pills |
| `--color-foreground` | `#F8FAFC` | Primary text & active values |
| `--color-muted-foreground` | `#94A3B8` | Secondary descriptions & unit labels (≥4.5:1 contrast) |
| `--color-accent` | `#22C55E` | Primary CTA, Play/Audition, Audio Ready indicator |
| `--color-border` | `#475569` | 1px structural dividers |
| `--color-destructive` | `#EF4444` | Delete / reset warnings |

## 3. Typography & Readability Rules
- **Display & Technical Headings:** `JetBrains Mono` (weights 500–700, tracking `-0.02em` max).
- **Body, Labels & Controls:** `IBM Plex Sans` (weights 400–600, base `15px`, line-height `1.5`).
- **Numbers & Telemetry:** Always `font-variant-numeric: tabular-nums` (`tabular-nums` in Tailwind) and `IBM Plex Sans` or `JetBrains Mono` at `>= 12px` (`0.75rem`) with high-contrast `#F8FAFC` / `#CBD5E1` text so frequencies (`Hz`), durations (`ms`), `dB`, and `Q` values never blur or jump.

## 4. Layout Architecture
### A. Sound Machine Studio Console (`/v2/index.html`)
```
+-----------------------------------------------------------------------+
| Global Header: Brand | [Studio | Integrate & WebMCP] | Audio | Exp/Imp |
+-----------------------------------------------------------------------+
| Mobile Tabs (390px-1023px): [Playlists] [Console] [Code]              |
+------------------+--------------------------------+-------------------+
| Playlist Rack    | Composer Console               | Code Inspector    |
| (280px)          | (1fr)                          | (400px)           |
| - Search/Filter  | - Title, Save, Target Playlist | - Tone.js         |
| - Built-in Packs | - Oscilloscope + Transport Bar | - Web Audio API   |
| - Custom Library | - Master Gain & Stereo Reverb  | - JSON Recipe     |
| - New Playlist   | - Layer Stack (ADSR + Filters) | - Copy / Download |
+------------------+--------------------------------+-------------------+
```
- **WebMCP:** Full `registerSoundMachineWebMCP` integration with all 7 tools (`list_sound_presets`, `load_sound_preset`, `compose_sound`, `tune_sound_layer`, `play_current_sound`, `export_current_sound`, `save_current_sound`) plus live WebMCP status badge in the header/guide.
- **Safety & UX:** Proper accessible confirmation modal when deleting a custom sound, `aria-label` on all icon-only controls, visible keyboard focus rings (`#22C55E` / `#FFFFFF`), and link to `./website-example/` (v2 Arcade Showcase).

### B. Sound Machine Arcade Showcase (`/v2/website-example/index.html`)
```
+-----------------------------------------------------------------------+
| Arcade Header: Brand | Last Played Pill | [Open Studio Console ->]    |
+-----------------------------------------------------------------------+
| Split Hero:                                                           |
|   Left: Headline + Value Prop + Quick Jump CTAs                       |
|   Right: Live Interactive Synth Pad & Telemetry Readout (playable)    |
+-----------------------------------------------------------------------+
| Sound Deck (Left: 8-pad tactile trigger grid | Right: Live Code View) |
+-----------------------------------------------------------------------+
| WebMCP Agent Quests (4 playable scenarios + MCP/WebAudio/Tone tabs)   |
+-----------------------------------------------------------------------+
| 5-Step Developer Integration Walkthrough (Interactive Stepper + Code)   |
+-----------------------------------------------------------------------+
| Live Treasure Chest Demo (Interactive RPG loot trigger + code toggle) |
+-----------------------------------------------------------------------+
```

## 5. Uniqueness & Anti-Slop Check against Brief
- Replaces v1's light-mode warm-paper palette with `ui-ux-pro-max`'s OLED Studio Dark + Signal Green system.
- Uses Tailwind CSS v4 (`@tailwindcss/vite`) with semantic CSS variables from `design-system/sound-machine-v2/tokens.css`.
- Eliminates all eyebrow kickers, gradient text, nested cards, and emoji icons.
- Responsive down to `390px` mobile and up to `1440px+` desktop with zero horizontal scroll.
