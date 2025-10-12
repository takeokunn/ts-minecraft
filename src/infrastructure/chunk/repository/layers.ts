import { Layer } from 'effect'

import { InMemoryChunkRepositoryLive } from './chunk_repository/memory_implementation'
import { ChunkRepository } from '@domain/chunk/repository'

/**
 * Chunk Repository Layers
 *
 * Domain が要求する `ChunkRepository` 契約に対する実装を提供する。
 * 現状はメモリ実装のみを公開し、他環境向け実装は今後追加予定。
 */

export const ChunkRepositoryMemoryLayer: Layer.Layer<ChunkRepository> = InMemoryChunkRepositoryLive
