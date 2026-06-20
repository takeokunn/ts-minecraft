import { Effect } from 'effect'

import { collectFallingBlockMoves } from '../domain/falling-block'
import type { BlockService } from './block-service'
import type { ChunkManagerService } from './chunk-manager-service'

type FallingBlockMaintenanceServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getLoadedChunks'>
}

export const runFallingBlockMaintenance = (
  services: FallingBlockMaintenanceServices,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const loadedChunks = yield* services.chunkManagerService
      .getLoadedChunks()
      .pipe(Effect.catchAllCause(() => Effect.succeed([])))

    const fallingBlockMoves = yield* collectFallingBlockMoves(loadedChunks).pipe(
      Effect.catchAllCause(() => Effect.succeed([])),
    )

    for (const move of fallingBlockMoves) {
      yield* services.blockService.forceSetBlock(move.from, 'AIR').pipe(Effect.catchAllCause(() => Effect.void))
      yield* services.blockService.forceSetBlock(move.to, move.blockType).pipe(Effect.catchAllCause(() => Effect.void))
    }
  })
