import { ChunkRepository } from '@domain/chunk/repository/chunk_repository'
import { Layer } from 'effect'
import { InMemoryChunkRepositoryLive } from './memory_implementation'

/**
 * WebWorker ChunkRepository Implementation (Fallback)
 *
 * 本番環境ではWebWorker経由の非同期永続化を想定するが、
 * 現時点ではメモリ実装を委譲するレイヤーを提供する。
 * WebWorker対応が必要な場合は、このレイヤーを差し替えて
 * Worker とのメッセージ駆動処理を実装する。
 */
export const WebWorkerChunkRepositoryLive: Layer.Layer<ChunkRepository> = InMemoryChunkRepositoryLive
