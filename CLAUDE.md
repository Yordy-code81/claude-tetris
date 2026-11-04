# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Tetris clone in vanilla JavaScript + HTML5 Canvas + CSS. There are no dependencies, no `package.json`, no build step, no linter and no test suite. The README and all UI text are in Spanish, so keep new user-facing strings in Spanish.

## Running

Open `index.html` directly in a browser, or serve the folder statically (recommended):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or: npx serve .
```

To verify a change, reload the page and play. There are no automated checks.

## Architecture

All logic lives in `game.js`. It is one non-module script (`'use strict'`) loaded at the end of `index.html`, and it relies on the DOM element IDs defined there (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `resume-btn`, `controls-btn`, `controls-list`, `start-level`, `theme-toggle`, `theme-label`, `skin-select`). If you rename an ID in one file, rename it in the other.

Key design points that span the code:

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval` and others are top-level `let`s. `init()` resets all of them and is also the restart handler.
- **Cell value = piece type = color index**: `PIECES[i]` matrices are filled with the value `i`, and `COLORS[i]` is that piece's color. Board cells hold `0` (empty) or that index. Index 0 is `null` in both arrays. `COLORS` is a `let` pointing at the active skin's palette (`SKINS[skin].colors`). Adding a piece type means extending `PIECES` and the `colors` array of **every** skin (`randomPiece()` uses `PIECES.length - 1`). Index 8 is the challenge piece "tuerca" (`NUT`), a 3×3 ring with an empty center; `drawNutHole()` draws the circle in its center for the current piece, the ghost and the preview only (it is not stored on the board).
- **Skins** (`SKINS`: `retro`, `neon`, `pastel`, `pixel`) each define `name`, `colors`, `grid` (`null` = use the light/dark theme's grid) and `draw(context, px, py, size, color)`. `drawBlock()` sets `globalAlpha` and delegates to the active skin's `draw`. `applySkin()` swaps `skin`/`COLORS`, sets `data-skin` on `<html>` (used by CSS for Neon's black board), saves it to `localStorage` key `skin`, and redraws. Skins that use `shadowBlur` must reset it to 0.
- **Pieces** are square matrices. Rotation is clockwise only (`rotateCW`), with naive horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate`. This is not SRS.
- **Collision** (`collide(shape, x, y)`) is the single source of truth for movement, rotation, the ghost piece (`ghostY`), locking and game over. Cells with `y < 0` are allowed above the board.
- **Game loop**: `requestAnimationFrame` accumulates `dt` into `dropAccum` and applies gravity when it exceeds `dropInterval`. Pause and game over stop the loop with `cancelAnimationFrame(animId)`, and resume restarts it by calling `loop()` with a fresh `lastTime`.
- **Lock sequence**: `lockPiece()` → `merge()` → `clearLines()` (which updates score, level and speed) → `spawn()`. Game over happens in `spawn()` when the new piece immediately collides.
- **Overlay / pause menu**: a single `#overlay` element serves both PAUSA and GAME OVER. `pause()`/`endGame()` set the text and call `showOverlay(mode)`, which sets `data-mode="pause"|"gameover"`; CSS uses that to hide Reanudar and Ver controles on GAME OVER. `hideOverlay()` hides it and blurs any focused menu button so Space/Enter don't trigger it during play. `P` and `Escape` call `togglePause()`.
- **Input blocking**: while the menu is open, game keys do nothing and are added to `blockedKeys`; they stay ignored (including auto-repeat) until their `keyup`, so a key held in the menu doesn't move the piece on resume.
- **Scoring and speed**: line clears use `LINE_SCORES[n] * level`, hard drop adds +2 per cell and soft drop adds +1 per row. Level is `max(startLevel, floor(lines/10)+1)` and `dropInterval = speedFor(level) = max(100, 1000 - (level-1)*90)`. `startLevel` (1–`MAX_START_LEVEL`) is chosen in the menu, saved in `localStorage` and applied by `init()` on the next game.

## Gotchas

- `COLS × BLOCK` and `ROWS × BLOCK` must match the `width` and `height` of `<canvas id="board">` in `index.html` (currently 300×600). If you change one, change the other.
- The next-piece preview assumes a 4×4 grid of 30px cells on a 120×120 canvas (`drawNext`).
