import { Effect, Option } from 'effect'
import type { WorldId } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import { StorageError } from '@ts-minecraft/world-state'

export type ChunkStorageValue =
  | Uint8Array<ArrayBufferLike>
  | {
      readonly blocks: Uint8Array<ArrayBufferLike>
      readonly fluid: Uint8Array<ArrayBufferLike> | undefined
    }

// Application-layer port for chunk persistence.
// Decouples application services from IndexedDB infrastructure.
// Wired to infrastructure/storage/StorageService via StoragePortLayer in src/layers.ts.
export class StorageServicePort extends Effect.Service<StorageServicePort>()(
  '@minecraft/application/storage/StorageServicePort',
  {
    succeed: {
      /* c8 ignore next 5 */
      saveChunk: (
        _worldId: WorldId,
        _chunkCoord: ChunkCoord,
        _data: ChunkStorageValue,
      ): Effect.Effect<void, StorageError> => Effect.void,
      /* c8 ignore next 4 */
      loadChunk: (
        _worldId: WorldId,
        _chunkCoord: ChunkCoord,
      ): Effect.Effect<Option.Option<ChunkStorageValue>, StorageError> => Effect.succeed(Option.none()),
    },
  }
) {}
