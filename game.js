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
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelRow = document.getElementById('start-level-row');
const levelDec = document.getElementById('level-dec');
const levelInc = document.getElementById('level-inc');
const startLevelEl = document.getElementById('start-level');

const MAX_START_LEVEL = 10; // a partir del 11 la velocidad ya es la mínima (100 ms)

const overlayStats = document.getElementById('overlay-stats');
const nameForm = document.getElementById('name-form');
const newRecordMsg = document.getElementById('new-record-msg');
const playerNameInput = document.getElementById('player-name');
const recordsSection = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const bestComboBox = document.getElementById('best-combo-box');
const bestLinesBox = document.getElementById('best-lines-box');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const RECORDS_KEY = 'tetris-records';
const PLAYER_KEY = 'tetris-player';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = 'Jugador';

let theme = 'dark';
try { if (localStorage.getItem('theme') === 'light') theme = 'light'; } catch (e) {}

// Nivel elegido en el menú de pausa; se aplica al empezar la siguiente partida
let startLevel = 1;
try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) {}

// Teclas que se pulsaron con el menú abierto: se ignoran hasta soltarlas,
// para que una tecla mantenida no mueva la pieza al reanudar
const heldDuringMenu = new Set();

let board, current, next, score, lines, level, baseLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}
let started = false;   // false mientras se muestra la pantalla de inicio
let combo = 0;         // piezas seguidas que han limpiado al menos una línea
let maxCombo = 0;      // mejor combo de la partida actual

// ---- Récords (localStorage) ----
// records = { scores: [{ name, score, lines }], bestCombo, maxLines }
let records = loadRecords();
let pendingEntry = null;   // puntuación de esta partida que entra en el top, aún sin nombre
let savedEntry = null;     // entrada ya guardada de esta partida (para resaltarla)
let newBestCombo = false;  // esta partida ha batido el mejor combo
let newMaxLines = false;   // esta partida ha batido las líneas máximas

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
  if (!cleared) {
    combo = 0;
    return;
  }
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  lines += cleared;
  score += (LINE_SCORES[cleared] || 0) * level;
  level = baseLevel + Math.floor(lines / 10);
  dropInterval = speedFor(level);
  updateHUD();
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEMES[theme].shine;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Dibuja el agujero redondo de la tuerca en la celda central (hx, hy)
function drawNutHole(context, hx, hy, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = COLORS[NUT];
  context.lineWidth = Math.max(2, size * 0.14);
  context.beginPath();
  context.arc((hx + 0.5) * size, (hy + 0.5) * size, size * 0.3, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[theme].grid;
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
  if (!started) return; // pantalla de inicio: solo la cuadrícula

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

// ---- Récords ----

function loadRecords() {
  const empty = { scores: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || typeof data !== 'object') return empty;
    const scores = (Array.isArray(data.scores) ? data.scores : [])
      .filter(e => e && Number.isFinite(e.score))
      .map(e => ({
        name: String(e.name ?? '').slice(0, NAME_MAX) || DEFAULT_NAME,
        score: e.score,
        lines: Number(e.lines) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
    return {
      scores,
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

// Posición (0-based) que ocuparía `s` en el top, o -1 si no entra.
// Con empate, la puntuación nueva queda por debajo de la ya guardada.
function rankFor(s) {
  if (s <= 0) return -1;
  const idx = records.scores.findIndex(e => s > e.score);
  const pos = idx === -1 ? records.scores.length : idx;
  return pos < MAX_RECORDS ? pos : -1;
}

function renderRecords() {
  const rows = records.scores.slice();
  if (pendingEntry) {
    rows.splice(pendingEntry.rank, 0, pendingEntry);
    rows.length = Math.min(rows.length, MAX_RECORDS);
  }

  recordsBody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty';
    td.textContent = 'Sin récords todavía';
    tr.appendChild(td);
    recordsBody.appendChild(tr);
  }
  rows.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (entry === pendingEntry || entry === savedEntry) tr.className = 'current';
    const name = entry === pendingEntry
      ? (playerNameInput.value.trim() || '…')
      : entry.name;
    for (const text of [i + 1, name, entry.score.toLocaleString(), entry.lines]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    recordsBody.appendChild(tr);
  });

  bestComboEl.textContent = records.bestCombo;
  bestLinesEl.textContent = records.maxLines;
  bestComboBox.classList.toggle('current', newBestCombo);
  bestLinesBox.classList.toggle('current', newMaxLines);
}

// Guarda la puntuación pendiente con el nombre escrito (o el nombre por defecto)
function commitPending() {
  if (!pendingEntry) return;
  const name = playerNameInput.value.trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  const entry = { name, score: pendingEntry.score, lines: pendingEntry.lines };
  records.scores.splice(pendingEntry.rank, 0, entry);
  records.scores.length = Math.min(records.scores.length, MAX_RECORDS);
  saveRecords();
  try { localStorage.setItem(PLAYER_KEY, name); } catch (e) {}
  pendingEntry = null;
  savedEntry = entry;
  nameForm.classList.add('hidden');
  renderRecords();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los récords? Esta acción no se puede deshacer.')) return;
  records = { scores: [], bestCombo: 0, maxLines: 0 };
  saveRecords();
  savedEntry = null;
  newBestCombo = false;
  newMaxLines = false;
  // si hay una puntuación pendiente de nombre, ahora entra en primer puesto
  if (pendingEntry) {
    pendingEntry.rank = rankFor(pendingEntry.score);
    newRecordMsg.textContent = `¡Nuevo récord! Puesto #${pendingEntry.rank + 1}`;
  }
  renderRecords();
}

// ---- Overlay ----

// mode: 'start' | 'pause' | 'over'
function showOverlay(mode) {
  overlay.dataset.mode = mode;
  const withRecords = mode !== 'pause';
  pauseMenu.hidden = withRecords;
  recordsSection.classList.toggle('hidden', !withRecords);
  restartBtn.classList.toggle('hidden', !withRecords);
  restartBtn.textContent = mode === 'start' ? 'Jugar' : 'Reiniciar';
  nameForm.classList.toggle('hidden', !(mode === 'over' && pendingEntry));
  if (withRecords) renderRecords();
  overlay.classList.remove('hidden');
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  overlayStats.textContent = '';
  showOverlay('start');
  restartBtn.focus();
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw(); // pintar el estado final del tablero

  // mejor combo y líneas máximas se actualizan siempre, entre o no en el top
  newBestCombo = maxCombo > records.bestCombo;
  newMaxLines = lines > records.maxLines;
  if (newBestCombo) records.bestCombo = maxCombo;
  if (newMaxLines) records.maxLines = lines;
  if (newBestCombo || newMaxLines) saveRecords();

  savedEntry = null;
  const rank = rankFor(score);
  pendingEntry = rank >= 0 ? { name: '', score, lines, rank } : null;

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Líneas: ${lines} · Combo máx.: ${maxCombo}`;
  showOverlay('over');

  if (pendingEntry) {
    newRecordMsg.textContent = `¡Nuevo récord! Puesto #${rank + 1}`;
    let lastName = '';
    try { lastName = localStorage.getItem(PLAYER_KEY) || ''; } catch (e) {}
    playerNameInput.value = lastName;
    renderRecords();
    playerNameInput.focus();
    playerNameInput.select();
  } else {
    restartBtn.focus();
  }
}

function hideOverlay() {
  overlay.classList.add('hidden');
  showPauseView('main');
  // soltar el foco para que Espacio/Enter no vuelvan a pulsar un botón del menú
  if (overlay.contains(document.activeElement)) document.activeElement.blur();
}

function showPauseView(view, focusEl) {
  pauseMain.hidden = view !== 'main';
  pauseControls.hidden = view !== 'controls';
  if (focusEl) focusEl.focus();
}

function menuItems() {
  const view = pauseControls.hidden ? pauseMain : pauseControls;
  return [...view.querySelectorAll('[data-menu-item]')];
}

function moveMenuFocus(dir) {
  const items = menuItems();
  const i = items.indexOf(document.activeElement);
  const nextIndex = i < 0 ? (dir > 0 ? 0 : items.length - 1) : (i + dir + items.length) % items.length;
  items[nextIndex].focus();
}

function setStartLevel(value) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, value));
  startLevelEl.textContent = startLevel;
  levelRow.setAttribute('aria-valuenow', String(startLevel));
  levelDec.disabled = startLevel <= 1;
  levelInc.disabled = startLevel >= MAX_START_LEVEL;
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
}

function pauseGame() {
  if (!started || gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'PAUSA';
  overlayScore.textContent = '';
  overlayStats.textContent = '';
  showPauseView('main');
  showOverlay('pause');
  resumeBtn.focus();
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  hideOverlay();
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function handleMenuKey(e) {
  if (!e.repeat) heldDuringMenu.add(e.code);
  switch (e.code) {
    case 'KeyP':
      if (!e.repeat) resumeGame();
      break;
    case 'Escape':
      if (e.repeat) break;
      if (!pauseControls.hidden) showPauseView('main', controlsBtn);
      else resumeGame();
      break;
    case 'ArrowUp':
      moveMenuFocus(-1);
      break;
    case 'ArrowDown':
      moveMenuFocus(1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (document.activeElement === levelRow) setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      break;
    case 'Enter':
    case 'Space':
      // los botones se activan solos; solo evitamos el scroll de la página con Espacio
      if (document.activeElement instanceof HTMLButtonElement) return;
      break;
    default:
      return;
  }
  e.preventDefault();
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
  commitPending(); // no perder un récord si se reinicia sin pulsar "Guardar"
  pendingEntry = null;
  savedEntry = null;
  newBestCombo = false;
  newMaxLines = false;
  started = true;
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  combo = 0;
  maxCombo = 0;
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

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyX', 'Space']);

document.addEventListener('keydown', e => {
  if (e.target === playerNameInput) return; // escribiendo el nombre
  // con el menú abierto el juego no recibe ninguna tecla
  if (paused) { handleMenuKey(e); return; }
  if (!started || gameOver) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) pauseGame();
    return;
  }
  // tecla pulsada durante el menú y aún mantenida: ignorarla hasta que se suelte
  if (heldDuringMenu.has(e.code)) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
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

document.addEventListener('keyup', e => { heldDuringMenu.delete(e.code); });
// si la ventana pierde el foco no llegarán los keyup
window.addEventListener('blur', () => heldDuringMenu.clear());

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resumeGame);
menuRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showPauseView('controls', controlsBackBtn));
controlsBackBtn.addEventListener('click', () => showPauseView('main', controlsBtn));
levelDec.addEventListener('click', () => { setStartLevel(startLevel - 1); levelRow.focus(); });
levelInc.addEventListener('click', () => { setStartLevel(startLevel + 1); levelRow.focus(); });
setStartLevel(startLevel);

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  commitPending();
  restartBtn.focus(); // Enter de nuevo = reiniciar
});

playerNameInput.addEventListener('input', renderRecords);

resetRecordsBtn.addEventListener('click', resetRecords);

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

// Estado inicial: tablero vacío y pantalla de inicio con los récords
board = createBoard();
next = randomPiece();
current = next; // para que applyTheme pueda repintar; draw() no lo dibuja hasta empezar
drawNext();
draw();
showStartScreen();
