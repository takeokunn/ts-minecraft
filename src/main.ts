import { Effect, Layer, Schedule } from 'effect';
import {
  CameraState,
  Collider,
  Gravity,
  Hotbar,
  InputState,
  Player,
  Position,
  Velocity,
} from './domain/components';
import { InputLive } from './infrastructure/input-browser';
import { MaterialManagerLive } from './infrastructure/material-manager';
import { RenderContextLive } from './infrastructure/render-context';
import {
  RendererLive,
  ThreeJsContextLive,
} from './infrastructure/renderer-three';
import { UILive } from './infrastructure/ui';
import { GameState, GameStateLive } from './runtime/game-state';
import { gameLoop } from './runtime/loop';
import { Input, RenderContext, Renderer, UI } from './runtime/services';
import { World, WorldLive } from './runtime/world';
import { generationSystem } from './systems/generation';
import { hotbarSlots } from './domain/block';

// --- Game Initialization ---
const createPlayer = Effect.gen(function* (_) {
  const world = yield* _(World);
  yield* _(
    world.createEntity([
      new Player({ isGrounded: false }),
      new Position({ x: 0, y: 80, z: 0 }),
      new Velocity({ dx: 0, dy: 0, dz: 0 }),
      new Gravity({ value: 0.01 }),
      new CameraState({ pitch: 0, yaw: 0 }),
      new InputState({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
      }),
      new Collider({ width: 0.6, height: 1.8, depth: 0.6 }),
      new Hotbar({
        slots: [...hotbarSlots],
        selectedSlot: 0,
      }),
    ]),
  );
});

const initializeGame = Effect.gen(function* (_) {
  // For now, we'll just initialize a new game.
  // The logic for loading a saved game can be re-introduced later.
  yield* _(generationSystem);
  yield* _(createPlayer);
});

// --- Main Application Layer ---
export const AppLayer = Layer.mergeAll(
  ThreeJsContextLive,
  RenderContextLive,
  MaterialManagerLive,
  WorldLive,
  GameStateLive,
  UILive,
).pipe(Layer.provide(Layer.mergeAll(RendererLive, InputLive)));

// --- Main Application Logic ---
const app = Effect.gen(function* (_) {
  const gameState = yield* _(GameState);

  // Initialize the game state
  yield* _(initializeGame);

  // Start the main game loop, but only run it when the scene is 'InGame'
  const scheduledGameLoop = gameLoop.pipe(
    import { Effect, Layer, Schedule } from 'effect';
import {
  CameraState,
  Collider,
  Gravity,
  Hotbar,
  InputState,
  Player,
  Position,
  Velocity,
} from './domain/components';
import { InputLive } from './infrastructure/input-browser';
import { MaterialManagerLive } from './infrastructure/material-manager';
import { RenderContextLive } from './infrastructure/render-context';
import { RaycastLive } from './infrastructure/raycast-three';
import {
  CameraLive,
  RendererLive,
  ThreeJsContextLive,
} from './infrastructure/renderer-three';
import { UILive } from './infrastructure/ui';
import { GameState, GameStateLive } from './runtime/game-state';
import { gameLoop } from './runtime/loop';
import { Input, RenderContext, Renderer, UI } from './runtime/services';
import { World, WorldLive } from './runtime/world';
import { generationSystem } from './systems/generation';
import { hotbarSlots } from './domain/block';

// --- Game Initialization ---
const createPlayer = Effect.gen(function* (_) {
  const world = yield* _(World);
  yield* _(
    world.createEntity([
      new Player({ isGrounded: false }),
      new Position({ x: 0, y: 80, z: 0 }),
      new Velocity({ dx: 0, dy: 0, dz: 0 }),
      new Gravity({ value: 0.01 }),
      new CameraState({ pitch: 0, yaw: 0 }),
      new InputState({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        destroy: false,
        place: false,
      }),
      new Collider({ width: 0.6, height: 1.8, depth: 0.6 }),
      new Hotbar({
        slots: [...hotbarSlots],
        selectedSlot: 0,
      }),
    ]),
  );
});

const initializeGame = Effect.gen(function* (_) {
  // For now, we'll just initialize a new game.
  // The logic for loading a saved game can be re-introduced later.
  yield* _(generationSystem);
  yield* _(createPlayer);
});

// --- Main Application Layer ---
export const AppLayer = Layer.mergeAll(
  ThreeJsContextLive,
  RenderContextLive,
  MaterialManagerLive,
  WorldLive,
  GameStateLive,
  UILive,
  RaycastLive,
).pipe(Layer.provide(Layer.mergeAll(RendererLive, InputLive, CameraLive)));

// --- Main Application Logic ---
const app = Effect.gen(function* (_) {
  const gameState = yield* _(GameState);

  // Initialize the game state
  yield* _(initializeGame);

  // Start the main game loop, but only run it when the scene is 'InGame'
  const scheduledGameLoop = gameLoop.pipe(
    Effect.whenEffect(
      gameState.get.pipe(Effect.map((s) => s.scene === 'InGame')),
    ),
    Effect.repeat(Schedule.animate),
  );

  yield* _(Effect.fork(scheduledGameLoop));
});

// --- Run ---
const program = app.pipe(Effect.provide(AppLayer));

Effect.runFork(program);
    Effect.repeat(Schedule.animate),
  );

  yield* _(Effect.fork(scheduledGameLoop));
});

// --- Run ---
const program = app.pipe(Effect.provide(AppLayer));

Effect.runFork(program);