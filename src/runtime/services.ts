import { Context, Effect, Layer, Option, pipe, Array as A } from 'effect'
import { RenderCommand, SystemCommand } from '@/domain/types'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { Hotbar } from '@/domain/components'
import { ChunkGenerationResult, ComputationWorker } from '@/infrastructure/computation.worker'
import { WorldContext } from './context'
import { InputManager } from '@/infrastructure/input-browser'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { ThreeContext } from '@/infrastructure/types'
import * as World from '@/domain/world'
import { playerQuery } from '@/domain/queries'

// --- Service Tags for Dependencies ---

type OnCommandFn = (command: SystemCommand) => Effect.Effect<void, never, WorldContext | ComputationWorker>
export class OnCommand extends Context.Tag('app/OnCommand')<OnCommand, OnCommandFn>() {
  static readonly Live = Layer.effect(
    OnCommand,
    Effect.gen(function* (_) {
      const { world } = yield* _(WorldContext)
      const computationWorker = yield* _(ComputationWorker)
      const chunkDataQueue = yield* _(ChunkDataQueue)

      return (command: SystemCommand) =>
        Effect.gen(function* (_) {
          const worldState = yield* _(Effect.flatMap(world, (ref) => ref.get()))
          const params = {
            ...command,
            seeds: worldState.globalState.seeds,
            amplitude: worldState.globalState.amplitude,
            editedBlocks: {
              placed: worldState.globalState.editedBlocks.placed,
              destroyed: new Set(worldState.globalState.editedBlocks.destroyed),
            },
          }
          const result = yield* _(computationWorker.postTask({ type: 'generateChunk', payload: params }))
          chunkDataQueue.push(result)
        }).pipe(
          Effect.catchAll((err) => Effect.logError('Failed to process chunk', err)),
          Effect.fork,
          Effect.asVoid,
        )
    }),
  )
}

export class InputManagerService extends Context.Tag('app/InputManager')<InputManagerService, InputManager>() {}
export class ThreeContextService extends Context.Tag('app/ThreeContext')<ThreeContextService, ThreeContext>() {}
export { MaterialManager } from '@/infrastructure/material-manager'

// --- Service Tags for State ---

export class DeltaTime extends Context.Tag('app/DeltaTime')<DeltaTime, number>() {}
export class SpatialGridService extends Context.Tag('app/SpatialGrid')<SpatialGridService, SpatialGrid>() {}
export class RaycastResultService extends Context.Tag('app/RaycastResult')<
  RaycastResultService,
  Effect.Ref<Option.Option<RaycastResult>>
>() {}
export class ChunkDataQueue extends Context.Tag('app/ChunkDataQueue')<ChunkDataQueue, ChunkGenerationResult[]>() {}
export class RenderQueue extends Context.Tag('app/RenderQueue')<RenderQueue, RenderCommand[]>() {}

// --- Renderer Definition ---

export interface Renderer {
  readonly processRenderQueue: Effect.Effect<void>
  readonly syncCameraToWorld: Effect.Effect<void, never, WorldContext>
  readonly updateHighlight: Effect.Effect<void, never, WorldContext>
  readonly updateInstancedMeshes: Effect.Effect<void>
  readonly renderScene: Effect.Effect<void>
}
export class RendererService extends Context.Tag('app/Renderer')<RendererService, Renderer>() {}

// --- Game State Service ---

export const hotbarUpdater = (_hotbar: Hotbar) => Effect.void

export interface GameState {
  readonly getHotbar: Effect.Effect<Hotbar, never, WorldContext>
}
export class GameState extends Context.Tag('app/GameState')<GameState, GameState>() {
  static readonly Live = Layer.succeed(
    GameState,
    {
      getHotbar: Effect.gen(function* (_) {
        const players = yield* _(World.query(playerQuery))
        return pipe(
          A.get(players, 0),
          Option.map((p) => p.hotbar),
          Option.getOrElse(() => new Hotbar({ slots: [], selectedIndex: 0 })),
        )
      }),
    },
  )
}
