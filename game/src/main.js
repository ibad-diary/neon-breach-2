// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, draft, paused, game over and victory.
//
// ?seed=N fixes the sectors and drops. ?shot=start|play|draft|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES_START, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CLEAR,
  EVENT_HIT,
  EVENT_LOST,
  EVENT_OVER,
  EVENT_POWER,
  EVENT_WIN,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_LAUNCH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_DRAFT,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { rollDraft } from './draft.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
const MOUSE_IDLE_MS = 2500;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, random);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.draft, performance.now());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let draftChoices = [];
  let lastMouseMove = 0;
  let lastMouseX = null;
  let justPicked = false; // a click that picks a card must not also launch
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    draftChoices = [];
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce(`Playing. ${LIVES_START} lives. Clear 8 sectors.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.stopMusic();
    if (won) audio.win();
    else audio.over();
    announce(won ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function openDraft() {
    draftChoices = rollDraft(random, world.state.upgrades.counts);
    screen = SCREEN_DRAFT;
    audio.clear();
    announce('Sector cleared. Choose one upgrade: 1, 2 or 3.');
  }

  function pickDraft(index) {
    const choice = draftChoices[index];
    if (!choice) return;
    world.applyUpgrade(choice.id);
    audio.power();
    justPicked = true;
    world.startSector(world.state.sector + 1);
    screen = SCREEN_PLAY;
    announce(`Took ${choice.name}. Sector ${world.state.sector}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    const picked = justPicked;
    justPicked = false;
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_DRAFT) {
      if (actions & 16) pickDraft(0);
      else if (actions & 32) pickDraft(1);
      else if (actions & 64) pickDraft(2);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        audio.stopMusic();
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        audio.startMusic();
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PLAY && actions & ACTION_LAUNCH) {
      if (picked) {
        // The click that picked the card must not also launch the ball.
      } else if (world.launchBall()) audio.launch();
      else if (world.state.upgrades.laser) {
        world.fireLaser();
        audio.laser();
      }
    }
  }

  function handleMouse() {
    const x = input.mouseX();
    if (x !== null && x !== lastMouseX) {
      lastMouseX = x;
      lastMouseMove = performance.now();
    }
    if (input.clicked()) {
      audio.unlock();
      if (screen === SCREEN_DRAFT) {
        // Clicking a card picks it: cards are laid out in render.js
        // (three 250x220 cards starting at y 210).
        const pos = input.clickPos();
        const cardW = 250;
        const gap = 30;
        const count = draftChoices.length;
        const totalW = cardW * count + gap * (count - 1);
        const startX = (960 - totalW) / 2;
        if (pos && pos.y >= 210 && pos.y <= 430 && pos.x >= startX && pos.x < startX + totalW) {
          const index = Math.floor((pos.x - startX) / (cardW + gap));
          if (index >= 0 && index < 3) pickDraft(index);
        }
      }
    } else {
      input.clickPos();
    }
  }

  function mouseTarget() {
    if (lastMouseX === null) return null;
    if (performance.now() - lastMouseMove > MOUSE_IDLE_MS) return null;
    return lastMouseX;
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, null, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.direction(), mouseTarget(), false);
    if (events & EVENT_HIT) audio.brick(world.state.combo);
    if (events & EVENT_POWER) audio.power();
    if (events & EVENT_LOST) audio.lose();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_CLEAR) openDraft();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleMouse();
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, draftChoices, now);
  }

  // Leaving the tab pauses a running game rather than letting balls fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopMusic();
      announce('Paused.');
    }
  });

  announce('Neon Breach. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
