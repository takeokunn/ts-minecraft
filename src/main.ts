import { Effect, Layer } from 'effect'
import { Archetype, createArchetype } from './domain/archetypes'
import { World } from './runtime/services'
import { ClockLive } from './infrastructure/clock'
import { ComputationWorkerLive } from './infrastructure/computation.worker'
import { InputManagerLive } from './infrastructure/input-browser'
import { MaterialManagerLive } from './infrastructure/material-manager'
import { RaycastLive } from './infrastructure/raycast-three'
import { RendererLive } from './infrastructure/renderer-three'
import { SpatialGridLive } from './infrastructure/spatial-grid'
import { WorldLive } from './infrastructure/storage/world'
import { gameLoop } from './runtime/loop'
import { blockInteractionSystem } from './application/commands/block-interaction'
import { cameraControlSystem } from './domain/services/camera-control.service'
import { chunkLoadingSystem } from './application/workflows/chunk-loading'
import { collisionSystem } from './domain/services/collision-system.service'
import { inputPollingSystem } from './application/services/input-polling.service'
import { physicsSystem } from './domain/services/physics-system.service'
import { playerMovementSystem } from './application/commands/player-movement'
import { uiSystem } from './presentation/ui-system.service'
import { updatePhysicsWorldSystem } from './domain/services/spatial-grid-system.service'
import { updateTargetSystem } from './domain/services/targeting.service'
import { worldUpdateSystem } from './application/workflows/world-update'

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

export const main = (player: Archetype) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    yield* _(world.addArchetype(player))
    yield* _(gameLoop(gameSystems))
  })

const initialize = Effect.gen(function* (_) {
  const player = yield* _(
    createArchetype({
      type: 'player',
      pos: { x: 0, y: 80, z: 0 },
    }),
  )
  yield* _(main(player))
})

const AppLive = initialize.pipe(Effect.provide(CoreServicesLive))

/* v8 ignore next 3 */
if (import.meta.env.PROD) {
  Effect.runFork(AppLive)
}
