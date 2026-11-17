// All sound is synthesized with WebAudio — no audio files, no network.
// A tiny synth: short oscillator blips for hits, a rising pitch per combo
// step, sweeps for power-ups, and a quiet bass pulse that keeps time while
// playing. Everything is guarded: with no AudioContext (headless runs,
// muted tab) every call is a silent no-op.

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (muted || !ensure()) return;
    try {
      if (context.state === 'suspended') void context.resume();
      const osc = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // A failed blip must never break the game loop.
    }
  }

  function startMusic() {
    if (musicTimer || muted) return;
    if (!ensure()) return;
    // A slow neon pulse: root notes of A minor, one per beat, soft and low.
    const bass = [55, 55, 65.41, 49];
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const freq = bass[musicStep % bass.length];
      musicStep += 1;
      tone(freq, 0.5, 'triangle', 0.10);
      tone(freq * 2, 0.3, 'sine', 0.04);
    }, 480);
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) stopMusic();
      return muted;
    },
    startMusic,
    stopMusic,
    paddle() {
      tone(220, 0.07, 'square', 0.12, 330);
    },
    wall() {
      tone(180, 0.05, 'square', 0.08);
    },
    // The brick blip climbs with the combo, so a hot streak sounds hot.
    brick(combo) {
      const step = Math.min(combo, 24);
      tone(420 + step * 22, 0.09, 'sine', 0.16, 640 + step * 22);
    },
    power() {
      tone(520, 0.16, 'sine', 0.14, 1040);
    },
    launch() {
      tone(300, 0.12, 'sine', 0.12, 620);
    },
    lose() {
      tone(220, 0.4, 'sawtooth', 0.12, 55);
    },
    laser() {
      tone(880, 0.08, 'square', 0.07, 440);
    },
    clear() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.22, 'sine', 0.14), i * 90);
      });
    },
    bossHit() {
      tone(140, 0.08, 'sawtooth', 0.12, 90);
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.3, 'sine', 0.14), i * 110);
      });
    },
    over() {
      [392, 330, 262, 196].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.35, 'triangle', 0.13), i * 160);
      });
    },
  };
}
