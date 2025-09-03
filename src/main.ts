import { Effect, Layer } from 'effect'
import { createArchetype } from './domain/archetypes'
import { World } from './runtime/services'
import { ClockLive } from './infrastructure/clock'
import { ComputationWorkerLive } from './infrastructure/computation.worker'
import { InputManagerLive } from './infrastructure/input-browser'
import { MaterialManagerLive } from './infrastructure/material-manager'
import { RaycastLive } from './infrastructure/raycast-three'
import { RendererLive } from './infrastructure/renderer-three'
import { SpatialGridLive } from './infrastructure/spatial-grid'
import { WorldLive } from './infrastructure/world'
import { gameLoop } from './runtime/loop'
import { blockInteractionSystem } from './systems/block-interaction'
import { cameraControlSystem } from './systems/camera-control'
import { chunkLoadingSystem } from './systems/chunk-loading'
import { collisionSystem } from './systems/collision'
import { inputPollingSystem } from './systems/input-polling'
import { physicsSystem } from './systems/physics'
import { playerMovementSystem } from './systems/player-movement'
import { uiSystem } from './systems/ui'
import { updatePhysicsWorldSystem } from './systems/update-physics-world'
import { updateTargetSystem } from './systems/update-target-system'
import { worldUpdateSystem } from './systems/world-update'

const CoreServicesLive = Layer.mergeAll(
  ClockLive,
  InputManagerLive,
  RendererLive,
  MaterialManagerLive,
  RaycastLive,
  ComputationWorkerLive,
  SpatialGridLive,
  WorldLive,
)

export const gameSystems = [
  inputPollingSystem,
  playerMovementSystem,
  cameraControlSystem,
  physicsSystem,
  updatePhysicsWorldSystem,
  collisionSystem,
  updateTargetSystem,
  blockInteractionSystem,
  chunkLoadingSystem,
  worldUpdateSystem,
  uiSystem,
]

export const main = Effect.gen(function* (_) {
  const world = yield* _(World)

  const player = yield* _(
    createArchetype({
      type: 'player',
      pos: { x: 0, y: 80, z: 0 },
    }),
  )
  yield* _(world.addArchetype(player))

  yield* _(gameLoop(gameSystems))
})

const AppLive = main.pipe(Effect.provide(CoreServicesLive))

/* v8 ignore next 3 */
if (import.meta.env.PROD) {
  Effect.runFork(AppLive)
}
