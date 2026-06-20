import { Effect } from 'effect'
import type { FluidCell } from '@ts-minecraft/block/domain/fluid-model'
import type { Position, BlockType } from '@ts-minecraft/core'
import type { LoadedChunkCache } from './fluid-service-helpers'

export type FluidServiceWrites = {
  readonly writeFluid: (loaded: LoadedChunkCache, position: Position, cell: FluidCell) => Effect.Effect<void, never>
  readonly writeSolid: (loaded: LoadedChunkCache, position: Position, blockType: BlockType) => Effect.Effect<void, never>
}
