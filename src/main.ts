import { Effect, Layer, Scope } from 'effect';
import { getPlayerArchetype } from './domain/archetypes';
import {
  createBrowserInputState,
  registerInputListeners,
} from './infrastructure/input-browser';
import {
  ThreeContextLive,
  ThreeContext,
} from './infrastructure/renderer-three/context';
import { startGameLoop } from './runtime/loop';
import { World, WorldLive } from './runtime/world';
import { MaterialManagerLive } from './infrastructure/material-manager';
import { ComputationWorkerLive } from './infrastructure/computation.worker';
import { SpatialGridLive } from './infrastructure/spatial-grid';

export const main = Effect.scoped(
  Effect.gen(function* (_) {
    const world = yield* _(World);
    // --- 1. Initialize Services and State ---
    const inputState = createBrowserInputState();
    const threeContext = yield* _(ThreeContext);

    // --- 2. Setup Initial Scene ---
    yield* _(world.createEntity(getPlayerArchetype({ x: 0, y: 50, z: 0 })));

    // --- 3. Register Event Listeners ---
    const cleanupInput = registerInputListeners(
      inputState,
      threeContext.camera.controls,
    );
    yield* _(Scope.addFinalizer(Effect.sync(cleanupInput)));

    // --- 4. Start Game Loop ---
    const gameLoopFiber = yield* _(
      Effect.fork(startGameLoop(threeContext, inputState)),
    );
    yield* _(Scope.addFinalizer(Effect.interrupt(gameLoopFiber)));
  }),
);

// Create the final program with all the live layers
export const MainLive = Layer.mergeAll(
  WorldLive,
  ThreeContextLive,
  MaterialManagerLive,
  ComputationWorkerLive,
  SpatialGridLive,
);

export const program = Effect.provide(main, MainLive);
