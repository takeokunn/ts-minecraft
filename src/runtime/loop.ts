import { Effect, Schedule } from 'effect';
import Stats from 'stats.js';
import { mainSystem } from '../systems';

// --- Performance Stats ---
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
const statsContainer = document.getElementById('stats');
if (statsContainer) {
  statsContainer.appendChild(stats.dom);
} else {
  document.body.appendChild(stats.dom);
}

const tick = Effect.sync(() => {
  stats.begin();
}).pipe(
  Effect.flatMap(() => mainSystem),
  Effect.tap(() => {
    stats.end();
  }),
);

/**
 * The main game loop, which repeats the tick effect for every animation frame.
 */
export const gameLoop = tick.pipe(Effect.repeat(Schedule.animate));
