import { Effect } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { worldToBlockLocal } from '../domain/block-utils'
import { BlockServiceError } from './block-service-error'
import {
  applyForceSetBlock,
  mapChunkLoadError,
  type ForceSetDeps,
} from './block-service-force-set-helpers'

export const makeForceSetBlock =
  ({ chunkManagerService, chunkService }: ForceSetDeps) =>
  (
    position: Position,
    blockType: BlockType,
  ): Effect.Effect<void, BlockServiceError> =>
    Effect.gen(function* () {
      const { chunkCoord, lx, lz, y } = worldToBlockLocal(position)
      const chunk = yield* chunkManagerService
        .getChunk(chunkCoord)
        .pipe(Effect.mapError(mapChunkLoadError(chunkCoord)))

      yield* applyForceSetBlock(
        chunkManagerService,
        chunkService,
        chunk,
        chunkCoord,
        lx,
        y,
        lz,
        blockType,
      )
    })
