// Keyboard + mouse for desktop Chrome. Arrow keys / A D steer the paddle,
// the mouse steers it by position, Space or a click launches and confirms,
// P pauses, M mutes, 1/2/3 pick a draft card. Actions are consumed once per
// frame so a held key never double-fires a menu.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_LAUNCH = 8;

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let mouseX = null;
  let mouseClicked = false;
  let clickPos = null;

  function press(code) {
    if (code === 'Space' || code === 'Enter') queued |= ACTION_CONFIRM | ACTION_LAUNCH;
    else if (code === 'KeyP' || code === 'Escape') queued |= ACTION_PAUSE;
    else if (code === 'KeyM') queued |= ACTION_MUTE;
    else if (code === 'Digit1') queued |= 16;
    else if (code === 'Digit2') queued |= 32;
    else if (code === 'Digit3') queued |= 64;
  }

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      keys.add(event.code);
      press(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  function pointerToX(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * canvas.width;
  }
  function pointerToY(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientY - rect.top) / rect.height) * canvas.height;
  }
  canvas.addEventListener('pointermove', (event) => {
    mouseX = pointerToX(event);
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseX = pointerToX(event);
    mouseClicked = true;
    clickPos = { x: pointerToX(event), y: pointerToY(event) };
    queued |= ACTION_CONFIRM | ACTION_LAUNCH;
  });

  return {
    // -1 left, 0 still, 1 right, from the keys currently held down.
    direction() {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      if (left && !right) return -1;
      if (right && !left) return 1;
      return 0;
    },
    // Latest mouse x in canvas pixels, or null when the mouse never moved.
    mouseX() {
      return mouseX;
    },
    clicked() {
      const value = mouseClicked;
      mouseClicked = false;
      return value;
    },
    // Canvas position of the last click, consumed on read (null when none).
    clickPos() {
      const value = clickPos;
      clickPos = null;
      return value;
    },
    // Consume and return the action flags queued since the last call.
    takeActions() {
      const value = queued;
      queued = 0;
      return value;
    },
  };
}
