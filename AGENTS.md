# AGENTS.md

Asteroids clone: vanilla HTML5 Canvas + ES6, no dependencies, no build step.

## Run / verify

- No `package.json`, bundler, tests, lint, or typecheck. Do not add tooling unless asked.
- Run with `npx serve .` (README) or open `index.html` directly.
- Verification is manual in a browser; there is no automated test command.

## Structure

- `index.html` — canvas + inline CSS; loads `game.js` via `<script src>` (no modules).
- `game.js` — all game logic (~420 lines).
- `favicon.svg`, `.vscode/settings.json` (empty), `README.md` (Spanish).

## Gotchas

- Canvas size is hardcoded twice: `W`/`H` in `game.js:5-6` and `width`/`height` on `index.html:23`. Keep them in sync.
- `RADII`/`SPEEDS`/`POINTS` are indexed by asteroid `size` 1–3; index 0 is an unused placeholder.
- Input uses two maps: `keys` for held input, `pressed(code)` for edge-triggered actions. `pressed()` consumes the flag, so call it once per intent.
- `state` is one of `'playing' | 'dead' | 'gameover'`.
- Motion wraps toroidally via `wrap()`, but collisions use plain Euclidean `dist()` — they do not account for the wrap seam.
- Main loop clamps `dt` to 0.05 and passes `0` on the first frame.
- All user-facing text (HUD, overlays, README) is in Spanish; keep new strings Spanish.
