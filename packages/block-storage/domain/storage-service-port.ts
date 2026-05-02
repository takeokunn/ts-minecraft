import { Effect, Option } from 'effect'
import type { WorldId } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/domain'
import { StorageError } from '@ts-minecraft/domain'

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
      saveChunk: (
        _worldId: WorldId,
        _chunkCoord: ChunkCoord,
        _data: ChunkStorageValue,
      ): Effect.Effect<void, StorageError> => Effect.void,
      loadChunk: (
        _worldId: WorldId,
        _chunkCoord: ChunkCoord,
      ): Effect.Effect<Option.Option<ChunkStorageValue>, StorageError> => Effect.succeed(Option.none()),
    },
  }
) {}
