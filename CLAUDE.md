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

All logic lives in `game.js`. It is one non-module script (`'use strict'`) loaded at the end of `index.html`, and it relies on the DOM element IDs defined there (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`, `theme-label`, plus the records IDs `start-screen`, `play-btn`, `reset-records-btn`, `start-records-body`, `start-best-combo`, `start-max-lines`, `overlay-records`, `overlay-records-body`, `overlay-best-combo`, `overlay-max-lines`, `new-record-badge`, `record-form`, `record-name`). If you rename an ID in one file, rename it in the other.

Key design points that span the code:

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval` and others are top-level `let`s (the records section adds `combo`, `maxCombo`, `recordSaved`). `init()` resets all of them and is also the restart handler.
- **Cell value = piece type = color index**: `PIECES[i]` matrices are filled with the value `i`, and `COLORS[i]` is that piece's color. Board cells hold `0` (empty) or that index. Index 0 is `null` in both arrays. Adding a piece type means extending both arrays (`randomPiece()` uses `PIECES.length - 1`). Index 8 is the challenge piece "tuerca" (`NUT`), a 3×3 ring with an empty center; `drawNutHole()` draws the circle in its center for the current piece, the ghost and the preview only (it is not stored on the board).
- **Pieces** are square matrices. Rotation is clockwise only (`rotateCW`), with naive horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate`. This is not SRS.
- **Collision** (`collide(shape, x, y)`) is the single source of truth for movement, rotation, the ghost piece (`ghostY`), locking and game over. Cells with `y < 0` are allowed above the board.
- **Game loop**: `requestAnimationFrame` accumulates `dt` into `dropAccum` and applies gravity when it exceeds `dropInterval`. Pause and game over stop the loop with `cancelAnimationFrame(animId)`, and resume restarts it by calling `loop()` with a fresh `lastTime`.
- **Lock sequence**: `lockPiece()` → `merge()` → `clearLines()` (which updates score, level and speed) → `spawn()`. Game over happens in `spawn()` when the new piece immediately collides.
- **Start screen**: the game does not auto-start. The script ends with `showStartScreen()`, and `#start-screen` stays visible until "Jugar" or Enter calls `init()` (which hides it). Before the first `init()`, `current` is `undefined`, so the keydown handler and `applyTheme()` must guard against it.
- **Overlay**: a single `#overlay` element serves both PAUSA and GAME OVER. The text is set in `togglePause()` and `endGame()`, and the `hidden` class toggles it. Its `#overlay-records` block (records table and name form) is shown by `endGame()` and hidden by `togglePause()`.
- **Records** (`// ---- Records ----` section): the `localStorage` key `tetrisRecords` holds `{ top: [{name, score, lines, level}], bestCombo, maxLines }`, with the top 5 sorted by score. `loadRecords()` validates the parsed data and falls back to empty, and every storage access is wrapped in try/catch. `clearLines()` calls `trackCombo(cleared)`, where a combo is consecutive locks that clear at least one line. `endGame()` calls `showGameOverRecords()`, which always updates `bestCombo`/`maxLines` and shows the name form when the score is above 0 and enters the top. A record is saved once per game and its row gets `.record-new`. Names are rendered with `textContent`. The keydown handler ignores events from `input`/`select`/`textarea`.
- **Scoring and speed**: line clears use `LINE_SCORES[n] * level`, hard drop adds +2 per cell and soft drop adds +1 per row. Level is `floor(lines/10)+1` and `dropInterval = max(100, 1000 - (level-1)*90)`.

## Gotchas

- `COLS × BLOCK` and `ROWS × BLOCK` must match the `width` and `height` of `<canvas id="board">` in `index.html` (currently 300×600). If you change one, change the other.
- The next-piece preview assumes a 4×4 grid of 30px cells on a 120×120 canvas (`drawNext`).
