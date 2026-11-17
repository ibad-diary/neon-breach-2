// The moving things: paddle, balls, laser bolts, falling power-ups and the
// sparks a smashed brick leaves behind. This file owns their shapes and
// their per-frame motion; the world owns the rules that use them.

import {
  BALL_MAX_COUNT,
  BALL_RADIUS,
  FIELD,
  LASER_SPEED,
  PADDLE_HEIGHT,
  PADDLE_START_WIDTH,
  PADDLE_Y,
  POWERUP_FALL_SPEED,
} from './config.js';

export function createPaddle() {
  return {
    x: (FIELD.width - PADDLE_START_WIDTH) / 2,
    y: PADDLE_Y,
    width: PADDLE_START_WIDTH,
    height: PADDLE_HEIGHT,
    laserCooldown: 0,
  };
}

export function createBall(x, y, vx, vy, fire) {
  return { x, y, vx, vy, r: BALL_RADIUS, fire: !!fire, trail: [] };
}

export function createBolt(x, y) {
  return { x, y, vy: -LASER_SPEED, width: 5, height: 16 };
}

export function createPowerUp(x, y, kind) {
  return { x, y, kind, vy: POWERUP_FALL_SPEED, width: 30, height: 18, wobble: 0 };
}

export function createParticle(x, y, color, speed, life, size) {
  const angle = Math.random() * Math.PI * 2;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 40,
    color,
    life,
    maxLife: life,
    size,
  };
}

export function burst(particles, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push(createParticle(x, y, color, 60 + Math.random() * 220, 0.35 + Math.random() * 0.4, 2 + Math.random() * 3));
  }
  if (particles.length > 320) particles.splice(0, particles.length - 320);
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.vx *= 1 - 0.6 * dt;
  }
}

export function updatePowerUps(powerups, dt) {
  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    const p = powerups[i];
    p.y += p.vy * dt;
    p.wobble += dt * 6;
    if (p.y > FIELD.height + 24) powerups.splice(i, 1);
  }
}

export function updateBolts(bolts, dt) {
  for (let i = bolts.length - 1; i >= 0; i -= 1) {
    const b = bolts[i];
    b.y += b.vy * dt;
    if (b.y < -20) bolts.splice(i, 1);
  }
}

// Keep a short fading trail behind a ball so fast motion reads on screen.
export function pushTrail(ball) {
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 9) ball.trail.shift();
}

export function splitBalls(balls, maxCount) {
  if (balls.length >= maxCount) return;
  const out = [];
  for (const ball of balls) {
    if (out.length + balls.length >= maxCount) break;
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = Math.atan2(ball.vy, ball.vx);
    for (const delta of [-0.45, 0.45]) {
      if (balls.length + out.length >= maxCount) break;
      out.push(createBall(ball.x, ball.y, Math.cos(angle + delta) * speed, Math.sin(angle + delta) * speed, ball.fire));
    }
  }
  balls.push(...out.slice(0, maxCount - balls.length));
}

export { BALL_MAX_COUNT };
