'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// ── Estrella fugaz (asteroide especial) ───────────────────────────────────────
const SHOOTING_STAR_INTERVAL = 18;   // segundos entre apariciones
const SHOOTING_STAR_TTL      = 7;    // vida útil antes de desaparecer
const SHOOTING_STAR_SPEED    = 320;  // px/s (≈4× un asteroide de tamaño 1)
const SHOOTING_STAR_RADIUS   = 9;
const SHOOTING_STAR_POINTS   = 200;

// ── Power-up de velocidad (turbo) ─────────────────────────────────────────────
const BOOST_DURATION   = 5;    // segundos que dura el turbo
const BOOST_MULT       = 2;    // multiplicador de propulsión
const BOOST_COOLDOWN   = 5;    // espera tras terminar el turbo
const POWERUP_DELAY    = 8;    // espera inicial para el primer power-up
const POWERUP_INTERVAL = 12;   // tiempo entre apariciones
const POWERUP_RADIUS   = 12;

// ── Power-ups de escudo y triple shot ─────────────────────────────────────
const SHIELD_DURATION = 6;                  // segundos que dura el escudo
const SHIELD_RADIUS   = 24;                 // radio visual del escudo
const TRIPLE_DURATION = 5;                  // segundos que dura el triple shot
const TRIPLE_SPREAD   = 12 * Math.PI / 180; // medio ángulo del abanico

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.points = POINTS[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ────────────────────────────────────────────────────────────
class ShootingStar {
  constructor(x, y) {
    this.x    = x;
    this.y    = y;
    this.special = true;
    this.ttl     = SHOOTING_STAR_TTL;
    this.radius  = SHOOTING_STAR_RADIUS;
    this.points  = SHOOTING_STAR_POINTS;
    this.dead    = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SHOOTING_STAR_SPEED * rand(0.85, 1.15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-3, 3);
    this.rot = rand(0, Math.PI * 2);
    this.age = 0;

    // Polígono irregular puntiagudo
    const n = randInt(5, 7);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * (i % 2 === 0 ? rand(0.9, 1.15) : rand(0.45, 0.65));
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }

    this.trail = [{ x, y }];
  }

  update(dt) {
    this.age += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.dead = true;
      explode(this.x, this.y, 5);
      return;
    }

    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.shift();
  }

  split() { return []; }

  draw() {
    // Rastro
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.hypot(dx, dy) > 50) continue;  // salto por el pliegue del wrap()
      const k = i / this.trail.length;
      ctx.strokeStyle = `rgba(255,180,60,${(k * 0.6).toFixed(2)})`;
      ctx.lineWidth = 1 + k * 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Parpadeo de aviso cuando está por expirar
    if (this.ttl < 1.5 && Math.floor(this.ttl * 10) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#ffd24d';
    ctx.fillStyle   = 'rgba(255,160,40,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-ups (turbo y escudo) ────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'boost') {
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.radius = POWERUP_RADIUS;
    this.rot    = 0;
    this.dead   = false;
  }

  update(dt) {
    this.rot += 1.5 * dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'shield') {
      // Aro exterior pulsante
      const pulse = 0.6 + 0.4 * Math.sin(this.rot * 3);
      ctx.strokeStyle = `rgba(90,255,150,${pulse.toFixed(2)})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Emblema de escudo
      ctx.fillStyle = '#5f8';
      ctx.beginPath();
      ctx.moveTo( 0, -9);
      ctx.lineTo( 7, -5);
      ctx.lineTo( 7,  1);
      ctx.quadraticCurveTo(7, 7, 0, 9);
      ctx.quadraticCurveTo(-7, 7, -7, 1);
      ctx.lineTo(-7, -5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      return;
    }

    const color = this.type === 'triple' ? '#8f8' : '#3ff';

    // Aro exterior
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(this.rot);

    if (this.type === 'triple') {
      // Tres chevrons en abanico
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.8;
      ctx.lineCap     = 'round';
      for (let i = -1; i <= 1; i++) {
        const a = i * 0.45;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo( 2,  0);
        ctx.lineTo(-4,  5);
        ctx.stroke();
        ctx.restore();
      }
      ctx.lineCap = 'butt';
    } else {
      // Rayo
      ctx.beginPath();
      ctx.moveTo( 2, -8);
      ctx.lineTo(-5,  1);
      ctx.lineTo( 0,  1);
      ctx.lineTo(-2,  8);
      ctx.lineTo( 5, -1);
      ctx.lineTo( 0, -1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Skins de la nave ──────────────────────────────────────────────────────────
const SKIN_MESSAGE_DURATION = 2;
const SKIN_STORAGE_KEY = 'asteroids.skin';

const SKINS = [
  {
    name: 'CLÁSICA',
    stroke: '#fff',
    flame: 'rgba(255, 130, 0, 0.85)',
    flameBoost: 'rgba(0, 220, 255, 0.9)',
    halo: 'rgba(0, 220, 255, 0.5)',
    hull: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
    flameX: -8,
    flameHalf: 4,
  },
  {
    name: 'CAZA',
    stroke: '#3ff',
    flame: 'rgba(120, 240, 255, 0.85)',
    flameBoost: 'rgba(255, 255, 255, 0.9)',
    halo: 'rgba(120, 240, 255, 0.5)',
    hull: [[22, 0], [-8, -11], [-4, -4], [-13, 0], [-4, 4], [-8, 11]],
    flameX: -10,
    flameHalf: 3,
  },
  {
    name: 'OVNI',
    stroke: '#7f7',
    flame: 'rgba(160, 255, 160, 0.85)',
    flameBoost: 'rgba(220, 255, 120, 0.9)',
    halo: 'rgba(160, 255, 160, 0.5)',
    hull: [[14, 0], [10, -5], [0, -7], [-10, -5], [-14, 0], [-10, 5], [0, 7], [10, 5]],
    flameX: -12,
    flameHalf: 4,
  },
  {
    name: 'FLECHA',
    stroke: '#fa3',
    flame: 'rgba(255, 190, 60, 0.85)',
    flameBoost: 'rgba(255, 255, 180, 0.9)',
    halo: 'rgba(255, 210, 90, 0.5)',
    hull: [[24, 0], [-6, -8], [-6, -3], [-14, 0], [-6, 3], [-6, 8]],
    flameX: -9,
    flameHalf: 3,
  },
];

function drawHull(hull, scale = 1) {
  ctx.beginPath();
  ctx.moveTo(hull[0][0] * scale, hull[0][1] * scale);
  for (let i = 1; i < hull.length; i++)
    ctx.lineTo(hull[i][0] * scale, hull[i][1] * scale);
  ctx.closePath();
}

function loadSkin() {
  try {
    const raw = localStorage.getItem(SKIN_STORAGE_KEY);
    const idx = Number.parseInt(raw, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < SKINS.length) return idx;
  } catch (e) { /* localStorage no disponible */ }
  return 0;
}

function saveSkin(idx) {
  try { localStorage.setItem(SKIN_STORAGE_KEY, String(idx)); }
  catch (e) { /* localStorage no disponible */ }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.boostTimer    = 0;
    this.shieldTimer   = 0;
    this.tripleTimer   = 0;
    this.dead          = false;
  }

  get boosting()  { return this.boostTimer > 0; }
  get shielding() { return this.shieldTimer > 0; }
  get triple()   { return this.tripleTimer > 0; }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.boostTimer    > 0) this.boostTimer    -= dt;
    if (this.shieldTimer   > 0) this.shieldTimer   -= dt;
    if (this.tripleTimer   > 0) this.tripleTimer   -= dt;

    const ROT    = 3.5;   // rad/s
    const THRUST = 260 * (this.boosting ? BOOST_MULT : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const angles = this.triple
      ? [this.angle - TRIPLE_SPREAD, this.angle, this.angle + TRIPLE_SPREAD]
      : [this.angle];
    return angles.map(a => new Bullet(ox, oy, a));
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.stroke;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta según la skin activa
    drawHull(skin.hull);
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const len = this.boosting ? rand(11, 24) : rand(6, 14);
      const h   = skin.flameHalf;
      ctx.beginPath();
      ctx.moveTo(skin.flameX, -h);
      ctx.lineTo(skin.flameX - len, 0);
      ctx.lineTo(skin.flameX,  h);
      ctx.strokeStyle = this.boosting ? skin.flameBoost : skin.flame;
      ctx.stroke();
    }

    // Halo mientras dura el turbo
    if (this.boosting) {
      ctx.strokeStyle = skin.halo;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Burbuja de escudo
    if (this.shielding) {
      const pulse = 0.5 + 0.5 * Math.sin(this.shieldTimer * 8);
      ctx.strokeStyle = `rgba(90, 255, 150, ${(0.35 + 0.45 * pulse).toFixed(2)})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(90, 255, 150, ${(0.05 + 0.08 * pulse).toFixed(2)})`;
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let powerUpTimer, boostCooldown, shootingStarTimer;
let skinIndex = loadSkin();
let skinMsgTimer = 0;

function spawnPowerUp(type = 'boost') {
  const SAFE_DIST = 130;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (
    Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST ||
    asteroids.some(a => Math.hypot(x - a.x, y - a.y) < a.radius + 40)
  );
  return new PowerUp(x, y, type);
}

function spawnShootingStar() {
  const SAFE_DIST = 180;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (
    ship && !ship.dead && Math.hypot(x - ship.x, y - ship.y) < SAFE_DIST
  );
  return new ShootingStar(x, y);
}

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerUpTimer = POWERUP_DELAY;
  boostCooldown = 0;
  shootingStarTimer = SHOOTING_STAR_INTERVAL;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  powerUpTimer = POWERUP_DELAY;
  boostCooldown = 0;
  shootingStarTimer = SHOOTING_STAR_INTERVAL;
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (skinMsgTimer > 0) skinMsgTimer -= dt;

  // Cambiar de skin (disponible en cualquier estado)
  if (pressed('KeyS')) {
    skinIndex = (skinIndex + 1) % SKINS.length;
    saveSkin(skinIndex);
    skinMsgTimer = SKIN_MESSAGE_DURATION;
  }

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerUps.forEach(p => p.update(dt));
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  if (boostCooldown > 0) boostCooldown -= dt;
  if (powerUpTimer  > 0) powerUpTimer  -= dt;
  if (shootingStarTimer > 0) shootingStarTimer -= dt;

  // Aparición de power-up (turbo/escudo/triple, 50/25/25)
  if (powerUps.length === 0 && ship.boostTimer <= 0 && ship.shieldTimer <= 0 &&
      ship.tripleTimer <= 0 && boostCooldown <= 0 && powerUpTimer <= 0) {
    const r = Math.random();
    const type = r < 0.5 ? 'boost' : r < 0.75 ? 'shield' : 'triple';
    powerUps.push(spawnPowerUp(type));
    powerUpTimer = POWERUP_INTERVAL;
  }

  // Aparición de la estrella fugaz
  if (shootingStarTimer <= 0 && !asteroids.some(a => a.special)) {
    asteroids.push(spawnShootingStar());
    shootingStarTimer = SHOOTING_STAR_INTERVAL;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  const wasBoosting = ship.boosting;
  ship.update(dt);
  if (wasBoosting && !ship.boosting) boostCooldown = BOOST_COOLDOWN;

  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  // Nave recoge el power-up
  for (const p of powerUps) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'shield') ship.shieldTimer = SHIELD_DURATION;
      else if (p.type === 'triple') ship.tripleTimer = TRIPLE_DURATION;
      else ship.boostTimer = BOOST_DURATION;
    }
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += a.points;
        explode(a.x, a.y, a.special ? 16 : a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shielding) {
          // El escudo destruye el asteroide en lugar de dañar la nave
          a.dead = true;
          score += a.points;
          explode(a.x, a.y, a.special ? 16 : a.size * 5);
          asteroids.push(...a.split());
        } else {
          killShip();
        }
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead);
  }

  // Nivel completado (la estrella fugaz no cuenta)
  if (!asteroids.some(a => !a.special)) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[skinIndex];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = skin.stroke;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  drawHull(skin.hull, 0.45);
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicadores de power-ups activos
  ctx.textAlign = 'left';
  let hudY = 48;

  if (ship.boosting && !ship.dead) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3ff';
    ctx.fillText(`TURBO x${BOOST_MULT}  ${ship.boostTimer.toFixed(1)}s`, 14, hudY);
    hudY += 20;
  }
  if (ship.shielding && !ship.dead) {
    ctx.fillStyle = '#5f8';
    ctx.fillText(`ESCUDO  ${ship.shieldTimer.toFixed(1)}s`, 14, hudY);
    hudY += 20;
  }
  if (ship.triple && !ship.dead) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8f8';
    ctx.fillText(`TRIPLE  3x  ${ship.tripleTimer.toFixed(1)}s`, 14, hudY);
  }

  // Aviso temporal al cambiar de skin
  if (skinMsgTimer > 0) {
    const alpha = Math.min(1, skinMsgTimer / 0.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = SKINS[skinIndex].stroke;
    ctx.globalAlpha = alpha;
    ctx.fillText(`SKIN: ${SKINS[skinIndex].name}`, 14, H - 14);
    ctx.globalAlpha = 1;
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  powerUps.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
