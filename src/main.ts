import { Effect, Layer, Option, Ref, HashSet } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { Hotbar, Position } from '@/domain/components'
import { SystemCommand } from '@/domain/types'
import { ComputationWorkerTag, ComputationWorkerLive } from '@/infrastructure/computation.worker'
import { InputManagerLive } from '@/infrastructure/input-browser'
import { MaterialManagerLive } from '@/infrastructure/material-manager'
import { RendererLive } from '@/infrastructure/renderer-three'
import { ThreeCameraLive } from '@/infrastructure/camera-three'
import { ThreeContextLive } from '@/infrastructure/renderer-three/context'
import { RaycastServiceLive } from '@/infrastructure/raycast-three'
import { SpatialGridLive } from '@/infrastructure/spatial-grid'
import { gameLoop } from '@/runtime/loop'
import { ChunkDataQueueService, OnCommand, RaycastResultService, RenderQueueService, DeltaTime } from '@/runtime/services'
import { World, WorldLive } from '@/runtime/world'
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

const main = Effect.gen(function* ($) {
  const world = yield* $(World)
  yield* $(world.addArchetype(createArchetype({ type: 'player', pos: new Position({ x: 0, y: 20, z: 0 }) })))

  const hotbarUpdater = (_hotbar: Hotbar) => Effect.void

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
    createUISystem(hotbarUpdater),
  ]

  yield* $(gameLoop(systems))
})

const AppLayer = (rootElement: HTMLElement) => {
  const statefulServices = Layer.succeed(RaycastResultService, Ref.unsafeMake(Option.none())).pipe(
    Layer.merge(Layer.succeed(ChunkDataQueueService, [])),
    Layer.merge(Layer.succeed(RenderQueueService, [])),
  )

  const baseServices = Layer.mergeAll(
    WorldLive,
    InputManagerLive,
    ComputationWorkerLive,
    MaterialManagerLive,
    RaycastServiceLive,
    SpatialGridLive,
  )

  const threeContextLayer = ThreeContextLive(rootElement)
  const threeCameraLayer = ThreeCameraLive(rootElement)

  const base = Layer.mergeAll(statefulServices, baseServices, threeContextLayer)

  const withCamera = Layer.provideMerge(threeCameraLayer, base)
  const withRenderer = Layer.provideMerge(RendererLive, withCamera)

  return withRenderer
}

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('app')
  if (!rootElement) {
    throw new Error('Root element #app not found')
  }

  const onCommandEffect = Effect.gen(function* ($) {
    const world = yield* $(World)
    const computationWorker = yield* $(ComputationWorkerTag)
    const chunkDataQueue = yield* $(ChunkDataQueueService)
    return (command: SystemCommand) =>
      Effect.gen(function* ($) {
        const worldState = yield* $(world.state)
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
        Effect.forkDaemon,
      )
  })

  const baseAppLayer = AppLayer(rootElement)
  const onCommandLayer = Layer.effect(OnCommand, onCommandEffect)

  const appLayer = Layer.provideMerge(onCommandLayer, baseAppLayer)

  const deltaTimeLayer = Layer.succeed(DeltaTime, 0)
  const finalLayer = Layer.merge(appLayer, deltaTimeLayer)

  const runnable = main.pipe(Effect.provide(finalLayer))
  Effect.runFork(runnable)
})