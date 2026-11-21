# Contributing to Sound Machine Generator

Thank you for helping improve **Sound Machine Generator**! Please follow these guidelines when collaborating on this repository.

## 1. Branching & Pull Request Workflow

1. Always branch from the latest `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   ```
   Use descriptive branch prefixes: `feat/`, `fix/`, `docs/`, or `chore/`.
2. Make focused, well-tested commits.
3. Run typecheck and production build before pushing:
   ```bash
   npm run typecheck
   npm run build
   ```
4. Push your branch and open a Pull Request targeting `main`.
5. Wait for CI checks and review before merging into `main`. Merging into `main` automatically deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## 2. Design System Rules

- All UI styling must reference CSS custom properties defined in `src/styles/tokens.css` (synchronized with the Custom Active Theme design tokens).
- Avoid hardcoded hex colors in component stylesheets and never use `!important` overrides.
- Maintain WCAG 2.1 AA contrast compliance ($\ge 4.5:1$) and visible `:focus-visible` outlines for keyboard navigation.
- Ensure new UI works cleanly across **laptop**, **tablet**, and **phone** viewports (`<= 860px` and `<= 1200px`).

## 3. Adding New Sound Presets

1. Built-in presets live in `src/samples/cards.ts` and `src/samples/game.ts` (exported via `src/samples/index.ts`).
2. Each preset must conform to the `SoundRecipe` interface in `src/engine/types.ts`.
3. Test your preset in the Composer Studio to verify:
   - Audio plays cleanly without clipping (`masterVolumeDb` typically `-4` to `-1`).
   - Both **Tone.js** and **Vanilla Web Audio API** tabs in `CodeInspector` generate valid, self-contained code.

## 4. WebMCP Tools

- Imperative WebMCP tools are registered in `src/engine/webmcp.ts`.
- Keep tool names, descriptions, and `inputSchema` definitions clear and backwards-compatible so AI agents can reliably compose, tune, audition, and export sounds.
