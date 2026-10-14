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

// ── Power-up de triple shot ───────────────────────────────────────────────────
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

// ── Power-up (turbo) ──────────────────────────────────────────────────────────
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
    this.tripleTimer   = 0;
    this.dead          = false;
  }

  get boosting() { return this.boostTimer > 0; }
  get triple()   { return this.tripleTimer > 0; }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.boostTimer    > 0) this.boostTimer    -= dt;
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

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const len = this.boosting ? rand(11, 24) : rand(6, 14);
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - len, 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = this.boosting
        ? 'rgba(0, 220, 255, 0.9)'
        : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    // Halo cian mientras dura el turbo
    if (this.boosting) {
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
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

function spawnPowerUp() {
  const SAFE_DIST = 130;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (
    Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST ||
    asteroids.some(a => Math.hypot(x - a.x, y - a.y) < a.radius + 40)
  );
  const type = Math.random() < 0.5 ? 'boost' : 'triple';
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

  // Aparición del power-up de velocidad
  if (powerUps.length === 0 && ship.boostTimer <= 0 &&
      ship.tripleTimer <= 0 && boostCooldown <= 0 && powerUpTimer <= 0) {
    powerUps.push(spawnPowerUp());
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
      if (p.type === 'triple') ship.tripleTimer = TRIPLE_DURATION;
      else                     ship.boostTimer  = BOOST_DURATION;
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
        killShip();
        break;
      }
    }
  }

  // Nivel completado (la estrella fugaz no cuenta)
  if (!asteroids.some(a => !a.special)) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
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

  // Indicador de turbo activo
  let indicatorY = 48;
  if (ship.boosting && !ship.dead) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3ff';
    ctx.fillText(`TURBO x${BOOST_MULT}  ${ship.boostTimer.toFixed(1)}s`, 14, indicatorY);
    indicatorY += 20;
  }

  // Indicador de triple shot activo
  if (ship.triple && !ship.dead) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8f8';
    ctx.fillText(`TRIPLE  3x  ${ship.tripleTimer.toFixed(1)}s`, 14, indicatorY);
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
