import { Effect } from 'effect';
import Stats from 'stats.js';
import { MaterialManager } from '../infrastructure/material-manager';
import { ThreeJsContext } from '../infrastructure/renderer-three';
import { mainSystem } from '../systems';
import { GameState } from './game-state';
import { Input, RenderContext, Renderer } from './services';
import { World } from './world';

// --- Performance Stats ---
const stats: Stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
const statsContainer: HTMLElement | null = document.getElementById('stats');
if (statsContainer) {
  statsContainer.appendChild(stats.dom);
} else {
  document.body.appendChild(stats.dom);
}

/**
 * The main game loop effect for a single frame.
 */
export const gameLoop: Effect.Effect<
  void,
  never,
  | GameState
  | World
  | Renderer
  | Input
  | RenderContext
  | ThreeJsContext
  | MaterialManager
> = Effect.gen(function* (_) {
  stats.begin();
  yield* _(mainSystem);
  stats.end();
});
