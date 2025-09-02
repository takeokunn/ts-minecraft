import {
  blockInteractionSystem,
  cameraControlSystem,
  chunkLoadingSystem,
  collisionSystem,
  createUISystem,
  inputPollingSystem,
  physicsSystem,
  playerMovementSystem,
  updatePhysicsWorldSystem,
  updateTargetSystem,
  worldUpdateSystem,
} from '@/systems'
import { Data, Effect, Layer, Option } from 'effect'
import { createArchetype } from './domain/archetypes'
import { Position } from './domain/components'
import * as World from './domain/world'
import { ThreeCameraLive } from './infrastructure/camera-three'
import { ComputationWorkerLive } from './infrastructure/computation.worker'
import { InputManagerLive } from './infrastructure/input-browser'
import { MaterialManagerLive } from './infrastructure/material-manager'
import { RendererLive } from './infrastructure/renderer-three'
import { ThreeContextLive } from './infrastructure/renderer-three/context'
import { RaycastServiceLive } from './infrastructure/raycast-three'
import { SpatialGridLive } from './infrastructure/spatial-grid'
import { gameLoop } from './runtime/loop'
import { ChunkDataQueue, DeltaTime, GameState, OnCommand, RenderQueue, hotbarUpdater } from './runtime/services'

// --- Layers ---

const InfraServicesLive = Layer.mergeAll(
  InputManagerLive,
  ComputationWorkerLive,
  MaterialManagerLive,
  RaycastServiceLive,
  SpatialGridLive,
)

export const AppServicesLive = (rootElement: HTMLElement) =>
  Layer.mergeAll(
    World.worldLayer,
    InfraServicesLive,
    ThreeContextLive(rootElement),
    ThreeCameraLive,
    RendererLive,
    OnCommand.Live,
    GameState.Live,
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(DeltaTime, 0),
        Layer.succeed(ChunkDataQueue, []),
        Layer.succeed(RenderQueue, []),
      ),
    ),
  )

// --- Main Application ---

class RootElementNotFoundError extends Data.TaggedError('RootElementNotFoundError') {}

const getRootElement = Option.fromNullable(document.getElementById('app')).pipe(
  Effect.mapError(() => new RootElementNotFoundError()),
)

const waitForDom = Effect.async<void>((resume) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => resume(Effect.void))
  } else {
    resume(Effect.void)
  }
})

export const main = Effect.gen(function* (_) {
  yield* _(World.addArchetype(createArchetype({ type: 'player', pos: new Position({ x: 0, y: 20, z: 0 }) })))

  const systems = [
    inputPollingSystem,
    cameraControlSystem,
    playerMovementSystem,
    physicsSystem,
    updatePhysicsWorldSystem,
    collisionSystem,
    updateTargetSystem,
    blockInteractionSystem,
    chunkLoadingSystem,
    worldUpdateSystem,
    createUISystem(hotbarUpdater),
  ]

  yield* _(gameLoop(systems))
})

export const bootstrap = waitForDom.pipe(
  Effect.flatMap(() => getRootElement),
  Effect.flatMap((rootElement) => main.pipe(Effect.provide(AppServicesLive(rootElement)))),
  Effect.catchTags({
    RootElementNotFoundError: (e) => Effect.logError('Root element not found', e),
  }),
  Effect.catchAllCause((err) => Effect.logError('An unrecoverable error occurred', err)),
)

// --- Run ---
Effect.runFork(bootstrap)