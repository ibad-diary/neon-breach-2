// The screenshot scenes behind ?shot=start|play|draft|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (predict where the ball meets the paddle,
// keep the paddle under it), so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_DRAFT, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { rollDraft } from './draft.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const DRAFT_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Where the ball will be horizontally when it reaches the paddle's line. */
function predictX(state) {
  const ball = state.balls.find((b) => !b.stuck);
  if (!ball || ball.vy <= 0) return FIELD.width / 2;
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  const vy = ball.vy;
  const targetY = state.paddle.y;
  while (y < targetY) {
    const t = Math.min((targetY - y) / vy, 0.5);
    x += vx * t;
    y += vy * t;
    if (x < 10) {
      x = 20 - x;
      vx = Math.abs(vx);
    } else if (x > FIELD.width - 10) {
      x = 2 * (FIELD.width - 10) - x;
      vx = -Math.abs(vx);
    }
    if (t < 0.5) break;
  }
  return x;
}

/** Steer toward the predicted landing spot; launch a stuck ball. */
function autopilot(world) {
  const state = world.state;
  if (state.balls.some((b) => b.stuck)) {
    world.launchBall();
    return 0;
  }
  const target = predictX(state);
  const centre = state.paddle.x + state.paddle.width / 2;
  if (target > centre + 6) return 1;
  if (target < centre - 6) return -1;
  return 0;
}

/**
 * Set `world` to the named scene (start, play, draft or end; any other name
 * is start) and return the screen to draw and the best score to show.
 * `random` is the world's own RNG, used for the draft roll.
 */
export function stageShot(name, world, random) {
  world.reset();
  if (name !== 'play' && name !== 'draft' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, null, true);
    return { screen: SCREEN_TITLE, best: 0, draft: null };
  }

  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'draft' ? DRAFT_LIMIT_SECONDS : PLAY_SECONDS;
  let result = { screen: SCREEN_PLAY, best: world.state.score, draft: null };
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world), null, false);
    if (events & EVENT_WIN) {
      // The end shot shows the victory screen when the pilot wins.
      result = { screen: name === 'end' ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score, draft: null };
      break;
    }
    if (events & EVENT_OVER) {
      result = { screen: SCREEN_OVER, best: world.state.score, draft: null };
      break;
    }
    if (events & EVENT_CLEAR) {
      if (name === 'draft') {
        const choices = rollDraft(random, world.state.upgrades.counts);
        result = { screen: SCREEN_DRAFT, best: world.state.score, draft: choices };
      } else {
        result = { screen: SCREEN_PLAY, best: world.state.score, draft: null };
      }
      break;
    }
  }
  if (name === 'end' && result.screen !== SCREEN_OVER) {
    // A careful pilot can survive a long time; force the loss frame by
    // letting the ball drop. A served ball sits stuck on the paddle until
    // launched, so launch it, then park the paddle against the wall
    // farthest from where the ball will land so it drops for good.
    // (Without the launch, the loop just waited out 600s on a stuck ball
    // and the shot came out as plain play with an empty wall.)
    for (let i = 0; i < 600 / STEP; i += 1) {
      if (world.state.balls.some((b) => b.stuck)) world.launchBall();
      const landing = predictX(world.state);
      const dir = landing < FIELD.width / 2 ? 1 : -1;
      const events = world.step(STEP, dir, null, false);
      if (events & EVENT_OVER) {
        result = { screen: SCREEN_OVER, best: world.state.score, draft: null };
        break;
      }
      if (events & EVENT_WIN) break;
    }
  }
  return result;
}
