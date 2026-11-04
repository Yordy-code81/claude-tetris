'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
];

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
  trackCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = levelForLines(lines);
    dropInterval = intervalForLevel(level);
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
  const s = SKINS[skin];
  s.drawCell(context, x * size, y * size, size, s.colors[colorIndex], alpha ?? 1);
}

// Dibuja el agujero redondo de la tuerca en la celda central (hx, hy)
function drawNutHole(context, hx, hy, size, alpha) {
  const s = SKINS[skin];
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = s.colors[NUT];
  if (s.glow) { context.shadowColor = s.colors[NUT]; context.shadowBlur = s.glow; }
  context.lineWidth = Math.max(2, size * 0.14);
  context.beginPath();
  context.arc((hx + 0.5) * size, (hy + 0.5) * size, size * 0.3, 0, Math.PI * 2);
  context.stroke();
  resetShadow(context);
  context.globalAlpha = 1;
}

function drawGrid() {
  const g = SKINS[skin].grid;
  ctx.strokeStyle = (g && g[theme]) || THEMES[theme].grid;
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

// ---- Skins ----
// Cada skin define su paleta (mismo orden de índices que COLORS: 0 = null,
// 1–7 piezas estándar, 8 = tuerca), una rejilla opcional por tema y la función
// drawCell(context, px, py, size, color, alpha) que pinta una celda en píxeles.
// El fondo del tablero y de la vista previa lo pone el CSS según data-skin.
// Si añades o renombras un skin, actualiza también la lista del <script> del
// <head> de index.html y las reglas [data-skin] de style.css.

function resetShadow(context) {
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
}

// Rectángulo redondeado con arcTo (sin depender de roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Patrón 5×5 del skin pixel art: 1 = tono claro, 2 = tono oscuro, 0 = color base
const PIXEL_PATTERN = [
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 2],
  [1, 0, 1, 0, 2],
  [1, 0, 0, 0, 2],
  [0, 2, 2, 2, 2],
];

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // brillo superior
      context.fillStyle = THEMES[theme].shine;
      context.fillRect(px + 1, py + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    name: 'Neón',
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1f4b', '#2f7bff', '#ff8c00', '#d0d8e0'],
    grid: { dark: '#0c1620', light: '#0c1620' },
    glow: 12,
    drawCell(context, px, py, size, color, alpha) {
      // relleno tenue + contorno brillante con resplandor
      context.globalAlpha = alpha * 0.3;
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = this.glow;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      resetShadow(context);
      context.globalAlpha = 1;
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8e6f0', '#fdf1a8', '#d9b8f0', '#b8e8c0', '#f7b8c0', '#b8d0f7', '#fcd3a8', '#d6dbe0'],
    grid: { dark: '#36314a', light: '#f0e6dc' },
    drawCell(context, px, py, size, color, alpha) {
      const r = size * 0.25;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fill();
      // borde suave y brillo redondeado
      context.strokeStyle = 'rgba(0,0,0,0.12)';
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      roundedRectPath(context, px + 5, py + 4, size - 10, size * 0.22, size * 0.11);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#2ec4d6', '#f4c430', '#9b4dca', '#4caf50', '#e04040', '#4a7fe0', '#f08a24', '#9aa5ad'],
    drawCell(context, px, py, size, color, alpha) {
      const inner = size - 2;
      const n = PIXEL_PATTERN.length;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, inner, inner);
      for (let r = 0; r < n; r++) {
        const y0 = Math.round(r * inner / n), y1 = Math.round((r + 1) * inner / n);
        for (let c = 0; c < n; c++) {
          const tone = PIXEL_PATTERN[r][c];
          if (!tone) continue;
          const x0 = Math.round(c * inner / n), x1 = Math.round((c + 1) * inner / n);
          context.fillStyle = tone === 1 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
          context.fillRect(px + 1 + x0, py + 1 + y0, x1 - x0, y1 - y0);
        }
      }
      context.globalAlpha = 1;
    },
  },
};

const skinSelect = document.getElementById('skin-select');

function isValidSkin(s) {
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(SKINS, s);
}

let skin = 'retro';
try { const saved = localStorage.getItem('skin'); if (isValidSkin(saved)) skin = saved; } catch (e) {}

for (const [key, s] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = s.name;
  skinSelect.appendChild(opt);
}

function applySkin(s, save) {
  if (!isValidSkin(s)) s = 'retro';
  skin = s;
  document.documentElement.dataset.skin = s;
  skinSelect.value = s;
  if (save) {
    try { localStorage.setItem('skin', s); } catch (e) {}
  }
  // repintar aunque el bucle esté detenido (pausa o game over)
  if (current) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value, true);
  skinSelect.blur(); // devolver el teclado al juego
});

applySkin(skin, false);

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
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
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
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  recordSaved = false;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  startScreen.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Menú de pausa ----
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

const MAX_START_LEVEL = 10;
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space'];

// Nivel inicial elegido en el menú (se aplica en el próximo init())
let startLevel = 1;
try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) {}
// Nivel inicial de la partida en curso (lo fija init())
let baseLevel;

// Teclas pulsadas ahora mismo y teclas bloqueadas hasta su keyup (las que
// seguían pulsadas al reanudar, para no mover la pieza sin querer)
const heldKeys = new Set();
let blockedKeys = new Set();

function levelForLines(n) {
  return baseLevel + Math.floor(n / 10);
}

function intervalForLevel(lv) {
  return Math.max(100, 1000 - (lv - 1) * 90);
}

function setControlsVisible(visible) {
  pauseControls.classList.toggle('hidden', !visible);
  controlsBtn.setAttribute('aria-expanded', String(visible));
  controlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function showPauseMenu() {
  startLevelSelect.value = String(startLevel);
  setControlsVisible(false);
  pauseMenu.classList.remove('hidden');
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  blockedKeys = new Set(heldKeys);
  // quitar el foco de botones/select para que Espacio, Enter o las flechas
  // no vuelvan a activarlos durante la partida
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === 'function') active.blur();
}

// Gestiona pausa y bloqueo de entrada. Devuelve true si el evento no debe
// llegar a los controles del juego.
function handlePauseKeys(e) {
  // una repetición de una tecla cuya pulsación no vimos (p. ej. mantenida al
  // volver a la ventana) queda bloqueada hasta su keyup
  if (e.repeat && !heldKeys.has(e.code)) blockedKeys.add(e.code);
  heldKeys.add(e.code);
  const t = e.target;
  const onSelect = t instanceof HTMLSelectElement;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Esc sobre el select solo cierra su desplegable
    if (!e.repeat && !(e.code === 'Escape' && onSelect)) togglePause();
    return true;
  }
  if (paused) {
    // evitar el scroll de la página; el select conserva sus teclas y los
    // botones del menú conservan Espacio para activarse
    const onButton = t instanceof HTMLButtonElement;
    if (GAME_KEYS.includes(e.code) && !onSelect && !(onButton && e.code === 'Space')) e.preventDefault();
    return true;
  }
  return blockedKeys.has(e.code);
}

document.addEventListener('keyup', e => {
  heldKeys.delete(e.code);
  blockedKeys.delete(e.code);
});

// si la ventana pierde el foco no recibiremos los keyup pendientes
window.addEventListener('blur', () => {
  heldKeys.clear();
  blockedKeys.clear();
});

for (let lv = 1; lv <= MAX_START_LEVEL; lv++) {
  const opt = document.createElement('option');
  opt.value = String(lv);
  opt.textContent = String(lv);
  startLevelSelect.appendChild(opt);
}
startLevelSelect.value = String(startLevel);

startLevelSelect.addEventListener('change', () => {
  const lv = parseInt(startLevelSelect.value, 10);
  if (!(lv >= 1 && lv <= MAX_START_LEVEL)) return;
  startLevel = lv;
  try { localStorage.setItem('startLevel', String(lv)); } catch (e) {}
});

resumeBtn.addEventListener('click', () => { if (paused) togglePause(); });
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  setControlsVisible(pauseControls.classList.contains('hidden'));
});

// ---- Records ----
// localStorage 'tetrisRecords' = { top: [{ name, score, lines, level }], bestCombo, maxLines }
const RECORDS_KEY = 'tetrisRecords';
const MAX_RECORDS = 5;
const NAME_MAX = 12;

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const startRecordsBody = document.getElementById('start-records-body');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const overlayRecords = document.getElementById('overlay-records');
const overlayRecordsBody = document.getElementById('overlay-records-body');
const overlayBestCombo = document.getElementById('overlay-best-combo');
const overlayMaxLines = document.getElementById('overlay-max-lines');
const newRecordBadge = document.getElementById('new-record-badge');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');

// combo = bloqueos seguidos que limpian al menos una línea
let combo = 0, maxCombo = 0, recordSaved = false;

function trackCombo(cleared) {
  combo = cleared > 0 ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
}

function isTypingTarget(el) {
  return el instanceof Element && el.matches('input, select, textarea');
}

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function toCount(v) {
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function loadRecords() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(RECORDS_KEY));
  } catch (e) {
    return emptyRecords();
  }
  if (!data || typeof data !== 'object') return emptyRecords();
  const top = Array.isArray(data.top)
    ? data.top
        .filter(r => r && typeof r === 'object' && typeof r.name === 'string' && Number.isFinite(r.score))
        .map(r => ({
          name: r.name.slice(0, NAME_MAX) || 'Anónimo',
          score: toCount(r.score),
          lines: toCount(r.lines),
          level: Math.max(1, toCount(r.level)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS)
    : [];
  return { top, bestCombo: toCount(data.bestCombo), maxLines: toCount(data.maxLines) };
}

function saveRecords(records) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function qualifiesForTop(records, s) {
  return s > 0 && (records.top.length < MAX_RECORDS || s > records.top[records.top.length - 1].score);
}

function addCell(tr, tag, text) {
  const cell = document.createElement(tag);
  cell.textContent = text; // nunca innerHTML: el nombre lo escribe el jugador
  tr.appendChild(cell);
  return cell;
}

function renderRecords(tbody, comboEl, maxLinesEl, records, highlight) {
  tbody.replaceChildren();
  if (!records.top.length) {
    const tr = document.createElement('tr');
    tr.className = 'records-empty';
    addCell(tr, 'td', 'Sin records todavía').colSpan = 5;
    tbody.appendChild(tr);
  } else {
    const head = document.createElement('tr');
    ['#', 'NOMBRE', 'PUNTOS', 'LÍN.', 'NIV.'].forEach(h => addCell(head, 'th', h));
    tbody.appendChild(head);
    records.top.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (i === highlight) tr.className = 'record-new';
      addCell(tr, 'td', i + 1);
      addCell(tr, 'td', r.name);
      addCell(tr, 'td', r.score.toLocaleString());
      addCell(tr, 'td', r.lines);
      addCell(tr, 'td', r.level);
      tbody.appendChild(tr);
    });
  }
  comboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
}

function showStartScreen() {
  renderRecords(startRecordsBody, startBestCombo, startMaxLines, loadRecords(), -1);
  startScreen.classList.remove('hidden');
}

// Se llama desde endGame(): actualiza mejor combo y líneas máximas siempre,
// y ofrece guardar el nombre si la puntuación entra en el top
function showGameOverRecords() {
  const records = loadRecords();
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords(records);
  const isNew = qualifiesForTop(records, score);
  newRecordBadge.classList.toggle('hidden', !isNew);
  recordForm.classList.toggle('hidden', !isNew);
  renderRecords(overlayRecordsBody, overlayBestCombo, overlayMaxLines, records, -1);
  overlayRecords.classList.remove('hidden');
  if (isNew) {
    recordName.value = '';
    recordName.focus();
  }
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (recordSaved || !gameOver) return;
  recordSaved = true;
  recordForm.classList.add('hidden');
  recordName.blur();
  const records = loadRecords();
  let highlight = -1;
  if (qualifiesForTop(records, score)) {
    const entry = { name: recordName.value.trim().slice(0, NAME_MAX) || 'Anónimo', score, lines, level };
    records.top.push(entry);
    records.top.sort((a, b) => b.score - a.score);
    records.top = records.top.slice(0, MAX_RECORDS);
    highlight = records.top.indexOf(entry);
    saveRecords(records);
  }
  renderRecords(overlayRecordsBody, overlayBestCombo, overlayMaxLines, records, highlight);
});

playBtn.addEventListener('click', () => {
  playBtn.blur();
  init();
});

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records? Esta acción no se puede deshacer.')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  showStartScreen();
});

document.addEventListener('keydown', e => {
  // pantalla de inicio: solo Enter (fuera de controles enfocados) empieza la partida
  if (!startScreen.classList.contains('hidden')) {
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !isTypingTarget(e.target)) { e.preventDefault(); init(); }
    return;
  }
  if (!current) return;
  // escribiendo el nombre del récord: las teclas no llegan al juego
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  // P/Esc y bloqueo de entrada (debe ver también el select de nivel del menú)
  if (handlePauseKeys(e)) return;
  // con el selector de skin (u otro control) enfocado, las teclas no mueven la pieza
  if (isTypingTarget(e.target)) return;
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

showStartScreen(); // el juego empieza con «Jugar» o Enter
