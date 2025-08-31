import { Effect } from 'effect';
import { MaterialManager } from '../infrastructure/material-manager';
import { ThreeJsContext } from '../infrastructure/renderer-three';
import { GameState } from '../runtime/game-state';
import { Input, RenderContext, Renderer } from '../runtime/services';
import { World } from '../runtime/world';
import { chunkLoadingSystem } from './chunk-loading';
import { collisionSystem } from './collision';
import { generationSystem as genSystem } from './generation';
import { interactionSystem } from './interaction';
import { physicsSystem } from './physics';
import { playerControlSystem } from './player';
import { renderSystem } from './render';
import { uiSystem } from './ui';

/**
 * A one-shot effect to generate the initial world state.
 */
export const generationSystem: Effect.Effect<
  void,
  never,
  GameState | World
> = genSystem;

/**
 * Combines all game systems that run every frame into a single Effect.
 * The order is important: input -> player control -> interaction -> chunk loading -> collision -> physics -> ui -> render
 */
export const mainSystem: Effect.Effect<
  void,
  never,
  | World
  | Input
  | ThreeJsContext
  | GameState
  | RenderContext
  | Renderer
  | MaterialManager
> = Effect.sync(() => {}).pipe(
  Effect.tap(() => playerControlSystem),
  Effect.tap(() => interactionSystem),
  Effect.tap(() => chunkLoadingSystem),
  Effect.tap(() => physicsSystem),
  Effect.tap(() => collisionSystem),
  Effect.tap(() => uiSystem),
  Effect.tap(() => renderSystem),
);
