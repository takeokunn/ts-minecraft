import { Effect, HashSet, Option, Ref } from 'effect'
import { StorageError } from '../domain/errors'
import { type ChunkOpsContext } from './chunk-manager-ops'
import { collectDirtyChunksToSave } from './chunk-manager-service-save-selection'

export const saveDirtyChunks = (ctx: ChunkOpsContext): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(ctx.cache)
    const keysToSave = state.dirtyChunks
    const currentWorldId = yield* Ref.get(ctx.worldIdRef)
    const chunksToSave = collectDirtyChunksToSave(state, keysToSave)
    yield* Effect.forEach(chunksToSave, (entry) => ctx.storageService.saveChunk(entry.worldId ?? currentWorldId, entry.chunk.coord, {
      blocks: entry.chunk.blocks,
      fluid: Option.getOrUndefined(entry.chunk.fluid),
    }), { concurrency: 1 })
    yield* Ref.update(ctx.cache, (s) => ({ ...s, dirtyChunks: HashSet.difference(s.dirtyChunks, keysToSave) }))
  })
