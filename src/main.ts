import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import { pipe } from 'effect/Function'
import { createArchetype } from '@/domain/archetypes'
import { SystemCommand } from '@/domain/types'
import { ComputationWorker, ComputationWorkerLive } from '@/infrastructure/computation.worker'
import { InputManager, InputManagerLive } from '@/infrastructure/input-browser'
import { MaterialManager, MaterialManagerLive } from '@/infrastructure/material-manager'
import { RendererLive, RendererService } from '@/infrastructure/renderer-three'
import { ThreeCameraLive, ThreeCameraService } from '@/infrastructure/camera-three'
import { ThreeContextLive, ThreeContextService } from '@/infrastructure/renderer-three/context'
import { RaycastService, RaycastServiceLive } from '@/infrastructure/raycast-three'
import { SpatialGridLive, SpatialGridService } from '@/infrastructure/spatial-grid'
import {
  ChunkDataQueueService,
  gameLoop,
  OnCommand,
  RaycastResultService,
  RenderQueueService,
  System,
} from '@/runtime/loop'
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

const main = Effect.gen(function* () {
  const world = yield* World
  const computationWorker = yield* ComputationWorker
  const onCommand = (command: SystemCommand) =>
    Effect.gen(function* () {
      const worldState = yield* world.state.get
      const taskPayload = {
        ...command,
        seeds: worldState.globalState.seeds,
        amplitude: worldState.globalState.amplitude,
        editedBlocks: {
          placed: worldState.globalState.editedBlocks.placed,
          destroyed: new Set(worldState.globalState.editedBlocks.destroyed),
        },
      }
      const task = { type: 'generateChunk' as const, payload: taskPayload }
      const result = yield* computationWorker.postTask(task)
      const chunkDataQueue = yield* ChunkDataQueueService
      chunkDataQueue.push(result)
    }).pipe(Effect.catchAll((err) => Effect.logError('Failed to process chunk', err)), Effect.forkDaemon)

  yield* world.addArchetype(createArchetype({ type: 'player', pos: { x: 0, y: 20, z: 0 } }))

  const hotbarUpdater = (_hotbar: any) => Effect.void

  const systems: ReadonlyArray<System> = [
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

  yield* gameLoop(systems).pipe(Effect.provideService(OnCommand, onCommand))
})

const AppLayer = (rootElement: HTMLElement) =>
  Layer.provide(
    Layer.mergeAll(
      WorldLive,
      InputManagerLive,
      ComputationWorkerLive,
      MaterialManagerLive,
      ThreeCameraLive(rootElement),
      RaycastServiceLive,
      SpatialGridLive,
    ),
    Layer.provide(
      Layer.mergeAll(ThreeContextLive(rootElement), RendererLive),
      Layer.effect(RaycastResultService, Ref.make(null)),
    ),
  ).pipe(
    Layer.provide(Layer.sync(ChunkDataQueueService, () => [])),
    Layer.provide(Layer.sync(RenderQueueService, () => [])),
  )

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('app')
  if (!rootElement) {
    throw new Error('Root element #app not found')
  }

  const runnable = Effect.provide(main, AppLayer(rootElement))
  Effect.runFork(runnable)
})
