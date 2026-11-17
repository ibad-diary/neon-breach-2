// NEON BREACH — everything the player sees. Canvas 2D, one draw per frame:
// starfield and grid, the glowing brick wall, paddle, balls with trails,
// particles, power-ups, the boss with its health bar, the HUD, and the five
// screens (title, play, draft, paused, over/win). No images: all neon is
// drawn in code, so the game ships as pure source.

import { BALL_RADIUS, FIELD, NEON, PADDLE_HEIGHT, SECTORS, WALL } from './config.js';
import { UPGRADES, upgradeById } from './draft.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  // A fixed starfield, seeded once, so every frame (and every screenshot)
  // has the same sky.
  const stars = [];
  let seed = 1337;
  for (let i = 0; i < 90; i += 1) {
    seed = (seed * 16807) % 2147483647;
    stars.push({
      x: (seed % 960),
      y: ((seed * 7919) % 640),
      size: 0.6 + ((seed >> 8) % 10) / 12,
      twinkle: (seed % 100) / 100,
    });
  }

  function drawBackground(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, '#070716');
    grad.addColorStop(0.6, '#050514');
    grad.addColorStop(1, '#0a0a24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    for (const star of stars) {
      const alpha = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.001 + star.twinkle * 6.28));
      ctx.fillStyle = `rgba(200, 220, 255, ${alpha.toFixed(2)})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.strokeStyle = NEON.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();

    // Neon walls on three sides; the floor is open — that is the danger.
    ctx.fillStyle = NEON.wall;
    ctx.shadowColor = NEON.wallGlow;
    ctx.shadowBlur = 12;
    ctx.fillRect(0, 0, WALL, FIELD.height);
    ctx.fillRect(FIELD.width - WALL, 0, WALL, FIELD.height);
    ctx.fillRect(0, 0, FIELD.width, WALL);
    ctx.shadowBlur = 0;
  }

  function drawBrick(brick) {
    const color = NEON.brick[brick.tier];
    const edge = NEON.brickEdge[brick.tier];
    const flash = brick.flash > 0 ? 0.55 : 0;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.globalAlpha = brick.core ? 0.85 : 0.92;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    ctx.restore();
    ctx.fillStyle = rgba(edge, 0.85);
    ctx.fillRect(brick.x, brick.y, brick.w, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, brick.h - 10);
    if (brick.tier >= 2) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`x${brick.hp}`, brick.x + brick.w / 2, brick.y + brick.h - 7);
    }
    if (brick.core) {
      ctx.strokeStyle = '#c7d2fe';
      ctx.lineWidth = 2;
      ctx.strokeRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4);
      ctx.fillStyle = '#e0e7ff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CORE', brick.x + brick.w / 2, brick.y + brick.h - 8);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    }
  }

  function drawBoss(boss, time) {
    if (!boss) return;
    const pulse = 8 + Math.sin(time * 0.006) * 4;
    ctx.save();
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 18 + pulse;
    ctx.fillStyle = '#3d0a18';
    ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(boss.x, boss.y, boss.w, 5);
    ctx.fillRect(boss.x, boss.y + boss.h - 5, boss.w, 5);
    ctx.restore();
    ctx.fillStyle = '#ffd7de';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ SECTOR CORE ⚠', boss.x + boss.w / 2, boss.y + boss.h / 2 + 5);
    if (boss.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${boss.flash * 4})`;
      ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    }
    // Health bar under the boss.
    const barW = boss.w;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(boss.x, boss.y + boss.h + 8, barW, 7);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(boss.x, boss.y + boss.h + 8, barW * (boss.hp / boss.maxHp), 7);
  }

  function drawPaddle(paddle, time) {
    ctx.save();
    ctx.shadowColor = NEON.paddle;
    ctx.shadowBlur = 14;
    const grad = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
    grad.addColorStop(0, '#0e7490');
    grad.addColorStop(0.5, NEON.paddle);
    grad.addColorStop(1, '#0e7490');
    ctx.fillStyle = grad;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, PADDLE_HEIGHT);
    ctx.restore();
    ctx.fillStyle = NEON.paddleEdge;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(paddle.x + 6, paddle.y + 5, paddle.width - 12, 3);
  }

  function drawBall(ball) {
    if (ball.trail.length > 1) {
      ctx.strokeStyle = NEON.ballTrail;
      ctx.lineWidth = ball.r * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
      for (const point of ball.trail) ctx.lineTo(point.x, point.y);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = ball.fire ? '#ff6b35' : '#a5f3fc';
    ctx.shadowBlur = 16;
    ctx.fillStyle = ball.fire ? '#ff9a3d' : NEON.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles(particles) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPowerUps(powerups, time) {
    for (const p of powerups) {
      const color = NEON.powerup[p.kind];
      const wobble = Math.sin(p.wobble) * 4;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(5, 5, 20, 0.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(p.x - 15 + wobble, p.y - 9, 30, 18, 9);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.kind, p.x + wobble, p.y + 4);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHud(state, best) {
    ctx.fillStyle = 'rgba(5, 5, 20, 0.72)';
    ctx.fillRect(WALL, WALL, FIELD.width - WALL * 2, 46);
    ctx.fillStyle = NEON.text;
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score}`, 26, 40);
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 230, 40);
    ctx.textAlign = 'center';
    ctx.fillText(`SECTOR ${state.sector}/${SECTORS}`, FIELD.width / 2, 40);
    ctx.textAlign = 'right';
    const lives = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 5 - state.lives));
    ctx.fillStyle = '#ff5c7a';
    ctx.fillText(lives, FIELD.width - 26, 40);
    ctx.fillStyle = NEON.dim;
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    const active = UPGRADES.filter((u) => (state.upgrades.counts[u.id] ?? 0) > 0).map((u) => u.id);
    ctx.fillText(active.length ? `UPGRADES ${active.join(' · ')}` : 'NO UPGRADES YET', 26, 66);
    if (state.mult > 1) {
      ctx.fillStyle = NEON.gold;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`COMBO x${state.mult}`, FIELD.width - 26, 66);
    }
    if (state.guardUp) {
      ctx.strokeStyle = NEON.powerup.G;
      ctx.lineWidth = 3;
      ctx.shadowColor = NEON.powerup.G;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(WALL, FIELD.height - 4);
      ctx.lineTo(FIELD.width - WALL, FIELD.height - 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function panel(title, lines, hint, accent) {
    ctx.fillStyle = 'rgba(4, 4, 18, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    ctx.fillText(title, FIELD.width / 2, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = NEON.text;
    ctx.font = '19px monospace';
    let y = 268;
    for (const line of lines) {
      ctx.fillText(line, FIELD.width / 2, y);
      y += 32;
    }
    ctx.fillStyle = NEON.dim;
    ctx.font = '15px monospace';
    ctx.fillText(hint, FIELD.width / 2, y + 36);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(4, 4, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = NEON.paddle;
    ctx.font = 'bold 74px monospace';
    ctx.shadowColor = NEON.paddle;
    ctx.shadowBlur = 30;
    ctx.fillText('NEON', FIELD.width / 2, 190);
    ctx.fillStyle = '#ff2d78';
    ctx.shadowColor = '#ff2d78';
    ctx.fillText('BREACH', FIELD.width / 2, 268);
    ctx.shadowBlur = 0;
    ctx.fillStyle = NEON.text;
    ctx.font = '19px monospace';
    ctx.fillText('Break the wall. Draft upgrades. Beat the Sector Core.', FIELD.width / 2, 318);
    ctx.fillStyle = NEON.dim;
    ctx.font = '16px monospace';
    ctx.fillText('← → or mouse to move · SPACE to launch · P pause · M mute', FIELD.width / 2, 360);
    ctx.fillText('Clear 8 sectors. The boss waits in sector 8.', FIELD.width / 2, 388);
    if (best > 0) {
      ctx.fillStyle = NEON.gold;
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`BEST ${best}`, FIELD.width / 2, 428);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (blink) ctx.fillText('— PRESS SPACE OR CLICK TO START —', FIELD.width / 2, 486);
  }

  function drawDraft(state, choices) {
    ctx.fillStyle = 'rgba(4, 4, 18, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = NEON.gold;
    ctx.font = 'bold 40px monospace';
    ctx.shadowColor = NEON.gold;
    ctx.shadowBlur = 18;
    ctx.fillText(`SECTOR ${state.sector} CLEARED`, FIELD.width / 2, 130);
    ctx.shadowBlur = 0;
    ctx.fillStyle = NEON.text;
    ctx.font = '18px monospace';
    ctx.fillText('Choose one upgrade — press 1, 2, 3 or click a card.', FIELD.width / 2, 168);
    const cardW = 250;
    const cardH = 220;
    const gap = 30;
    const count = choices.length;
    const totalW = cardW * count + gap * (count - 1);
    const startX = (FIELD.width - totalW) / 2;
    choices.forEach((choice, i) => {
      const x = startX + i * (cardW + gap);
      const y = 210;
      const color = NEON.powerup[choice.id];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(10, 12, 34, 0.95)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, y + 34);
      ctx.font = 'bold 30px monospace';
      ctx.fillText(choice.id, x + cardW / 2, y + 78);
      ctx.fillStyle = NEON.text;
      ctx.font = 'bold 17px monospace';
      wrapText(choice.name, x + cardW / 2, y + 112, cardW - 28, 20);
      ctx.fillStyle = NEON.dim;
      ctx.font = '14px monospace';
      wrapText(choice.desc, x + cardW / 2, y + 142, cardW - 28, 18);
    });
  }

  function wrapText(text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  function draw(state, screen, best, draftChoices, time) {
    drawBackground(time);
    for (const brick of state.bricks) drawBrick(brick);
    drawBoss(state.boss, time);
    drawPowerUps(state.powerups, time);
    drawParticles(state.particles);
    drawPaddle(state.paddle, time);
    for (const ball of state.balls) drawBall(ball);
    if (screen === SCREEN_PLAY || screen === SCREEN_DRAFT || screen === SCREEN_PAUSED) {
      drawHud(state, best);
    }
    if (state.launching && screen === SCREEN_PLAY) {
      ctx.fillStyle = NEON.dim;
      ctx.font = '15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE / CLICK to launch', FIELD.width / 2, state.paddle.y - 34);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_DRAFT) drawDraft(state, draftChoices ?? []);
    else if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['Take a breath. The neon waits.'], 'SPACE / P to resume', NEON.paddle);
    } else if (screen === SCREEN_OVER) {
      panel(
        'GAME OVER',
        [`Score ${state.score}`, `Best ${Math.max(best, state.score)}`, `Reached sector ${state.sector}`],
        'SPACE / CLICK to try again',
        '#ff3b5c',
      );
    } else if (screen === SCREEN_WIN) {
      panel(
        'BREACH COMPLETE',
        [`Score ${state.score}`, `Best ${Math.max(best, state.score)}`, 'All 8 sectors cleared. The Core is down.'],
        'SPACE / CLICK to play again',
        NEON.gold,
      );
    }
  }

  return { draw };
}
