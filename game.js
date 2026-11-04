'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const NUT = 8; // pieza de reto: anillo 3×3 con hueco central

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
];

const THEMES = {
  dark:  { grid: '#22222e', shine: 'rgba(255,255,255,0.12)', ghostAlpha: 0.2 },
  light: { grid: '#e1e4f0', shine: 'rgba(255,255,255,0.35)', ghostAlpha: 0.35 },
};

// ---- Skins ----
// Cada skin define su paleta (índice = tipo de pieza, 0 = null), el color de la
// rejilla (null = usar el del tema) y su función de dibujo de bloque.

// Mezcla un color hex con blanco (amt > 0) o con negro (amt < 0)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255, a = Math.abs(amt);
  const mix = v => Math.round(v + (t - v) * a);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

// Trazado de rectángulo con esquinas redondeadas (sin depender de ctx.roundRect)
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawRetro(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEMES[theme].shine;
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeon(context, px, py, size, color) {
  const base = context.globalAlpha;
  context.shadowColor = color;
  context.shadowBlur = size * 0.5;
  context.fillStyle = color;
  context.globalAlpha = base * 0.25;
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.globalAlpha = base;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
}

function drawPastel(context, px, py, size, color) {
  roundRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, size * 0.25);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = shade(color, -0.18);
  context.lineWidth = 1.5;
  context.stroke();
  // brillo suave arriba a la izquierda
  roundRectPath(context, px + size * 0.2, py + size * 0.18, size * 0.35, size * 0.18, size * 0.09);
  context.fillStyle = 'rgba(255,255,255,0.55)';
  context.fill();
}

function drawPixel(context, px, py, size, color) {
  const p = size / 10; // tamaño de cada "píxel" del sprite
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  // bisel: luz arriba/izquierda, sombra abajo/derecha
  context.fillStyle = shade(color, 0.45);
  context.fillRect(px, py, size - p, p);
  context.fillRect(px, py, p, size - p);
  context.fillStyle = shade(color, -0.45);
  context.fillRect(px + p, py + size - p, size - p, p);
  context.fillRect(px + size - p, py + p, p, size - p);
  // textura de tramado en el interior
  context.fillStyle = shade(color, -0.2);
  for (let j = 2; j < 8; j++)
    for (let i = 2; i < 8; i++)
      if ((i + j * 2) % 4 === 0) context.fillRect(px + i * p, py + j * p, p, p);
  // destello
  context.fillStyle = shade(color, 0.75);
  context.fillRect(px + 2 * p, py + 2 * p, 2 * p, p);
  context.fillRect(px + 2 * p, py + 3 * p, p, p);
}

const SKINS = {
  retro: {
    name: 'Retro',
    grid: null,
    draw: drawRetro,
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - azul pálido
      '#ffb74d', // L - orange
      '#b0bec5', // N - tuerca (gris metálico)
    ],
  },
  neon: {
    name: 'Neon',
    grid: '#10101c',
    glow: true,
    draw: drawNeon,
    colors: [null, '#00f0ff', '#fff200', '#d000ff', '#39ff14', '#ff073a', '#2f6bff', '#ff8c00', '#e0e0ff'],
  },
  pastel: {
    name: 'Pastel',
    grid: null,
    draw: drawPastel,
    colors: [null, '#a8e6ef', '#fff1a8', '#e0bbe4', '#b5ead7', '#ffb7b2', '#c7ceea', '#ffdac1', '#d5dbe0'],
  },
  pixel: {
    name: 'Pixel art',
    grid: null,
    draw: drawPixel,
    colors: [null, '#3cbcfc', '#f8d838', '#b53cfc', '#58d854', '#e8402c', '#2c58e8', '#fc9838', '#a0a8b0'],
  },
};

let skin = 'retro';
try { const saved = localStorage.getItem('skin'); if (SKINS[saved]) skin = saved; } catch (e) {}
let COLORS = SKINS[skin].colors;

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSelect = document.getElementById('start-level');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const skinSelect = document.getElementById('skin-select');

const MAX_START_LEVEL = 10;

let theme = 'dark';
try { if (localStorage.getItem('theme') === 'light') theme = 'light'; } catch (e) {}

let startLevel = 1;
try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) {}

// Teclas que estaban pulsadas mientras el menú estaba abierto: se ignoran
// (incluida la autorrepetición) hasta que se suelten, para que al reanudar
// no se produzcan movimientos accidentales.
const blockedKeys = new Set();

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = speedFor(level);
    updateHUD();
  }
}

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].draw(context, x * size, y * size, size, COLORS[colorIndex]);
  context.globalAlpha = 1;
}

// Dibuja el agujero redondo de la tuerca en la celda central (hx, hy)
function drawNutHole(context, hx, hy, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = COLORS[NUT];
  context.lineWidth = Math.max(2, size * 0.14);
  if (SKINS[skin].glow) { context.shadowColor = COLORS[NUT]; context.shadowBlur = size * 0.5; }
  context.beginPath();
  context.arc((hx + 0.5) * size, (hy + 0.5) * size, size * 0.3, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid || THEMES[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, THEMES[theme].ghostAlpha);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK, THEMES[theme].ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.type === NUT) drawNutHole(nextCtx, offX + 1, offY + 1, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw(); // pintar el estado final del tablero
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showOverlay('gameover');
  restartBtn.focus();
}

function showOverlay(mode) {
  overlay.dataset.mode = mode;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  setControlsVisible(false);
  // quitar el foco de los botones del menú para que Espacio/Enter no los activen al jugar
  if (overlay.contains(document.activeElement)) document.activeElement.blur();
}

function setControlsVisible(visible) {
  controlsList.hidden = !visible;
  controlsBtn.setAttribute('aria-expanded', String(visible));
  controlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function pause() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'PAUSA';
  overlayScore.textContent = '';
  showOverlay('pause');
  resumeBtn.focus();
}

function resume() {
  if (gameOver || !paused) return;
  paused = false;
  hideOverlay();
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (paused) resume(); else pause();
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      // endGame() no puede cancelar el frame que se está ejecutando ahora,
      // así que salimos aquí para no programar uno nuevo
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space']);

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }

  // Menú abierto (pausa o game over): no se mueve nada. Las teclas quedan
  // bloqueadas hasta soltarlas; el teclado sigue sirviendo para navegar el menú.
  if (paused || gameOver) {
    if (GAME_KEYS.has(e.code)) blockedKeys.add(e.code);
    return;
  }

  if (e.target === skinSelect) return; // con el selector enfocado, las flechas cambian la skin

  if (blockedKeys.has(e.code)) {
    if (e.code === 'Space') e.preventDefault();
    return;
  }

  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

document.addEventListener('keyup', e => blockedKeys.delete(e.code));
// si la ventana pierde el foco no recibiremos los keyup: no dejar teclas bloqueadas para siempre
window.addEventListener('blur', () => blockedKeys.clear());

resumeBtn.addEventListener('click', resume);
restartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => setControlsVisible(controlsList.hidden));

for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
  const opt = document.createElement('option');
  opt.value = String(lvl);
  opt.textContent = String(lvl);
  startLevelSelect.appendChild(opt);
}
startLevelSelect.value = String(startLevel);
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
});

function applyTheme(t, save) {
  theme = t;
  document.documentElement.dataset.theme = t;
  const isLight = t === 'light';
  themeToggle.setAttribute('aria-checked', String(isLight));
  themeLabel.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-label', themeLabel.textContent);
  if (save) {
    try { localStorage.setItem('theme', t); } catch (e) {}
  }
  // repintar aunque el bucle esté detenido (pausa o game over)
  if (current) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark', true);
  themeToggle.blur(); // evita que Espacio active el botón
});

applyTheme(theme, false);

function applySkin(s, save) {
  skin = s;
  COLORS = SKINS[s].colors;
  document.documentElement.dataset.skin = s;
  skinSelect.value = s;
  if (save) {
    try { localStorage.setItem('skin', s); } catch (e) {}
  }
  // repintar aunque el bucle esté detenido (pausa o game over)
  if (current) { draw(); drawNext(); }
}

for (const [key, def] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = def.name;
  skinSelect.appendChild(opt);
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value, true);
  skinSelect.blur(); // devolver el teclado al juego
});

applySkin(skin, false);

init();
