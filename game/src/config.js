// NEON BREACH — one place for every number the game tunes on.
// Palette: deep-space background, one neon colour per brick tier, so the
// field reads as a glowing wall even when the screenshot is shrunk.

export const FIELD = { width: 960, height: 640 };
export const STEP = 1 / 60;
export const LIVES_START = 3;
export const LIVES_MAX = 5;
export const SECTORS = 8;
export const BEST_KEY = 'neon-breach-best';

export const WALL = 10; // thickness of the side/top neon walls
export const PADDLE_Y = 596;
export const PADDLE_START_WIDTH = 112;
export const PADDLE_HEIGHT = 14;
export const PADDLE_SPEED = 660;
export const PADDLE_WIDE_BONUS = 30;

export const BALL_RADIUS = 7;
export const BALL_BASE_SPEED = 520;
export const BALL_SECTOR_SPEED = 25;
export const BALL_MAX_SPEED = 720;
export const BALL_MAX_COUNT = 5;
export const BALL_RAMP_PER_BRICK = 5; // ball speeds up as the wall falls
export const BALL_RAMP_MAX = 180;

export const BRICK = { width: 92, height: 26, gap: 8, top: 84 };
export const BRICK_SCORE = [0, 50, 100, 150]; // by tier 1..3
export const POWERUP_DROP_CHANCE = 0.18;
export const POWERUP_FALL_SPEED = 185;

export const COMBO_STEP = 8; // every 8 unbroken hits raises the multiplier
export const COMBO_MAX_MULT = 3;

export const LASER_COOLDOWN = 0.35;
export const LASER_SPEED = 720;
export const SLOW_DURATION = 10; // seconds of slowed ball

export const BOSS = { width: 190, height: 36, hp: 24, speed: 150, y: 300 };

export const NEON = {
  background: '#050514',
  grid: 'rgba(90, 120, 255, 0.10)',
  wall: '#2b3a8f',
  wallGlow: '#5a78ff',
  paddle: '#22d3ee',
  paddleEdge: '#a5f3fc',
  ball: '#ffffff',
  ballTrail: 'rgba(160, 240, 255, 0.55)',
  text: '#e8f4ff',
  dim: '#8ea2c8',
  danger: '#ff3b5c',
  gold: '#ffd166',
  // one colour per brick tier; tier 0 is the indestructible core
  brick: ['#3d4a7a', '#22d3ee', '#ff2d78', '#ffd166'],
  brickEdge: ['#5a6aa0', '#a5f3fc', '#ff8fb3', '#ffe9a8'],
  powerup: {
    W: '#22d3ee',
    M: '#f472b6',
    L: '#ffd166',
    F: '#ff6b35',
    S: '#a78bfa',
    E: '#39ff88',
    T: '#facc15',
    G: '#38bdf8',
    X: '#e879f9',
  },
};
