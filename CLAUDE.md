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

All logic lives in `game.js`. It is one non-module script (`'use strict'`) loaded at the end of `index.html`, and it relies on the DOM element IDs defined there (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `overlay-stats`, `restart-btn`, `theme-toggle`, `theme-label`, plus the pause menu: `pause-menu`, `pause-main`, `pause-controls`, `resume-btn`, `menu-restart-btn`, `controls-btn`, `controls-back-btn`, `start-level-row`, `level-dec`, `level-inc`, `start-level`, and the records UI: `name-form`, `new-record-msg`, `player-name`, `records`, `records-body`, `best-combo`, `best-lines`, `best-combo-box`, `best-lines-box`, `reset-records-btn`). If you rename an ID in one file, rename it in the other.

Key design points that span the code:

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval` and others are top-level `let`s. `init()` resets all of them and is also the restart handler.
- **Cell value = piece type = color index**: `PIECES[i]` matrices are filled with the value `i`, and `COLORS[i]` is that piece's color. Board cells hold `0` (empty) or that index. Index 0 is `null` in both arrays. Adding a piece type means extending both arrays (`randomPiece()` uses `PIECES.length - 1`). Index 8 is the challenge piece "tuerca" (`NUT`), a 3×3 ring with an empty center; `drawNutHole()` draws the circle in its center for the current piece, the ghost and the preview only (it is not stored on the board).
- **Pieces** are square matrices. Rotation is clockwise only (`rotateCW`), with naive horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate`. This is not SRS.
- **Collision** (`collide(shape, x, y)`) is the single source of truth for movement, rotation, the ghost piece (`ghostY`), locking and game over. Cells with `y < 0` are allowed above the board.
- **Game loop**: `requestAnimationFrame` accumulates `dt` into `dropAccum` and applies gravity when it exceeds `dropInterval`. Pause and game over stop the loop with `cancelAnimationFrame(animId)`, and `resumeGame()` restarts it with `requestAnimationFrame(loop)` after resetting `lastTime`.
- **Lock sequence**: `lockPiece()` → `merge()` → `clearLines()` (which updates score, level and speed) → `spawn()`. Game over happens in `spawn()` when the new piece immediately collides.
- **Overlay**: a single `#overlay` element serves the start screen, PAUSA and GAME OVER via `showOverlay(mode)` (`'start' | 'pause' | 'over'`, stored in `data-mode`). In pause mode it shows `#pause-menu` (via the `hidden` attribute) and hides the records and `#restart-btn` (via the `hidden` class); `hideOverlay()` hides it. The text is set in `showStartScreen()`, `pauseGame()` and `endGame()`. The game does not run until "Jugar" calls `init()` (`started` flag; `draw()` only paints the grid before that). `pauseGame()` / `resumeGame()` handle pause (keys `P` or `Escape`).
- **Pause menu input**: while `paused`, every keydown goes to `handleMenuKey()` and never reaches the game (↑/↓ move focus over `[data-menu-item]`, ←/→ change the start level, Enter/Space use native button activation). Keys pressed while the menu was open go into `heldDuringMenu` and are ignored by the game until their `keyup`, so a held key does not move the piece on resume. `hideOverlay()` blurs the focused menu button so Space can't re-click it.
- **Records**: stored in `localStorage` under `tetris-records` as `{ scores: [{name, score, lines}], bestCombo, maxLines }` (top 5, sorted desc); the last name used is under `tetris-player`. At game over, `bestCombo`/`maxLines` are updated always; if the score enters the top it becomes `pendingEntry` (highlighted, name input shown) until `commitPending()` saves it, which also runs from `init()` so restarting never drops a record. A combo is the number of consecutive locks that clear at least one line (`combo`/`maxCombo`, updated in `clearLines()`).
- **Scoring and speed**: line clears use `LINE_SCORES[n] * level`, hard drop adds +2 per cell and soft drop adds +1 per row. Level is `baseLevel + floor(lines/10)` and `dropInterval = speedFor(level) = max(100, 1000 - (level-1)*90)`. `startLevel` (1–`MAX_START_LEVEL`, saved in `localStorage`) is picked in the pause menu; `init()` copies it to `baseLevel`, so changing it mid-game only affects the next game.

## Gotchas

- `COLS × BLOCK` and `ROWS × BLOCK` must match the `width` and `height` of `<canvas id="board">` in `index.html` (currently 300×600). If you change one, change the other.
- The next-piece preview assumes a 4×4 grid of 30px cells on a 120×120 canvas (`drawNext`).
