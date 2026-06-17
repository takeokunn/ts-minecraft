import { Effect, Option } from 'effect'
import { WorldId } from '../../packages/core/domain/ids'
import { deleteDatabase } from '../../packages/world/infrastructure/idb-utils'
import { StorageService } from '../../packages/world/infrastructure/storage-service'
import { DB_NAME } from '../../packages/world/infrastructure/storage-idb-model'

export type StorageServiceContractResult = Readonly<{
  savedBlocks: readonly number[]
  loadedBlocks: readonly number[]
  loadedFluid: readonly number[] | null
}>

export const runStorageServiceIndexedDbRoundtrip = (): Promise<StorageServiceContractResult> => {
  const worldId = WorldId.make('contract-storage-service')
  const coord = { x: 7, z: -3 }
  const savedBlocks = new Uint8Array([1, 2, 3, 4])
  const savedFluid = new Uint8Array([9, 8, 7, 6])

  return Effect.runPromise(
    Effect.gen(function* () {
      yield* deleteDatabase(DB_NAME).pipe(Effect.catchAll(() => Effect.void))
      const storage = yield* StorageService
      yield* storage.saveChunk(worldId, coord, { blocks: savedBlocks, fluid: savedFluid })
      const loaded = yield* storage.loadChunk(worldId, coord)

      return yield* Option.match(loaded, {
        onNone: () => Effect.fail(new Error('StorageService.loadChunk returned none after saveChunk')),
        onSome: (value) => Effect.succeed({
          savedBlocks: Array.from(savedBlocks),
          loadedBlocks: Array.from(value.blocks),
          loadedFluid: value.fluid === undefined ? null : Array.from(value.fluid),
        }),
      })
    }).pipe(Effect.provide(StorageService.Default)),
  )
}
