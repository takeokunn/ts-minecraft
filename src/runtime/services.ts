import { Context, Effect, Option, Ref } from 'effect'
import { RenderCommand, SystemCommand } from '@/domain/types'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { Hotbar } from '@/domain/components'
import { ChunkGenerationResult, ComputationWorker } from '@/infrastructure/computation.worker'
import { WorldContext } from './context'
import { InputManager } from '@/infrastructure/input-browser'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { ThreeContext } from '@/infrastructure/renderer-three/context'

// --- Service Tags for Dependencies ---

export type OnCommand = (
  command: SystemCommand,
) => Effect.Effect<void, never, WorldContext | ComputationWorker | ChunkDataQueueService>
export const OnCommand = Context.GenericTag<OnCommand>('app/OnCommand')

export const InputManagerService = Context.GenericTag<InputManager>('app/InputManagerService')
export const ThreeContextService = Context.GenericTag<ThreeContext>('app/ThreeContextService')
export { MaterialManager } from '@/infrastructure/material-manager'

// --- Service Tags for State ---

export const DeltaTime = Context.GenericTag<number>('app/DeltaTime')
export const SpatialGridService = Context.GenericTag<SpatialGrid>('app/SpatialGridService')
export const RaycastResultService = Context.GenericTag<Ref.Ref<Option.Option<RaycastResult>>>('app/RaycastResultService')
export const ChunkDataQueueService = Context.GenericTag<ChunkGenerationResult[]>('app/ChunkDataQueueService')
export const RenderQueueService = Context.GenericTag<RenderCommand[]>('app/RenderQueueService')

// --- Renderer Definition ---

export interface Renderer {
  readonly processRenderQueue: Effect.Effect<void>
  readonly syncCameraToWorld: Effect.Effect<void, never, WorldContext>
  readonly updateHighlight: Effect.Effect<void, never, WorldContext>
  readonly updateInstancedMeshes: Effect.Effect<void>
  readonly renderScene: Effect.Effect<void>
}
export const RendererService = Context.GenericTag<Renderer>('app/RendererService')

// --- Game State Service ---

export interface GameState {
  readonly hotbar: Hotbar
}
export const GameStateService = Context.GenericTag<GameState>('app/GameStateService')
