import { Data, Effect, Layer } from 'effect'
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
} from './systems'

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
import { ChunkDataQueue, DeltaTime, GameState, OnCommand, RaycastResultService, RenderQueue, hotbarUpdater } from './runtime/services'

const InfraServicesLive = Layer.mergeAll(
  ComputationWorkerLive,
  InputManagerLive,
  MaterialManagerLive,
  RaycastServiceLive,
  SpatialGridLive,
)

const AppLive = (rootElement: HTMLElement) => {
  const services = Layer.mergeAll(
    World.worldLayer,
    InfraServicesLive,
    ThreeContextLive(rootElement),
    ThreeCameraLive(),
    RendererLive,
    OnCommand.Live,
    GameState.Live,
  ).pipe(Layer.provide(hotbarUpdater))

  const systems = Effect.all(
    [
      inputPollingSystem,
      playerMovementSystem,
      cameraControlSystem,
      collisionSystem,
      physicsSystem,
      blockInteractionSystem,
      updateTargetSystem,
      updatePhysicsWorldSystem,
      chunkLoadingSystem,
      worldUpdateSystem,
      createUISystem,
    ],
    { concurrency: 'inherit' },
  )

  return services.pipe(Layer.provide(Layer.effectDiscard(systems)))
}

class RootElementNotFoundError extends Data.TaggedError('RootElementNotFoundError') {}

const getRootElement = Effect.fromNullable(document.getElementById('app')).pipe(Effect.mapError(() => new RootElementNotFoundError()))

const waitForDom = Effect.async<void>((resume) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => resume(Effect.void), { once: true })
  } else {
    resume(Effect.void)
  }
})

export const main = Effect.gen(function* (_) {
  const rootElement = yield* _(getRootElement)
  const appLayer = AppLive(rootElement)

  yield* _(
    World.addArchetype({
      type: 'player',
      pos: new Position({ x: 0, y: 80, z: 0 }),
    }),
  )
  yield* _(
    World.addArchetype({
      type: 'camera',
      pos: new Position({ x: 0, y: 80, z: 0 }),
    }),
  )

  yield* _(gameLoop, Effect.provide(appLayer))
})

export const bootstrap = waitForDom.pipe(
  Effect.flatMap(() => main),
  Effect.catchTags({
    RootElementNotFoundError: (e) => Effect.logError('Root element not found', e),
  }),
)

Effect.runFork(bootstrap)