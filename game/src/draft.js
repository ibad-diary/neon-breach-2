// The roguelite draft: after a sector falls, the player picks 1 of 3
// upgrades. Each upgrade names what it does in one line — the draft screen
// shows exactly that — and caps at a small stack so no run snowballs into
// a joke. `owned` maps upgrade id to its current stack.

export const UPGRADES = [
  {
    id: 'W',
    name: 'WIDE PADDLE',
    desc: '+30 paddle width. Easier saves, same hands.',
    max: 2,
    apply(state) {
      state.paddle.width += 30;
    },
  },
  {
    id: 'M',
    name: 'MULTI-BALL',
    desc: 'Split every ball into three. Chaos, but yours.',
    max: 3,
    apply(state) {
      state.splitBalls();
    },
  },
  {
    id: 'L',
    name: 'LASER PADDLE',
    desc: 'Space fires bolts that smash bricks. Hold to spray.',
    max: 1,
    apply(state) {
      state.upgrades.laser = true;
    },
  },
  {
    id: 'F',
    name: 'FIREBALL',
    desc: 'Balls burn through bricks instead of bouncing off.',
    max: 1,
    apply(state) {
      for (const ball of state.balls) ball.fire = true;
      state.upgrades.fire = true;
    },
  },
  {
    id: 'S',
    name: 'SLOW FIELD',
    desc: 'Balls run 30% slower for 10 seconds, every sector.',
    max: 2,
    apply(state) {
      state.upgrades.slowStacks += 1;
      state.slowTimer = 10;
    },
  },
  {
    id: 'E',
    name: 'EXTRA LIFE',
    desc: '+1 life, up to 5. The breach is patient; be more so.',
    max: 3,
    apply(state) {
      state.lives = Math.min(5, state.lives + 1);
    },
  },
  {
    id: 'T',
    name: 'STICKY PADDLE',
    desc: 'Caught balls stick. Aim, then launch with Space.',
    max: 1,
    apply(state) {
      state.upgrades.sticky = true;
    },
  },
  {
    id: 'G',
    name: 'GUARD FLOOR',
    desc: 'A shield line saves one dropped ball per sector.',
    max: 1,
    apply(state) {
      state.upgrades.guard = true;
      state.guardUp = true;
    },
  },
  {
    id: 'X',
    name: 'SCORE SURGE',
    desc: '+750 points, right now. Always on the table.',
    max: 99,
    apply(state) {
      state.score += 750;
    },
  },
];

// Three distinct upgrades the player does not already own to the cap.
// The surge is always available, so a draft is never empty.
export function rollDraft(random, owned) {
  const pool = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max);
  return random.shuffle(pool).slice(0, 3);
}

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id) ?? null;
}
