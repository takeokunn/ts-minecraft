import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import * as Schedule from 'effect/Schedule'
import { pipe } from 'effect/Function'
import type { Material } from 'three'
import { ChunkGenerationResult, RenderCommand, SystemCommand } from '@/domain/types'
import { InputManager } from '@/infrastructure/input-browser'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import type { ThreeContext } from '@/infrastructure/types'
import { World } from './world'

// --- Service Tags for Dependencies ---

export const OnCommand = Context.Tag<(command: SystemCommand) => Effect.Effect<void>>()
export const InputManagerService = Context.Tag<InputManager>()
export const ThreeContextService = Context.Tag<ThreeContext>()
export const MaterialService = Context.Tag<Material>()
export const RendererService = Context.Tag<Renderer>()

// --- Service Tags for State ---

export const DeltaTime = Context.Tag<number>()
export const SpatialGridService = Context.Tag<SpatialGrid>()
export const RaycastResultService = Context.Tag<Ref.Ref<Option.Option<RaycastResult>>>()
export const ChunkDataQueueService = Context.Tag<ChunkGenerationResult[]>()
export const RenderQueueService = Context.Tag<RenderCommand[]>()

// --- System Definition ---

export type SystemContext =
  | World
  | typeof OnCommand.Type
  | typeof InputManagerService.Type
  | typeof ThreeContextService.Type
  | typeof MaterialService.Type
  | typeof DeltaTime.Type
  | typeof SpatialGridService.Type
  | typeof RaycastResultService.Type
  | typeof ChunkDataQueueService.Type
  | typeof RenderQueueService.Type
  | typeof RendererService.Type

export type System = Effect.Effect<void, never, SystemContext>

// --- Renderer Definition ---

export type Renderer = {
  readonly processRenderQueue: Effect.Effect<void>
  readonly syncCameraToWorld: Effect.Effect<void>
  readonly updateHighlight: Effect.Effect<void>
  readonly updateInstancedMeshes: Effect.Effect<void>
  readonly renderScene: Effect.Effect<void>
}

// --- Game Loop ---

const animationFrameSchedule = pipe(
  Schedule.forever,
  Schedule.mapEffect(() => Effect.promise<void>((resolve) => requestAnimationFrame(() => resolve()))),
)

export const gameLoop = (systems: ReadonlyArray<System>) =>
  Effect.gen(function* () {
    const renderer = yield* RendererService
    const inputManager = yield* InputManagerService
    const lastTimeRef = yield* Ref.make(performance.now())

    const gameTick = Effect.gen(function* () {
      const currentTime = performance.now()
      const lastTime = yield* Ref.getAndSet(lastTimeRef, currentTime)
      const deltaTime = (currentTime - lastTime) / 1000

      const systemsEffect = Effect.forEach(systems, (system) => system, { discard: true })

      const tickEffect = pipe(systemsEffect, Effect.provideService(DeltaTime, deltaTime))

      yield* tickEffect

      // Execute all rendering logic for the frame
      yield* renderer.processRenderQueue
      yield* renderer.syncCameraToWorld
      yield* renderer.updateHighlight
      yield* renderer.updateInstancedMeshes
      yield* renderer.renderScene
    })

    yield* Effect.repeat(gameTick, animationFrameSchedule)
  })
