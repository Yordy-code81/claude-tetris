'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins: cada una aporta su paleta (índice = tipo de pieza) y su función de dibujo ----
const SKINS = {
  retro: {
    label: 'Retro',
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
    drawCell: drawRetroCell,
  },
  neon: {
    label: 'Neón',
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#2979ff', '#ff8c00', '#e0e0ff'],
    grid: '#101826', // el tablero neón siempre es negro, también en modo claro
    glow: 14,
    drawCell: drawNeonCell,
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fdf1a8', '#d9c2f0', '#bfe8c3', '#f7b7c3', '#b9d3f7', '#fcd5b0', '#d6dbe3'],
    drawCell: drawPastelCell,
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#00bcd4', '#fbc02d', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#90a4ae'],
    drawCell: drawPixelCell,
  },
};
const DEFAULT_SKIN = 'retro';

let skin = DEFAULT_SKIN;
try {
  const saved = localStorage.getItem('skin');
  if (saved && SKINS[saved]) skin = saved;
} catch (e) {}
let COLORS = SKINS[skin].colors;

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
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const skinSelect = document.getElementById('skin-select');

let theme = 'dark';
try { if (localStorage.getItem('theme') === 'light') theme = 'light'; } catch (e) {}

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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
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
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].drawCell(context, x * size, y * size, size, COLORS[colorIndex]);
  context.restore();
}

// Retro: bloque cuadrado de color plano con una franja de brillo arriba
function drawRetroCell(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = THEMES[theme].shine;
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

// Neón: relleno oscuro translúcido + contorno brillante con resplandor (shadowBlur)
function drawNeonCell(context, px, py, size, color) {
  context.shadowColor = color;
  context.shadowBlur = SKINS.neon.glow;
  context.fillStyle = color;
  context.globalAlpha *= 0.25;
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.globalAlpha /= 0.25;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  // núcleo blanco para dar sensación de tubo de neón
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 0.75;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Pastel: esquinas redondeadas, borde suave más oscuro y un brillo difuso
function drawPastelCell(context, px, py, size, color) {
  const r = size * 0.22;
  roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(80,60,100,0.25)';
  context.lineWidth = 1.5;
  context.stroke();
  roundedRectPath(context, px + size * 0.2, py + size * 0.16, size * 0.6, size * 0.22, size * 0.11);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

// Pixel art: el bloque se divide en una rejilla de 6×6 "píxeles" con bisel y textura
const PIXEL_PATTERN = [
  'LLLLLD',
  'LHH..D',
  'LH...D',
  'L..s.D',
  'L.s..D',
  'DDDDDD',
];
const PIXEL_SHADES = {
  L: 'rgba(255,255,255,0.35)', // bisel claro
  H: 'rgba(255,255,255,0.6)',  // brillo
  D: 'rgba(0,0,0,0.35)',       // bisel oscuro
  s: 'rgba(0,0,0,0.15)',       // motas de textura
};
function drawPixelCell(context, px, py, size, color) {
  context.imageSmoothingEnabled = false;
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  const n = PIXEL_PATTERN.length;
  const p = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const shade = PIXEL_SHADES[PIXEL_PATTERN[r][c]];
      if (!shade) continue;
      context.fillStyle = shade;
      context.fillRect(Math.round(px + c * p), Math.round(py + r * p), Math.ceil(p), Math.ceil(p));
    }
  }
}

// Dibuja el agujero redondo de la tuerca en la celda central (hx, hy)
function drawNutHole(context, hx, hy, size, alpha) {
  context.save();
  context.globalAlpha = alpha ?? 1;
  if (SKINS[skin].glow) {
    context.shadowColor = COLORS[NUT];
    context.shadowBlur = SKINS[skin].glow;
  }
  context.strokeStyle = COLORS[NUT];
  context.lineWidth = Math.max(2, size * 0.14);
  context.beginPath();
  context.arc((hx + 0.5) * size, (hy + 0.5) * size, size * 0.3, 0, Math.PI * 2);
  context.stroke();
  context.restore();
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
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // las teclas pertenecen al selector mientras tenga el foco
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', init);

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

// Cambia la skin sin recargar: nueva paleta + nueva función de dibujo
function applySkin(name, save) {
  if (!SKINS[name]) name = DEFAULT_SKIN;
  skin = name;
  COLORS = SKINS[name].colors;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  if (save) {
    try { localStorage.setItem('skin', name); } catch (e) {}
  }
  if (current) { draw(); drawNext(); }
}

for (const [key, def] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = def.label;
  skinSelect.appendChild(opt);
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value, true);
  skinSelect.blur(); // devuelve el foco al juego para que las flechas no cambien la skin
});

applySkin(skin, false);

init();
