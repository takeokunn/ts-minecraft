import { Context, Effect, Option, Ref } from 'effect'
import { ChunkGenerationResult, RenderCommand, SystemCommand } from '@/domain/types'
import { InputManager } from '@/infrastructure/input-browser'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { MaterialManager } from '@/infrastructure/material-manager'
import { World } from './world'
import { ComputationWorkerTag } from '@/infrastructure/computation.worker'
import { ThreeContextService } from '@/infrastructure/types'
import { Hotbar } from '@/domain/components'

// --- Service Tags for Dependencies ---

export type OnCommand = (
  command: SystemCommand,
) => Effect.Effect<void, never, World | Context.Tag.Service<typeof ComputationWorkerTag> | Context.Tag.Service<typeof ChunkDataQueueService>>
export const OnCommand = Context.GenericTag<OnCommand>('app/OnCommand')

export const InputManagerService = InputManager
export { ThreeContextService }
export const MaterialManagerService = MaterialManager
export { MaterialManager } from '@/infrastructure/material-manager'

// --- Service Tags for State ---

export const DeltaTime = Context.GenericTag<number>('app/DeltaTime')
export const SpatialGridService = SpatialGrid
export const RaycastResultService = Context.GenericTag<Ref.Ref<Option.Option<RaycastResult>>>('app/RaycastResultService')
export const ChunkDataQueueService = Context.GenericTag<ChunkGenerationResult[]>('app/ChunkDataQueueService')
export const RenderQueueService = Context.GenericTag<RenderCommand[]>('app/RenderQueueService')

// --- Renderer Definition ---

export interface Renderer {
  readonly processRenderQueue: Effect.Effect<void>
  readonly syncCameraToWorld: Effect.Effect<void>
  readonly updateHighlight: Effect.Effect<void>
  readonly updateInstancedMeshes: Effect.Effect<void>
  readonly renderScene: Effect.Effect<void>
}
export const RendererService = Context.GenericTag<Renderer>('app/RendererService')

// --- Game State Service ---

export interface GameState {
  readonly hotbar: Hotbar
}
export const GameStateService = Context.GenericTag<GameState>('app/GameStateService')
