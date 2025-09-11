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
import { WorldLive } from './infrastructure/world'
import { gameLoop } from './runtime/loop'

// 遅延読み込み用の動的インポート関数
const loadGameSystems = async () => {
  const [
    { blockInteractionSystem },
    { cameraControlSystem },
    { chunkLoadingSystem },
    { collisionSystem },
    { inputPollingSystem },
    { physicsSystem },
    { playerMovementSystem },
    { uiSystem },
    { updatePhysicsWorldSystem },
    { updateTargetSystem },
    { worldUpdateSystem }
  ] = await Promise.all([
    import('./systems/block-interaction'),
    import('./systems/camera-control'),
    import('./systems/chunk-loading'),
    import('./systems/collision'),
    import('./systems/input-polling'),
    import('./systems/physics'),
    import('./systems/player-movement'),
    import('./systems/ui'),
    import('./systems/update-physics-world'),
    import('./systems/update-target-system'),
    import('./systems/world-update')
  ])

  return [
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
}

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

export const main = (player: Archetype) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    yield* _(world.addArchetype(player))
    
    // ゲームシステムを動的に読み込み
    const gameSystems = yield* _(Effect.promise(() => loadGameSystems()))
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