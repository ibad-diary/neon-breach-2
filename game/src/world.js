// NEON BREACH — the rules. One world holds the score, lives, sector,
// paddle, balls, bricks, the boss and every upgrade, and advances them in
// fixed steps. The renderer only paints this state; the input only steers it.

import {
  BALL_BASE_SPEED,
  BALL_MAX_COUNT,
  BALL_MAX_SPEED,
  BALL_RAMP_MAX,
  BALL_RAMP_PER_BRICK,
  BALL_SECTOR_SPEED,
  BOSS,
  BRICK,
  BRICK_SCORE,
  COMBO_MAX_MULT,
  COMBO_STEP,
  FIELD,
  LASER_COOLDOWN,
  LIVES_START,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_START_WIDTH,
  PADDLE_Y,
  POWERUP_DROP_CHANCE,
  SECTORS,
  SLOW_DURATION,
  WALL,
} from './config.js';
import { upgradeById } from './draft.js';
import {
  burst,
  createBall,
  createBolt,
  createPaddle,
  createPowerUp,
  pushTrail,
  splitBalls as splitBallsInto,
  updateBolts,
  updateParticles,
  updatePowerUps,
} from './entities.js';
import { NEON } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_LOST = 2;
export const EVENT_CLEAR = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_POWER = 32;
export const EVENT_BOSS_HIT = 64;

function sectorSpeed(sector) {
  return Math.min(BALL_BASE_SPEED + (sector - 1) * BALL_SECTOR_SPEED, BALL_MAX_SPEED);
}

// One sector's brick wall. Patterns change per sector: plain rows, a
// checkerboard, a pyramid, drifting rows, indestructible cores, then the
// boss sector with a short wall above the boss itself.
function buildBricks(sector, random) {
  const cols = 8;
  const totalW = cols * BRICK.width + (cols - 1) * BRICK.gap;
  const startX = (FIELD.width - totalW) / 2;
  const bricks = [];
  const rows = sector === 1 || sector === 8 ? 3 : sector === 2 || sector === 3 || sector === 4 ? 4 : 5;

  function tierFor(row) {
    let tier = 1;
    if (row % 3 === 2) tier += 1;
    if (sector >= 6 && row % 2 === 0) tier += 1;
    return Math.min(tier, 3);
  }
  function addBrick(col, row, tier, moving) {
    const brick = {
      x: startX + col * (BRICK.width + BRICK.gap),
      y: BRICK.top + row * (BRICK.height + BRICK.gap),
      w: BRICK.width,
      h: BRICK.height,
      tier,
      hp: tier,
      maxHp: tier,
      core: false,
      moving: !!moving,
      dir: moving ? (col % 2 === 0 ? 1 : -1) : 0,
      speed: moving ? 30 + sector * 5 : 0,
      baseX: 0,
      flash: 0,
    };
    brick.baseX = brick.x;
    bricks.push(brick);
  }

  for (let row = 0; row < rows; row += 1) {
    const count = sector === 3 ? Math.min(3 + row * 2, cols) : cols;
    const offset = Math.floor((cols - count) / 2);
    for (let i = 0; i < count; i += 1) {
      const col = offset + i;
      if (sector === 2 && (row + col) % 2 === 0 && row !== 2) continue; // checker gaps
      if (sector === 5 && (col === 1 || col === 2 || col === 5 || col === 6) && row % 2 === 1) continue; // columns
      const moving = (sector === 4 && row === 2) || (sector === 7 && (row === 1 || row === 4));
      addBrick(col, row, tierFor(row), moving);
    }
  }
  if (sector === 6) {
    // Two indestructible cores guard the middle of the wall.
    for (const col of [3, 4]) {
      const brick = {
        x: startX + col * (BRICK.width + BRICK.gap),
        y: BRICK.top + 2 * (BRICK.height + BRICK.gap),
        w: BRICK.width,
        h: BRICK.height,
        tier: 0,
        hp: Infinity,
        maxHp: Infinity,
        core: true,
        moving: false,
        dir: 0,
        speed: 0,
        baseX: 0,
        flash: 0,
      };
      brick.baseX = brick.x;
      bricks.push(brick);
    }
  }
  return bricks;
}

export function createWorld(random) {
  const state = {
    score: 0,
    lives: LIVES_START,
    sector: 1,
    combo: 0,
    mult: 1,
    paddle: createPaddle(),
    balls: [],
    bolts: [],
    particles: [],
    powerups: [],
    bricks: [],
    boss: null,
    bossHits: 0,
    upgrades: { laser: false, fire: false, sticky: false, guard: false, slowStacks: 0, counts: {} },
    slowTimer: 0,
    guardUp: false,
    launching: true,
    ballSpeedBonus: 0,
  };
  // The draft's apply() calls this on the state; it lives here so the
  // draft module never has to know how balls are stored.
  state.splitBalls = () => {
    splitBallsInto(state.balls, BALL_MAX_COUNT);
  };

  function ballSpeed() {
    return (sectorSpeed(state.sector) + state.ballSpeedBonus) * (state.slowTimer > 0 ? 0.7 : 1);
  }

  function serveBall() {
    const paddle = state.paddle;
    const ball = createBall(paddle.x + paddle.width / 2, paddle.y - 9, 0, 0, state.upgrades.fire);
    ball.stuck = true;
    state.balls = [ball];
    state.launching = true;
  }

  function startSector(sector) {
    state.sector = sector;
    state.bricks = buildBricks(sector, random);
    state.bolts = [];
    state.powerups = [];
    state.guardUp = !!state.upgrades.guard;
    state.slowTimer = state.upgrades.slowStacks > 0 ? SLOW_DURATION : 0;
    if (sector === SECTORS) {
      state.boss = {
        x: (FIELD.width - BOSS.width) / 2,
        y: BOSS.y,
        w: BOSS.width,
        h: BOSS.height,
        hp: BOSS.hp,
        maxHp: BOSS.hp,
        dir: 1,
        speed: BOSS.speed,
        flash: 0,
      };
      state.bossHits = 0;
    } else {
      state.boss = null;
    }
    serveBall();
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES_START;
    state.combo = 0;
    state.mult = 1;
    state.paddle = createPaddle();
    state.particles = [];
    state.powerups = [];
    state.bolts = [];
    state.upgrades = { laser: false, fire: false, sticky: false, guard: false, slowStacks: 0, counts: {} };
    state.slowTimer = 0;
    state.guardUp = false;
    startSector(1);
  }

  function applyUpgrade(id) {
    const upgrade = upgradeById(id);
    if (!upgrade) return false;
    const owned = state.upgrades.counts[id] ?? 0;
    if (owned >= upgrade.max) return false;
    upgrade.apply(state);
    state.upgrades.counts[id] = owned + 1;
    return true;
  }

  function launchBall() {
    let launched = false;
    for (const ball of state.balls) {
      if (!ball.stuck) continue;
      const speed = ballSpeed();
      const angle = random.range(-0.35, 0.35);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.stuck = false;
      launched = true;
    }
    if (launched) state.launching = false;
    return launched;
  }

  function fireLaser() {
    const paddle = state.paddle;
    if (!state.upgrades.laser || paddle.laserCooldown > 0) return;
    paddle.laserCooldown = LASER_COOLDOWN;
    state.bolts.push(createBolt(paddle.x + 14, paddle.y - 8));
    state.bolts.push(createBolt(paddle.x + paddle.width - 14, paddle.y - 8));
  }

  function damageBrick(brick, events) {
    if (brick.core) return events;
    brick.hp -= 1;
    brick.flash = 0.12;
    if (brick.hp > 0) return events | EVENT_HIT;
    const index = state.bricks.indexOf(brick);
    if (index !== -1) state.bricks.splice(index, 1);
    state.combo += 1;
    state.mult = 1 + Math.min(Math.floor(state.combo / COMBO_STEP), COMBO_MAX_MULT - 1);
    state.score += BRICK_SCORE[brick.tier] * state.mult;
    state.ballSpeedBonus = Math.min(state.ballSpeedBonus + BALL_RAMP_PER_BRICK, BALL_RAMP_MAX);
    burst(state.particles, brick.x + brick.w / 2, brick.y + brick.h / 2, NEON.brick[brick.tier], 14);
    if (random.chance(POWERUP_DROP_CHANCE) && state.powerups.length < 2) {
      const kinds = ['W', 'M', 'L', 'F', 'S', 'E', 'T', 'G'];
      state.powerups.push(createPowerUp(brick.x + brick.w / 2, brick.y + brick.h, random.pick(kinds)));
    }
    return events | EVENT_HIT;
  }

  function damageBoss(events) {
    const boss = state.boss;
    if (!boss) return events;
    boss.hp -= 1;
    boss.flash = 0.12;
    state.bossHits += 1;
    state.score += 25;
    burst(state.particles, boss.x + boss.w / 2, boss.y + boss.h / 2, '#ff3b5c', 10);
    if (state.bossHits % 6 === 0 && state.powerups.length < 2) {
      const kinds = ['W', 'M', 'E', 'G'];
      state.powerups.push(createPowerUp(boss.x + boss.w / 2, boss.y + boss.h, random.pick(kinds)));
    }
    if (boss.hp <= 0) {
      burst(state.particles, boss.x + boss.w / 2, boss.y + boss.h / 2, '#ffd166', 60);
      state.score += 2000;
      state.boss = null;
      return events | EVENT_BOSS_HIT | EVENT_WIN;
    }
    return events | EVENT_BOSS_HIT;
  }

  function hitPaddle(ball) {
    const paddle = state.paddle;
    const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
    const speed = ballSpeed();
    const angle = offset * 1.05; // at most 60 degrees off vertical
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    ball.y = paddle.y - ball.r - 0.5;
    if (state.upgrades.sticky) {
      ball.stuck = true;
      ball.vx = 0;
      ball.vy = 0;
      state.launching = true;
    }
    state.combo = 0;
    state.mult = 1;
  }

  function stepBall(ball, dt) {
    let events = 0;
    if (ball.stuck) {
      ball.x = state.paddle.x + state.paddle.width / 2;
      ball.y = state.paddle.y - ball.r - 1;
      return events;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    pushTrail(ball);
    // Keep every ball at the sector's current speed (ramp + slow-mo).
    const speed = ballSpeed();
    const current = Math.hypot(ball.vx, ball.vy);
    if (current > 0) {
      ball.vx = (ball.vx / current) * speed;
      ball.vy = (ball.vy / current) * speed;
    }

    if (ball.x - ball.r < WALL) {
      ball.x = WALL + ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r > FIELD.width - WALL) {
      ball.x = FIELD.width - WALL - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.r < WALL) {
      ball.y = WALL + ball.r;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle: only when falling onto it.
    const paddle = state.paddle;
    if (
      ball.vy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y - ball.r < paddle.y + PADDLE_HEIGHT &&
      ball.x > paddle.x - ball.r &&
      ball.x < paddle.x + paddle.width + ball.r
    ) {
      hitPaddle(ball);
      events |= EVENT_HIT;
    }

    // Bricks: circle against box; bounce off the shallow axis.
    for (let i = state.bricks.length - 1; i >= 0; i -= 1) {
      const brick = state.bricks[i];
      const nearX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
      const nearY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
      const dx = ball.x - nearX;
      const dy = ball.y - nearY;
      if (dx * dx + dy * dy > ball.r * ball.r) continue;
      if (brick.core) {
        if (Math.abs(dx) > Math.abs(dy)) {
          ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
          ball.x = dx > 0 ? brick.x + brick.w + ball.r : brick.x - ball.r;
        } else {
          ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
          ball.y = dy > 0 ? brick.y + brick.h + ball.r : brick.y - ball.r;
        }
        events |= EVENT_HIT;
        continue;
      }
      events = damageBrick(brick, events);
      if (!ball.fire) {
        if (Math.abs(dx) > Math.abs(dy)) {
          ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        } else {
          ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        }
      }
    }

    // Boss: same treatment as a big brick.
    const boss = state.boss;
    if (boss) {
      const nearX = Math.max(boss.x, Math.min(ball.x, boss.x + boss.w));
      const nearY = Math.max(boss.y, Math.min(ball.y, boss.y + boss.h));
      const dx = ball.x - nearX;
      const dy = ball.y - nearY;
      if (dx * dx + dy * dy <= ball.r * ball.r) {
        events = damageBoss(events);
        if (!ball.fire) {
          if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
          else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        }
      }
    }

    // Never let a ball go nearly horizontal and shuttle between the walls
    // forever: keep at least a quarter of its speed vertical.
    const minVy = ballSpeed() * 0.25;
    if (Math.abs(ball.vy) < minVy) {
      const speed = Math.hypot(ball.vx, ball.vy) || ballSpeed();
      ball.vy = (ball.vy < 0 ? -1 : 1) * minVy;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
    }
    return events;
  }

  function step(dt, move, mouseX, attract) {
    let events = 0;
    const paddle = state.paddle;
    paddle.laserCooldown = Math.max(0, paddle.laserCooldown - dt);
    if (state.slowTimer > 0) state.slowTimer -= dt;

    // Paddle: mouse position wins when the mouse has moved; keys otherwise.
    if (attract) {
      // The title demo plays itself: stuck balls launch on their own.
      if (state.balls.some((b) => b.stuck)) launchBall();
      const ball = state.balls[0];
      if (ball) {
        const target = ball.x - paddle.width / 2;
        const diff = target - paddle.x;
        paddle.x += Math.max(-PADDLE_SPEED * dt, Math.min(PADDLE_SPEED * dt, diff));
      }
    } else if (mouseX !== null && mouseX !== undefined) {
      paddle.x = mouseX - paddle.width / 2;
    } else if (move !== 0) {
      paddle.x += move * PADDLE_SPEED * dt;
    }
    paddle.x = Math.max(WALL, Math.min(FIELD.width - WALL - paddle.width, paddle.x));

    // Drifting bricks slide around their home column.
    for (const brick of state.bricks) {
      if (!brick.moving) continue;
      brick.x += brick.dir * brick.speed * dt;
      if (brick.x > brick.baseX + 44 || brick.x < brick.baseX - 44) brick.dir *= -1;
      if (brick.flash > 0) brick.flash -= dt;
    }
    if (state.boss) {
      const boss = state.boss;
      boss.x += boss.dir * boss.speed * dt;
      if (boss.x < WALL || boss.x + boss.w > FIELD.width - WALL) boss.dir *= -1;
      if (boss.flash > 0) boss.flash -= dt;
    }

    updateParticles(state.particles, dt);
    updatePowerUps(state.powerups, dt);
    updateBolts(state.bolts, dt);

    // Laser bolts smash bricks and the boss.
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = state.bolts[i];
      let spent = false;
      for (let j = state.bricks.length - 1; j >= 0; j -= 1) {
        const brick = state.bricks[j];
        if (bolt.x > brick.x && bolt.x < brick.x + brick.w && bolt.y > brick.y && bolt.y < brick.y + brick.h) {
          if (!brick.core) events = damageBrick(brick, events);
          spent = true;
          break;
        }
      }
      const boss = state.boss;
      if (!spent && boss && bolt.x > boss.x && bolt.x < boss.x + boss.w && bolt.y > boss.y && bolt.y < boss.y + boss.h) {
        events = damageBoss(events);
        spent = true;
      }
      if (spent) state.bolts.splice(i, 1);
    }

    // Falling power-ups: catch on the paddle, lose at the floor.
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const p = state.powerups[i];
      if (p.y > paddle.y && p.y < paddle.y + PADDLE_HEIGHT + 6 && p.x > paddle.x - 10 && p.x < paddle.x + paddle.width + 10) {
        applyUpgrade(p.kind);
        burst(state.particles, p.x, p.y, NEON.powerup[p.kind], 10);
        state.powerups.splice(i, 1);
        events |= EVENT_POWER;
      }
    }

    // Balls: move, bounce, break, fall.
    for (const ball of state.balls) {
      events |= stepBall(ball, dt);
    }
    for (let i = state.balls.length - 1; i >= 0; i -= 1) {
      const ball = state.balls[i];
      if (ball.stuck) continue;
      if (ball.y - ball.r > FIELD.height) {
        if (state.guardUp) {
          // The guard floor bounces one ball back, then breaks.
          state.guardUp = false;
          ball.y = FIELD.height - ball.r - 1;
          ball.vy = -Math.abs(ball.vy);
          burst(state.particles, ball.x, FIELD.height - 6, NEON.powerup.G, 12);
        } else {
          state.balls.splice(i, 1);
        }
      }
    }

    if (attract) {
      // Title demo: a lost ball comes back from the top; a cleared wall rebuilds.
      if (state.balls.length === 0) serveBall();
      if (state.bricks.length === 0) state.bricks = buildBricks(1, random);
      return events;
    }

    if (state.balls.length === 0) {
      state.lives -= 1;
      state.combo = 0;
      state.mult = 1;
      events |= EVENT_LOST;
      if (state.lives <= 0) return events | EVENT_OVER;
      serveBall();
    }

    const remaining = state.bricks.filter((b) => !b.core).length;
    if (remaining === 0 && !state.boss) {
      if (state.sector >= SECTORS) return events | EVENT_WIN;
      return events | EVENT_CLEAR;
    }
    return events;
  }

  reset();
  return { state, reset, step, startSector, applyUpgrade, launchBall, fireLaser };
}
