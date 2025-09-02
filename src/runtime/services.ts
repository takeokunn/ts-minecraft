import { Context, Effect, Option, Ref } from 'effect'
import { RenderCommand, SystemCommand } from '@/domain/types'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { Hotbar } from '@/domain/components'
import { ChunkGenerationResult, ComputationWorker } from '@/infrastructure/computation.worker'
import { WorldContext } from './context'
import { InputManager } from '@/infrastructure/input-browser'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { ThreeContext } from '@/infrastructure/types'

// --- Service Tags for Dependencies ---

type OnCommandFn = (command: SystemCommand) => Effect.Effect<void, never, WorldContext | ComputationWorker | ChunkDataQueueService>
export class OnCommand extends Context.Tag('app/OnCommand')<OnCommand, OnCommandFn>() {}

export class InputManagerService extends Context.Tag('app/InputManagerService')<InputManagerService, InputManager>() {}
export class ThreeContextService extends Context.Tag('app/ThreeContextService')<ThreeContextService, ThreeContext>() {}
export { MaterialManager } from '@/infrastructure/material-manager'

// --- Service Tags for State ---

export class DeltaTime extends Context.Tag('app/DeltaTime')<DeltaTime, number>() {}
export class SpatialGridService extends Context.Tag('app/SpatialGridService')<SpatialGridService, SpatialGrid>() {}
export class RaycastResultService extends Context.Tag('app/RaycastResultService')<
  RaycastResultService,
  Ref.Ref<Option.Option<RaycastResult>>
>() {}
export class ChunkDataQueueService extends Context.Tag('app/ChunkDataQueueService')<
  ChunkDataQueueService,
  ChunkGenerationResult[]
>() {}
export class RenderQueueService extends Context.Tag('app/RenderQueueService')<RenderQueueService, RenderCommand[]>() {}

// --- Renderer Definition ---

export interface Renderer {
  readonly processRenderQueue: Effect.Effect<void>
  readonly syncCameraToWorld: Effect.Effect<void, never, WorldContext>
  readonly updateHighlight: Effect.Effect<void, never, WorldContext>
  readonly updateInstancedMeshes: Effect.Effect<void>
  readonly renderScene: Effect.Effect<void>
}
export class RendererService extends Context.Tag('app/RendererService')<RendererService, Renderer>() {}

// --- Game State Service ---

export interface GameState {
  readonly getHotbar: Effect.Effect<Hotbar, never, WorldContext>
}
export class GameStateService extends Context.Tag('app/GameStateService')<GameStateService, GameState>() {}