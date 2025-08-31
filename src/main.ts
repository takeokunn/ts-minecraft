import { Effect, Layer, Schedule } from "effect";
import { InputLive } from "./infrastructure/input-browser";
import { MaterialManagerLive } from "./infrastructure/material-manager";
import { RaycastLive } from "./infrastructure/raycast-three";
import {
  CameraLive,
  RendererLive,
  ThreeJsContextLive,
} from "./infrastructure/renderer-three";
import { UILive } from "./infrastructure/ui";
import { GameState, GameStateLive } from "./runtime/game-state";
import { gameLoop } from "./runtime/loop";
import { WorldLive } from "./runtime/world";
import { createPlayer } from "./domain/archetypes";
import { RenderQueueLive } from "./runtime/render-queue";
import { SpatialGridLive } from "./infrastructure/spatial-grid";
import { ComputationServiceLive } from "./runtime/computation";
import { ChunkDataQueueLive } from "./runtime/chunk-data-queue";

// --- Game Initialization ---
const initializeGame = Effect.gen(function* (_) {
  yield* _(createPlayer({ x: 0, y: 80, z: 0 }));
});

// --- Main Application Layer ---

const AppLayer = Layer.mergeAll(
  ThreeJsContextLive,
  GameStateLive,
  UILive,
  RenderQueueLive,
  SpatialGridLive,
  ChunkDataQueueLive,
  ComputationServiceLive,
  WorldLive,
  MaterialManagerLive,
  RendererLive,
  InputLive,
  CameraLive,
  RaycastLive,
);

// --- Main Application Logic ---
const app = Effect.gen(function* (_) {
  const gameState = yield* _(GameState);

  // Initialize the game state
  yield* _(initializeGame);

  // Start the main game loop, but only run it when the scene is 'InGame'
  const scheduledGameLoop = gameLoop.pipe(
    Effect.whenEffect(
      gameState.get.pipe(Effect.map((s) => s.scene === "InGame")),
    ),
    Effect.repeat(Schedule.animate),
  );

  yield* _(Effect.fork(scheduledGameLoop));
});

// --- Run ---
const program = app.pipe(Effect.provide(AppLayer));

Effect.runFork(program);
