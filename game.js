const STORAGE_KEY = 'aurora-vault-save-v1';
const DAILY_MS = 24 * 60 * 60 * 1000;
const TICK_RATE = 1 / 60;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const touchControls = document.getElementById('touchControls');
const startBtn = document.getElementById('startBtn');
const continueBtn = document.getElementById('continueBtn');
const dailyBtn = document.getElementById('dailyBtn');
const resumeBtn = document.getElementById('resumeBtn');
const quitBtn = document.getElementById('quitBtn');
const restartBtn = document.getElementById('restartBtn');
const continueFromSaveBtn = document.getElementById('continueFromSaveBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const menuOverlay = document.getElementById('menuOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameoverOverlay = document.getElementById('gameoverOverlay');
const coinValue = document.getElementById('coinValue');
const stageValue = document.getElementById('stageValue');
const bestValue = document.getElementById('bestValue');
const missionList = document.getElementById('missionList');
const menuCoins = document.getElementById('menuCoins');
const menuBest = document.getElementById('menuBest');
const menuDay = document.getElementById('menuDay');
const finalScore = document.getElementById('finalScore');
const finalCoins = document.getElementById('finalCoins');
const gameoverTitle = document.getElementById('gameoverTitle');

const state = {
  mode: 'menu',
  lastTime: 0,
  timeRemaining: 8,
  spawnTimer: 0,
  crystalTimer: 0,
  keyTimer: 0,
  score: 0,
  coinsCollectedThisRun: 0,
  stage: 1,
  best: 0,
  data: null,
  isPointerDown: false,
  pointerX: canvas.width / 2,
  pointerY: canvas.height / 2,
  lastTouchMoveAt: 0,
};

const saveDefaults = () => ({
  coins: 0,
  totalScore: 0,
  bestScore: 0,
  stage: 1,
  progress: 0,
  lastCheckpoint: 0,
  lastDailyClaim: 0,
  streak: 0,
  upgrades: {
    speed: 0,
    magnet: 0,
    shield: 0,
  },
  missions: [
    { id: 'crystals', label: 'Collect 18 crystals', progress: 0, goal: 18, reward: 15 },
    { id: 'survive', label: 'Survive 45s', progress: 0, goal: 45, reward: 25 },
    { id: 'gates', label: 'Open 2 vault gates', progress: 0, goal: 2, reward: 30 },
  ],
  dailyRewardReady: true,
  lastKnownRun: {
    stage: 1,
    score: 0,
    coinBank: 0,
    lives: 3,
  },
});

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.data = saveDefaults();
      return;
    }

    const parsed = JSON.parse(raw);
    state.data = { ...saveDefaults(), ...parsed };
    state.data.upgrades = { ...saveDefaults().upgrades, ...(parsed.upgrades || {}) };
    state.data.missions = (parsed.missions || saveDefaults().missions).map((item, idx) => ({
      ...saveDefaults().missions[idx],
      ...item,
    }));
  } catch (error) {
    console.warn('Save corrupted, resetting.', error);
    state.data = saveDefaults();
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

const world = {
  width: canvas.width,
  height: canvas.height,
  bgOffset: 0,
  particles: [],
  obstacles: [],
  crystals: [],
  keys: [],
  gates: [],
  bursts: [],
};

const player = {
  x: canvas.width / 2,
  y: canvas.height - 100,
  radius: 15,
  speed: 280,
  baseSpeed: 280,
  targetX: canvas.width / 2,
  direction: 0,
  lives: 3,
  invulnerable: 0,
  shield: 0,
  magnetRadius: 110,
  trail: [],
  glow: 0,
};

function resetPlayer() {
  player.x = canvas.width / 2;
  player.y = canvas.height - 100;
  player.targetX = canvas.width / 2;
  player.baseSpeed = 280 + state.data.upgrades.speed * 18;
  player.speed = player.baseSpeed;
  player.radius = 16;
  player.lives = 3 + state.data.upgrades.shield;
  player.invulnerable = 0;
  player.shield = 0;
  player.magnetRadius = 110 + state.data.upgrades.magnet * 28;
  player.trail = [];
}

function missionProgressText() {
  return state.data.missions.map((mission) => {
    const progress = Math.min(mission.progress, mission.goal);
    return `${mission.label}: ${progress}/${mission.goal}`;
  });
}

function renderMissionUI() {
  const entries = state.data.missions.map((mission) => {
    const progress = Math.min(mission.progress, mission.goal);
    return `<li><span>${mission.label}</span><span>${progress}/${mission.goal}</span></li>`;
  }).join('');
  missionList.innerHTML = entries;
}

function updateHUD() {
  coinValue.textContent = state.data.coins;
  stageValue.textContent = state.stage;
  bestValue.textContent = state.best;
  menuCoins.textContent = state.data.coins;
  menuBest.textContent = state.data.bestScore;
  menuDay.textContent = state.data.streak || 0;
}

function awardCoins(amount) {
  state.data.coins += amount;
  state.coinsCollectedThisRun += amount;
  saveGame();
  updateHUD();
}

function resetRun() {
  state.score = 0;
  state.stage = Math.max(1, state.data.stage);
  state.coinsCollectedThisRun = 0;
  state.timeRemaining = 12 + state.stage * 4;
  state.spawnTimer = 0;
  state.crystalTimer = 0;
  state.keyTimer = 0;
  world.obstacles = [];
  world.crystals = [];
  world.keys = [];
  world.gates = [];
  world.particles = [];
  world.bursts = [];
  resetPlayer();
  addBurst(player.x, player.y, 60, '#8de7ff');
  updateHUD();
}

function beginRun() {
  resetRun();
  state.mode = 'playing';
  menuOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  touchControls.classList.remove('hidden');
}

function continueFromSave() {
  if (state.data.coins < 50) return;
  state.data.coins -= 50;
  saveGame();
  state.mode = 'playing';
  if (state.data.lastKnownRun) {
    state.stage = state.data.lastKnownRun.stage || 1;
    state.score = state.data.lastKnownRun.score || 0;
    state.coinsCollectedThisRun = state.data.lastKnownRun.coinBank || 0;
  }
  resetRun();
  gameoverOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  touchControls.classList.remove('hidden');
}

function levelUpStage() {
  state.stage += 1;
  state.data.stage = state.stage;
  state.timeRemaining = 12 + state.stage * 4;
  state.data.lastKnownRun = { stage: state.stage, score: state.score, coinBank: state.coinsCollectedThisRun, lives: player.lives };
  saveGame();
  addBurst(player.x, player.y, 120, '#8bf8d8');
}

function checkMissionProgress() {
  for (const mission of state.data.missions) {
    if (mission.id === 'crystals') {
      mission.progress = Math.max(mission.progress, Math.floor(state.score / 15));
    } else if (mission.id === 'survive') {
      mission.progress = Math.max(mission.progress, Math.floor((state.score / 30) * 2));
    } else if (mission.id === 'gates') {
      mission.progress = Math.max(mission.progress, Math.max(0, state.stage - 1));
    }

    if (mission.progress >= mission.goal) {
      awardCoins(mission.reward);
      mission.progress = mission.goal;
      mission.completed = true;
    }
  }

  renderMissionUI();
  saveGame();
}

function spawnBurst(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    world.bursts.push({
      x,
      y,
      r: 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.9 + Math.random() * 0.7,
      color,
    });
  }
}

function addBurst(x, y, count, color) {
  spawnBurst(x, y, count, color);
}

function spawnCrystal() {
  const lane = Math.random() * (canvas.width - 80) + 40;
  world.crystals.push({
    x: lane,
    y: -20,
    radius: 12,
    speed: 190 + Math.random() * 260 + state.stage * 8,
    drift: (Math.random() - 0.5) * 80,
    pulse: Math.random() * Math.PI * 2,
  });
}

function spawnKey() {
  world.keys.push({
    x: Math.random() * (canvas.width - 60) + 30,
    y: -30,
    radius: 10,
    speed: 180 + Math.random() * 140,
    drift: (Math.random() - 0.5) * 70,
  });
}

function spawnObstacle() {
  const lane = Math.random() * (canvas.width - 80) + 40;
  const size = 16 + Math.random() * 22;
  const speed = 200 + Math.random() * 110 + state.stage * 10;
  world.obstacles.push({
    x: lane,
    y: -30,
    radius: size,
    speed,
    pulse: Math.random() * Math.PI * 2,
    type: Math.random() > 0.5 ? 'drone' : 'spike',
  });
}

function spawnGate() {
  world.gates.push({
    x: canvas.width / 2,
    y: -50,
    width: 110,
    height: 18,
    speed: 180 + state.stage * 12,
  });
}

function playerMove(inputX, dt) {
  const direction = inputX === 0 ? player.direction : (inputX > 0 ? 1 : -1);
  player.targetX += direction * player.speed * dt * 0.35;
  player.x += (player.targetX - player.x) * 0.14;
  player.x = Math.max(30, Math.min(canvas.width - 30, player.x));
  player.direction = direction;
}

function handleInput(delta) {
  let direction = 0;
  if (state.isPointerDown) {
    const dx = state.pointerX - player.x;
    direction = Math.abs(dx) > 4 ? (dx > 0 ? 1 : -1) : 0;
  }

  if (state.keyboardLeft) direction -= 1;
  if (state.keyboardRight) direction += 1;

  playerMove(direction, delta);
}

const keyState = { left: false, right: false };
state.keyboardLeft = false;
state.keyboardRight = false;

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keyboardLeft = true;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keyboardRight = true;
  if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
    if (state.mode === 'playing') togglePause();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keyboardLeft = false;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keyboardRight = false;
});

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    pauseOverlay.classList.remove('hidden');
    hud.classList.add('hidden');
    touchControls.classList.add('hidden');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    pauseOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    touchControls.classList.remove('hidden');
  }
}

function updateParticles(dt) {
  for (const burst of world.bursts) {
    burst.x += burst.vx * dt;
    burst.y += burst.vy * dt;
    burst.life -= dt;
  }
  world.bursts = world.bursts.filter((b) => b.life > 0);

  for (let i = 0; i < 18; i += 1) {
    world.particles.push({
      x: Math.random() * canvas.width,
      y: (Math.random() * canvas.height + (state.score * 0.8) % canvas.height) % canvas.height,
      r: 1.3 + Math.random() * 2.2,
      alpha: 0.4 + Math.random() * 0.5,
      speed: 12 + Math.random() * 22,
    });
  }

  if (world.particles.length > 180) {
    world.particles.splice(0, world.particles.length - 180);
  }

  for (const p of world.particles) {
    p.y += p.speed * dt;
    if (p.y > canvas.height + 20) p.y = -20;
  }
}

function applyCollision() {
  for (const crystal of world.crystals) {
    const dx = crystal.x - player.x;
    const dy = crystal.y - player.y;
    const distSq = dx * dx + dy * dy;
    const threshold = (player.radius + crystal.radius + (state.data.upgrades.magnet * 8)) * (state.data.upgrades.magnet > 0 ? 1.2 : 1);
    if (distSq < threshold * threshold || (Math.abs(dx) < player.magnetRadius && Math.abs(dy) < player.magnetRadius && state.data.upgrades.magnet > 0)) {
      const pull = state.data.upgrades.magnet > 0 ? 0.22 : 0.12;
      crystal.x += (player.x - crystal.x) * pull;
      crystal.y += (player.y - crystal.y) * pull;
    }

    if (distSq < (player.radius + crystal.radius + 4) * (player.radius + crystal.radius + 4)) {
      state.score += 12;
      state.coinsCollectedThisRun += 1;
      world.crystals = world.crystals.filter((item) => item !== crystal);
      addBurst(crystal.x, crystal.y, 24, '#8bf8d8');
    }
  }

  for (const key of world.keys) {
    const dx = key.x - player.x;
    const dy = key.y - player.y;
    if (dx * dx + dy * dy < (player.radius + key.radius + 4) * (player.radius + key.radius + 4)) {
      state.score += 28;
      state.coinsCollectedThisRun += 2;
      world.keys = world.keys.filter((item) => item !== key);
      addBurst(key.x, key.y, 40, '#ffd97d');
    }
  }

  for (const obstacle of world.obstacles) {
    const dx = obstacle.x - player.x;
    const dy = obstacle.y - player.y;
    if (dx * dx + dy * dy < (player.radius + obstacle.radius + 6) * (player.radius + obstacle.radius + 6)) {
      if (player.invulnerable <= 0) {
        player.lives -= 1;
        player.invulnerable = 1.0;
        addBurst(obstacle.x, obstacle.y, 26, '#ff6b7d');
        world.obstacles = world.obstacles.filter((item) => item !== obstacle);
      }
      if (player.lives <= 0) {
        endRun(false);
      }
    }
  }

  for (const gate of world.gates) {
    const gateLeft = gate.x - gate.width / 2;
    const gateRight = gate.x + gate.width / 2;
    const gateTop = gate.y - gate.height / 2;
    const gateBottom = gate.y + gate.height / 2;
    const inside = player.x > gateLeft && player.x < gateRight && player.y > gateTop && player.y < gateBottom;
    if (inside && state.score > 180 + state.stage * 90) {
      levelUpStage();
      world.gates = [];
      addBurst(gate.x, gate.y, 64, '#7cc6ff');
    }
  }
}

function updateWorld(dt) {
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(0.45, 1.1 - state.stage * 0.05);
  }

  state.crystalTimer -= dt;
  if (state.crystalTimer <= 0) {
    spawnCrystal();
    state.crystalTimer = Math.max(0.38, 0.84 - state.stage * 0.04);
  }

  state.keyTimer -= dt;
  if (state.keyTimer <= 0) {
    if (Math.random() > 0.60) spawnKey();
    state.keyTimer = Math.max(3.8, 8.2 - state.stage * 0.22);
  }

  if (state.score > 120 + state.stage * 40 && world.gates.length === 0 && Math.random() < 0.016) {
    spawnGate();
  }

  for (const crystal of world.crystals) {
    crystal.y += crystal.speed * dt;
    crystal.x += Math.sin((crystal.y + crystal.pulse) * 0.07) * 28 * dt;
  }

  for (const key of world.keys) {
    key.y += key.speed * dt;
    key.x += Math.sin((key.y + key.radius) * 0.05) * 30 * dt;
  }

  for (const obstacle of world.obstacles) {
    obstacle.y += obstacle.speed * dt;
    obstacle.x += Math.sin((obstacle.y + obstacle.pulse) * 0.08) * 18 * dt;
  }

  for (const gate of world.gates) {
    gate.y += gate.speed * dt;
  }

  world.crystals = world.crystals.filter((crystal) => crystal.y < canvas.height + 40);
  world.obstacles = world.obstacles.filter((obstacle) => obstacle.y < canvas.height + 60);
  world.keys = world.keys.filter((key) => key.y < canvas.height + 40);
  world.gates = world.gates.filter((gate) => gate.y < canvas.height + 80);

  updateParticles(dt);
  applyCollision();

  if (state.score > state.best) {
    state.best = state.score;
    state.data.bestScore = state.best;
  }

  state.data.lastKnownRun = {
    stage: state.stage,
    score: state.score,
    coinBank: state.coinsCollectedThisRun,
    lives: player.lives,
  };

  if (state.score > 0) {
    state.data.progress = state.score;
  }

  const tickValue = state.score > 0 ? Math.floor(state.score / 25) : 0;
  if (tickValue > 0 && tickValue % 5 === 0) {
    awardCoins(1);
  }

  saveGame();
  updateHUD();
}

function endRun(escaped) {
  state.mode = 'gameover';
  hud.classList.add('hidden');
  touchControls.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.remove('hidden');
  finalScore.textContent = Math.floor(state.score);
  finalCoins.textContent = Math.floor(state.coinsCollectedThisRun);
  gameoverTitle.textContent = escaped ? 'Vault Cleared' : 'Vault Lost';
  state.data.lastKnownRun = { stage: state.stage, score: state.score, coinBank: state.coinsCollectedThisRun, lives: player.lives };
  state.best = Math.max(state.best, Math.floor(state.score));
  state.data.bestScore = state.best;
  saveGame();
  updateHUD();
}

function claimDailyReward() {
  const now = Date.now();
  if (now - state.data.lastDailyClaim < DAILY_MS) {
    return;
  }

  const streak = state.data.streak + 1;
  const reward = 20 + streak * 8;
  state.data.coins += reward;
  state.data.streak = streak;
  state.data.lastDailyClaim = now;
  saveGame();
  updateHUD();
}

function update(dt) {
  if (state.mode === 'playing') {
    handleInput(dt);
    updateWorld(dt);
  } else {
    updateParticles(dt * 0.4);
  }
}

function drawGlowArc(x, y, radius, color, alpha) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  ctx.fill();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#020814');
  grad.addColorStop(0.55, '#0a1635');
  grad.addColorStop(1, '#11254d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of world.particles) {
    ctx.fillStyle = `rgba(170, 210, 255, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const horizon = canvas.height * 0.82;
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 34) % (canvas.width + 80);
    const h = 42 + (i % 5) * 18;
    ctx.fillStyle = 'rgba(19, 32, 53, 0.85)';
    ctx.fillRect(x, horizon - h, 24, h);
    ctx.fillStyle = 'rgba(118, 165, 255, 0.12)';
    ctx.fillRect(x + 5, horizon - h + 8, 5, h - 8);
  }

  ctx.strokeStyle = 'rgba(173, 194, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  ctx.stroke();
}

function drawPlayer() {
  const glow = player.invulnerable > 0 ? '#ff939e' : '#8de7ff';
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = 'rgba(141, 231, 255, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = glow;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#dff8ff';
  ctx.beginPath();
  ctx.moveTo(0, -player.radius - 6);
  ctx.lineTo(player.radius * 0.9, player.radius);
  ctx.lineTo(0, player.radius * 0.7);
  ctx.lineTo(-player.radius * 0.9, player.radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#8bf8d8';
  ctx.fillRect(-12, player.radius + 7, 24, 5);
  ctx.restore();

  for (let i = 0; i < player.lives; i += 1) {
    ctx.fillStyle = '#ffc971';
    ctx.beginPath();
    ctx.moveTo(22 + i * 24, 26);
    ctx.lineTo(30 + i * 24, 12);
    ctx.lineTo(38 + i * 24, 26);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrystal(crystal) {
  const pulse = 1 + Math.sin(crystal.pulse) * 0.24;
  ctx.save();
  ctx.translate(crystal.x, crystal.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#8bf8d8';
  ctx.beginPath();
  ctx.moveTo(0, -crystal.radius);
  ctx.lineTo(crystal.radius * 0.75, 0);
  ctx.lineTo(0, crystal.radius);
  ctx.lineTo(-crystal.radius * 0.75, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawKey(key) {
  ctx.save();
  ctx.translate(key.x, key.y);
  ctx.rotate(Math.sin(key.y * 0.06) * 0.7);
  ctx.fillStyle = '#ffd76d';
  ctx.strokeStyle = '#ffefb5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, key.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6cf';
  ctx.fillRect(-2, -key.radius, 4, key.radius * 2.6);
  ctx.fillRect(-8, key.radius * 1.1, 16, 6);
  ctx.restore();
}

function drawObstacle(obstacle) {
  const color = obstacle.type === 'drone' ? '#ff8a9d' : '#7cc6ff';
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, obstacle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-obstacle.radius * 0.35, -obstacle.radius * 0.35, obstacle.radius * 0.7, obstacle.radius * 0.7);
  ctx.restore();
}

function drawGate(gate) {
  ctx.save();
  ctx.translate(gate.x, gate.y);
  ctx.strokeStyle = '#7cc6ff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.rect(-gate.width / 2, -gate.height / 2, gate.width, gate.height);
  ctx.stroke();
  ctx.fillStyle = 'rgba(124, 198, 255, 0.12)';
  ctx.fillRect(-gate.width / 2, -gate.height / 2, gate.width, gate.height);
  ctx.restore();
}

function drawBursts() {
  for (const burst of world.bursts) {
    ctx.fillStyle = burst.color.replace(')', `, ${Math.min(1, burst.life)})`).replace('rgb', 'rgba');
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, burst.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUDText() {
  ctx.fillStyle = 'rgba(231, 242, 255, 0.8)';
  ctx.font = '700 28px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(`Score ${Math.floor(state.score)}`, canvas.width / 2, 60);
  if (state.mode === 'playing') {
    ctx.font = '600 16px Segoe UI';
    ctx.fillStyle = 'rgba(255, 196, 85, 0.9)';
    ctx.fillText(`Vault ${state.stage}`, canvas.width / 2, 92);
  }
}

function render() {
  drawBackground();
  for (const gate of world.gates) drawGate(gate);
  for (const crystal of world.crystals) drawCrystal(crystal);
  for (const key of world.keys) drawKey(key);
  for (const obstacle of world.obstacles) drawObstacle(obstacle);
  drawBursts();
  drawPlayer();
  drawHUDText();
}

function loop(timestamp) {
  const dt = Math.min(0.032, (timestamp - state.lastTime || 0) / 1000 || TICK_RATE);
  state.lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function openMenu() {
  menuOverlay.classList.remove('hidden');
  hud.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  touchControls.classList.add('hidden');
  state.mode = 'menu';
}

function bindUI() {
  startBtn.addEventListener('click', () => {
    beginRun();
  });

  continueBtn.addEventListener('click', () => {
    if (state.data.lastKnownRun && state.data.coins >= 50) {
      continueFromSave();
    }
  });

  dailyBtn.addEventListener('click', () => {
    claimDailyReward();
  });

  restartBtn.addEventListener('click', () => {
    beginRun();
  });

  continueFromSaveBtn.addEventListener('click', () => {
    continueFromSave();
  });

  resumeBtn.addEventListener('click', () => {
    togglePause();
  });

  quitBtn.addEventListener('click', () => {
    openMenu();
  });

  leftBtn.addEventListener('pointerdown', () => {
    state.keyboardLeft = true;
  });
  leftBtn.addEventListener('pointerup', () => {
    state.keyboardLeft = false;
  });
  rightBtn.addEventListener('pointerdown', () => {
    state.keyboardRight = true;
  });
  rightBtn.addEventListener('pointerup', () => {
    state.keyboardRight = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    state.isPointerDown = true;
    const rect = canvas.getBoundingClientRect();
    state.pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.pointerY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.pointerY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointerup', () => {
    state.isPointerDown = false;
  });
  canvas.addEventListener('pointerleave', () => {
    state.isPointerDown = false;
  });
}

function init() {
  loadSave();
  renderMissionUI();
  updateHUD();
  bindUI();
  openMenu();
  requestAnimationFrame(loop);
}

init();
