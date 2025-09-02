import { Effect, Layer, Option, Ref, HashSet, pipe, Array as A } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { Hotbar, Position } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { SystemCommand } from '@/domain/types'
import { ComputationWorker, ComputationWorkerLive } from '@/infrastructure/computation.worker'
import { InputManagerLive } from '@/infrastructure/input-browser'
import { MaterialManagerLive } from '@/infrastructure/material-manager'
import { RendererLive } from '@/infrastructure/renderer-three'
import { ThreeCameraLive } from '@/infrastructure/camera-three'
import { ThreeContextLive } from '@/infrastructure/renderer-three/context'
import { RaycastServiceLive } from '@/infrastructure/raycast-three'
import { SpatialGridLive } from '@/infrastructure/spatial-grid'
import { gameLoop } from '@/runtime/loop'
import { ChunkDataQueueService, GameStateService, OnCommand, RaycastResultService, RenderQueueService, DeltaTime } from '@/runtime/services'
import * as World from '@/runtime/world-pure'
import { WorldContext } from '@/runtime/context'
import {
  blockInteractionSystem,
  cameraControlSystem,
  chunkLoadingSystem,
  collisionSystem,
  createUISystem,
  inputPollingSystem,
  physicsSystem,
  playerMovementSystem,
  raycastSystem,
  updatePhysicsWorldSystem,
  updateTargetSystem,
  worldUpdateSystem,
} from '@/systems'

export const hotbarUpdater = (_hotbar: Hotbar) => Effect.void

export const main = (uiSystem = createUISystem(hotbarUpdater)) =>
  Effect.gen(function* ($) {
    yield* $(World.addArchetype(createArchetype({ type: 'player', pos: new Position({ x: 0, y: 20, z: 0 }) })))

    const systems = [
      inputPollingSystem,
      cameraControlSystem,
      playerMovementSystem,
      physicsSystem,
      updatePhysicsWorldSystem,
      collisionSystem,
      raycastSystem,
      updateTargetSystem,
      blockInteractionSystem,
      chunkLoadingSystem,
      worldUpdateSystem,
      uiSystem,
    ]

    yield* $(gameLoop(systems))
  })

export const onCommandEffect = Effect.gen(function* ($) {
  const { world } = yield* $(WorldContext)
  const computationWorker = yield* $(ComputationWorker)
  const chunkDataQueue = yield* $(ChunkDataQueueService)
  return (command: SystemCommand) =>
    Effect.gen(function* ($) {
      const worldState = yield* $(Ref.get(world))
      const taskPayload = {
        ...command,
        seeds: worldState.globalState.seeds,
        amplitude: worldState.globalState.amplitude,
        editedBlocks: {
          placed: worldState.globalState.editedBlocks.placed,
          destroyed: new Set(HashSet.values(worldState.globalState.editedBlocks.destroyed)),
        },
      }
      const task = { type: 'generateChunk' as const, payload: taskPayload }
      const result = yield* $(computationWorker.postTask(task))
      chunkDataQueue.push(result)
    }).pipe(
      Effect.catchAll((err) => Effect.logError('Failed to process chunk', err)),
    )
})

const StatefulServicesLive = Layer.effect(RaycastResultService, Ref.make(Option.none())).pipe(
  Layer.merge(Layer.succeed(ChunkDataQueueService, [])),
  Layer.merge(Layer.succeed(RenderQueueService, [])),
)

const BaseServicesLive = Layer.mergeAll(World.worldLayer, InputManagerLive, ComputationWorkerLive, MaterialManagerLive, RaycastServiceLive, SpatialGridLive)

const GameStateLive = Layer.succeed(GameStateService, {
  getHotbar: Effect.gen(function* ($) {
    const players = yield* $(World.query(playerQuery))
    return pipe(
      A.get(players, 0),
      Option.map((p) => p.hotbar),
      Option.getOrElse(() => new Hotbar({ slots: [], selectedIndex: 0 })),
    )
  }),
})

export const AppLayer = (rootElement: HTMLElement) =>
  Layer.empty.pipe(
    Layer.provide(StatefulServicesLive),
    Layer.provide(BaseServicesLive),
    Layer.provide(ThreeContextLive(rootElement)),
    Layer.provide(ThreeCameraLive(rootElement)),
    Layer.provide(RendererLive),
    Layer.provide(Layer.effect(OnCommand, onCommandEffect)),
    Layer.provide(GameStateLive),
    Layer.provide(Layer.succeed(DeltaTime, 0)),
  )

export const bootstrap = (rootElement: HTMLElement) => {
  const appLayer = AppLayer(rootElement)
  return main().pipe(
    Effect.provide(appLayer),
    Effect.catchAll((err) => Effect.logError('An unrecoverable error occurred', err)),
  )
}

export const runApp = (bootstrapFn: (el: HTMLElement) => Effect.Effect<void>) => {
  const rootElement = document.getElementById('app')
  if (!rootElement) {
    throw new Error('Root element #app not found')
  }
  const runnable = bootstrapFn(rootElement)
  Effect.runFork(runnable)
}

// --- Bootstrap ---
export const init = (appRunner = runApp) => {
  document.addEventListener('DOMContentLoaded', () => appRunner(bootstrap))
}
