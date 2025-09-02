import { Effect, Layer, Option, Ref, HashSet, Context } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { Hotbar, Position } from '@/domain/components'
import { SystemCommand } from '@/domain/types'
import { ComputationWorker, ComputationWorkerLive } from '@/infrastructure/computation.worker'
import { InputManager, InputManagerLive } from '@/infrastructure/input-browser'
import { MaterialManager, MaterialManagerLive } from '@/infrastructure/material-manager'
import { RendererLive } from '@/infrastructure/renderer-three'
import { ThreeCameraService, ThreeCameraLive } from '@/infrastructure/camera-three'
import { ThreeContextLive } from '@/infrastructure/renderer-three/context'
import { RaycastService, RaycastServiceLive } from '@/infrastructure/raycast-three'
import { SpatialGrid, SpatialGridLive } from '@/infrastructure/spatial-grid'
import { gameLoop } from '@/runtime/loop'
import { ChunkDataQueueService, OnCommand, RaycastResultService, RenderQueueService, RendererService, DeltaTime, ThreeContextService } from '@/runtime/services'
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

type SystemRequirements =
  | World
  | InputManager
  | OnCommand
  | SpatialGrid
  | Context.Tag.Service<typeof DeltaTime>
  | Context.Tag.Service<typeof RaycastResultService>
  | Context.Tag.Service<typeof ThreeContextService>
  | RaycastService
  | Context.Tag.Service<typeof ChunkDataQueueService>
  | Context.Tag.Service<typeof RenderQueueService>
  | ComputationWorker
  | MaterialManager
  | Context.Tag.Service<typeof RendererService>
  | ThreeCameraService

const main = Effect.gen(function* (_) {
  const world = yield* _(World)
  yield* _(world.addArchetype(createArchetype({ type: 'player', pos: new Position({ x: 0, y: 20, z: 0 }) })))

  const hotbarUpdater = (_hotbar: Hotbar) => Effect.void

  const systems: ReadonlyArray<Effect.Effect<void, never, SystemRequirements>> = [
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

  yield* _(gameLoop(systems))
})

const AppLayer = (rootElement: HTMLElement) => {
  // Independent services
  const statefulServices = Layer.succeed(RaycastResultService, Ref.unsafeMake(Option.none())).pipe(
    Layer.merge(Layer.succeed(ChunkDataQueueService, [])),
    Layer.merge(Layer.succeed(RenderQueueService, [])),
  )
  const baseServices = Layer.mergeAll(WorldLive, InputManagerLive, ComputationWorkerLive, MaterialManagerLive, RaycastServiceLive, SpatialGridLive)

  // Services with dependencies
  const threeContextLayer = ThreeContextLive(rootElement)
  const threeCameraLayer = ThreeCameraLive(rootElement) // Depends on ThreeContext

  // Combine context and camera layers
  const threeServices = Layer.merge(
    threeContextLayer,
    Layer.provide(threeContextLayer, threeCameraLayer),
  )

  // Combine all services that Renderer depends on
  const rendererDependencies = Layer.mergeAll(
    statefulServices,
    baseServices,
    threeServices,
  )

  const rendererLayer = RendererLive // Depends on rendererDependencies

  // Combine the dependencies with the renderer itself
  const fullLayer = Layer.merge(
    rendererDependencies,
    Layer.provide(rendererDependencies, rendererLayer),
  )

  return fullLayer
}
// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('app')
  if (!rootElement) {
    throw new Error('Root element #app not found')
  }

  const onCommandEffect = Effect.gen(function* (_) {
    const world = yield* _(World)
    const computationWorker = yield* _(ComputationWorker)
    const chunkDataQueue = yield* _(ChunkDataQueueService)
    return (command: SystemCommand) =>
      Effect.gen(function* (_) {
        const worldState = yield* _(world.state)
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
        const result = yield* _(computationWorker.postTask(task))
        chunkDataQueue.push(result)
      }).pipe(
        Effect.catchAll((err) => Effect.logError('Failed to process chunk', err)),
        Effect.forkDaemon,
      )
  })

  const onCommandLayer = Layer.effect(OnCommand, onCommandEffect)
  const baseAppLayer = AppLayer(rootElement)

  const combinedLayer = Layer.merge(
    baseAppLayer,
    Layer.provide(baseAppLayer, onCommandLayer),
  )

  const deltaTimeLayer = Layer.succeed(DeltaTime, 0)
  const finalLayer = Layer.merge(combinedLayer, deltaTimeLayer)

  // @ts-expect-error
  const runnable: Effect.Effect<void, never, never> = main.pipe(Effect.provide(finalLayer))
  Effect.runFork(runnable)
})
