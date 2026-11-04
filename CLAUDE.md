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

All logic lives in `game.js`. It is one non-module script (`'use strict'`) loaded at the end of `index.html`, and it relies on the DOM element IDs defined there (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`, `theme-label`, `skin-select`). If you rename an ID in one file, rename it in the other.

Key design points that span the code:

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval` and others are top-level `let`s. `init()` resets all of them and is also the restart handler.
- **Cell value = piece type = color index**: `PIECES[i]` matrices are filled with the value `i`, and `COLORS[i]` is that piece's color. Board cells hold `0` (empty) or that index. Index 0 is `null` in both arrays. Adding a piece type means extending `PIECES` and the `colors` array of **every** skin (`randomPiece()` uses `PIECES.length - 1`). Index 8 is the challenge piece "tuerca" (`NUT`), a 3×3 ring with an empty center; `drawNutHole()` draws the circle in its center for the current piece, the ghost and the preview only (it is not stored on the board).
- **Skins**: `SKINS` (`retro`, `neon`, `pastel`, `pixel`) each define `label`, `colors` and `drawCell(ctx, px, py, size, color)`, plus optional `grid` and `glow`. `COLORS` is a `let` that points at the active skin's palette. `drawBlock()` wraps the call in `save()`/`restore()` and delegates to the active `drawCell`. `applySkin()` swaps the palette, sets `data-skin` on `<html>` (CSS uses it to make the neon board black) and repaints. The choice is saved in `localStorage` under `skin`, and the `<select id="skin-select">` options are generated from `SKINS`. Skins are independent of the light/dark theme (`THEMES`).
- **Pieces** are square matrices. Rotation is clockwise only (`rotateCW`), with naive horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate`. This is not SRS.
- **Collision** (`collide(shape, x, y)`) is the single source of truth for movement, rotation, the ghost piece (`ghostY`), locking and game over. Cells with `y < 0` are allowed above the board.
- **Game loop**: `requestAnimationFrame` accumulates `dt` into `dropAccum` and applies gravity when it exceeds `dropInterval`. Pause and game over stop the loop with `cancelAnimationFrame(animId)`, and resume restarts it by calling `loop()` with a fresh `lastTime`.
- **Lock sequence**: `lockPiece()` → `merge()` → `clearLines()` (which updates score, level and speed) → `spawn()`. Game over happens in `spawn()` when the new piece immediately collides.
- **Overlay**: a single `#overlay` element serves both PAUSA and GAME OVER. The text is set in `togglePause()` and `endGame()`, and the `hidden` class toggles it.
- **Scoring and speed**: line clears use `LINE_SCORES[n] * level`, hard drop adds +2 per cell and soft drop adds +1 per row. Level is `floor(lines/10)+1` and `dropInterval = max(100, 1000 - (level-1)*90)`.

## Gotchas

- `COLS × BLOCK` and `ROWS × BLOCK` must match the `width` and `height` of `<canvas id="board">` in `index.html` (currently 300×600). If you change one, change the other.
- The next-piece preview assumes a 4×4 grid of 30px cells on a 120×120 canvas (`drawNext`).
