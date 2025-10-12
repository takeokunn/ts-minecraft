/**
 * @fileoverview Chunk Worker Runtime
 * Worker Adapterのキューを監視し、リポジトリおよびキャッシュへ反映するバックグラウンド処理。
 */

import { ChunkRepository } from '@/domain/chunk/repository'
import type { ChunkData, ChunkPosition } from '@/domain/chunk/types'
import { Effect, Layer, Match, Option } from 'effect'
import { ChunkCacheServiceTag, type ChunkCacheService } from './chunk-cache'
import { ChunkWorkerAdapterTag, type ChunkWorkerMessage } from './worker-adapter'

const cacheSet = (cacheOption: Option.Option<ChunkCacheService>, chunk: ChunkData) =>
  Option.match(cacheOption, {
    onNone: () => Effect.void,
    onSome: (cache) => cache.set(chunk),
  })

const cacheInvalidate = (cacheOption: Option.Option<ChunkCacheService>, position: ChunkPosition) =>
  Option.match(cacheOption, {
    onNone: () => Effect.void,
    onSome: (cache) => cache.invalidate(position),
  })

const processMessage = (
  message: ChunkWorkerMessage,
  cacheOption: Option.Option<ChunkCacheService>
) =>
  Match.value(message).pipe(
    Match.tag('LoadChunkRequest', (msg) =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const chunkOption = yield* repository.findByPosition(msg.position)
        yield* Option.match(chunkOption, {
          onSome: (chunk) =>
            Effect.gen(function* () {
              yield* cacheSet(cacheOption, chunk)
              yield* Effect.logDebug(
                `[ChunkWorkerRuntime] LoadChunkRequest - キャッシュを更新 (${msg.position.x}, ${msg.position.z})`
              )
            }),
          onNone: () =>
            Effect.logDebug(
              `[ChunkWorkerRuntime] LoadChunkRequest - チャンク未発見 (${msg.position.x}, ${msg.position.z})`
            ),
        })
      })
    ),
    Match.tag('SaveChunkRequest', (msg) =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const saved = yield* repository.save(msg.chunk)
        yield* cacheSet(cacheOption, saved)
        yield* Effect.logDebug(`[ChunkWorkerRuntime] SaveChunkRequest - チャンク保存: ${saved.id}`)
      })
    ),
    Match.tag('UnloadChunkRequest', (msg) =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const chunkOption = yield* repository.findById(msg.chunkId)
        yield* repository.delete(msg.chunkId)

        yield* Option.match(chunkOption, {
          onSome: (chunk) => cacheInvalidate(cacheOption, chunk.position),
          onNone: () => Effect.void,
        })

        yield* Effect.logDebug(`[ChunkWorkerRuntime] UnloadChunkRequest - チャンク削除: ${msg.chunkId}`)
      })
    ),
    Match.exhaustive
  )

export const ChunkWorkerRuntimeLayer = Layer.scopedDiscard(
  Effect.gen(function* () {
    const adapter = yield* ChunkWorkerAdapterTag
    const cacheOption = yield* Effect.serviceOption(ChunkCacheServiceTag)

    const runLoop = Effect.forever(
      adapter.take.pipe(
        Effect.flatMap((message) =>
          processMessage(message, cacheOption).pipe(
            Effect.catchAll((error) =>
              Effect.logError(`[ChunkWorkerRuntime] メッセージ処理中のエラー: ${String(error)}`).pipe(Effect.asVoid)
            )
          )
        )
      )
    )

    yield* Effect.forkScoped(runLoop)
  })
)
