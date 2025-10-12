import { describe, expect, it } from '@effect/vitest'
import {
  ChunkInfrastructureLayer,
  ChunkCacheServiceTag,
  ChunkCacheServiceLive,
  provideChunkCacheConfig,
  ChunkWorkerAdapterLive,
  ChunkWorkerAdapterTag,
} from '@/infrastructure/chunk'
import { ChunkCommandSchema, createChunkPositionSync, createEmptyChunkDataAggregate } from '@/domain/chunk'
import { ChunkRepository } from '@/domain/chunk/repository'
import { ChunkRepositoryMemoryLayer } from '@/infrastructure/chunk/repository/layers'
import type { ChunkData } from '@/domain/chunk/types'
import { Effect, Layer, Option, Schedule, Schema } from 'effect'

const createLoadCommand = (commandId: string, x: number, z: number) =>
  Effect.sync(() =>
    Schema.decodeSync(ChunkCommandSchema)({
      _tag: 'LoadChunk',
      commandId,
      issuedAt: Date.now(),
      actorId: 'test',
      position: createChunkPositionSync(x, z),
    })
  )

const createSaveCommand = (commandId: string, chunk: ChunkData) =>
  Effect.sync(() =>
    Schema.decodeSync(ChunkCommandSchema)({
      _tag: 'SaveChunk',
      commandId,
      issuedAt: Date.now(),
      actorId: 'test',
      chunk,
    })
  )

const createSampleChunk = (x: number, z: number, suffix: string) =>
  Effect.gen(function* () {
    const position = createChunkPositionSync(x, z)
    const aggregate = yield* createEmptyChunkDataAggregate(position)
    return {
      id: `${aggregate.id}-${suffix}`,
      position: aggregate.position,
      blocks: aggregate.blocks instanceof Uint16Array ? aggregate.blocks : new Uint16Array(aggregate.blocks),
      metadata: aggregate.metadata,
      isDirty: aggregate.isDirty ?? false,
    } satisfies ChunkData
  })

describe('ChunkWorkerAdapter', () => {
  it.effect('publishとdrainでメッセージとメトリクスを管理できる', () =>
    Effect.gen(function* () {
      const loadCommand = yield* createLoadCommand('00000000-0000-0000-0000-000000000001', 0, 0)
      const adapter = yield* ChunkWorkerAdapterTag

      yield* adapter.publish(loadCommand)

      const drained = yield* adapter.drain
      expect(drained).toHaveLength(1)
      expect(drained[0]?._tag).toBe('LoadChunkRequest')
      expect(drained[0]?.position).toEqual(loadCommand.position)

      const metrics = yield* adapter.metrics
      expect(metrics.enqueued).toBe(1)
      expect(metrics.processed).toBe(1)
      expect(metrics.queueSize).toBe(0)
    }).pipe(Effect.provideSomeLayer(ChunkWorkerAdapterLive))
  )

  it.effect('キュー容量を超えるとQueueFullエラーを返す', () =>
    Effect.gen(function* () {
      const adapter = yield* ChunkWorkerAdapterTag

      const commands = yield* Effect.forEach(Array.from({ length: 256 }, (_, index) => index), (index) =>
        createLoadCommand(`00000000-0000-0000-0000-${(index + 1).toString().padStart(12, '0')}`, index, 0)
      )

      yield* Effect.forEach(commands, (command) => adapter.publish(command))

      const overflowCommand = yield* createLoadCommand('00000000-0000-0000-0000-000000000500', 999, 0)
      const publishResult = yield* Effect.either(adapter.publish(overflowCommand))

      expect(publishResult._tag).toBe('Left')
      expect(publishResult.left._tag).toBe('QueueFull')
    }).pipe(Effect.provideSomeLayer(ChunkWorkerAdapterLive))
  )
})

const cacheLayer = (config: { readonly maxEntries: number }) =>
  ChunkCacheServiceLive.pipe(Layer.provide(provideChunkCacheConfig(config)))

describe('ChunkCacheService', () => {
  it.effect('getOrLoadでローダー結果をキャッシュする', () =>
    Effect.gen(function* () {
      const chunk = yield* createSampleChunk(1, 1, 'cache')
      const cache = yield* ChunkCacheServiceTag

      let loaderCalls = 0
      const loader = Effect.sync(() => {
        loaderCalls += 1
        return chunk
      })

      const first = yield* cache.getOrLoad(chunk.position, loader)
      const second = yield* cache.getOrLoad(chunk.position, loader)

      expect(loaderCalls).toBe(1)
      expect(second).toStrictEqual(first)
    }).pipe(Effect.provideSomeLayer(cacheLayer({ maxEntries: 8 })))
  )

  it.effect('最大容量を超えると最古のエントリが追い出される', () =>
    Effect.gen(function* () {
      const cache = yield* ChunkCacheServiceTag
      const first = yield* createSampleChunk(0, 0, 'A')
      const second = yield* createSampleChunk(1, 0, 'B')

      yield* cache.set(first)
      yield* cache.set(second)

      const stats = yield* cache.stats
      expect(stats.size).toBe(1)
      expect(stats.evictions).toBe(1)
    }).pipe(Effect.provideSomeLayer(cacheLayer({ maxEntries: 1 })))
  )

  it.effect('flushDirtyで汚染チャンクを取得できる', () =>
    Effect.gen(function* () {
      const cache = yield* ChunkCacheServiceTag
      const dirtyChunk = yield* createSampleChunk(2, 0, 'dirty')
      const markedDirty: ChunkData = { ...dirtyChunk, isDirty: true }

      yield* cache.set(markedDirty)

      const flushed = yield* cache.flushDirty
      expect(flushed).toHaveLength(1)
      expect(flushed[0]?.position).toEqual(markedDirty.position)
    }).pipe(Effect.provideSomeLayer(cacheLayer({ maxEntries: 4 })))
  )
})

describe('ChunkWorkerRuntime', () => {
  it.effect('SaveChunkCommandを処理してリポジトリとキャッシュへ反映する', () =>
    Effect.gen(function* () {
      const adapter = yield* ChunkWorkerAdapterTag
      const repository = yield* ChunkRepository
      const cache = yield* ChunkCacheServiceTag

      const chunk = yield* createSampleChunk(4, 4, 'runtime')
      const saveCommand = yield* createSaveCommand('00000000-0000-0000-0000-00000000ABCD', {
        ...chunk,
        isDirty: true,
      })

      yield* adapter.publish(saveCommand)

      const savedChunk = yield* repository
        .findById(chunk.id)
        .pipe(
          Effect.flatMap((chunkOption) =>
            Option.match(chunkOption, {
              onNone: () => Effect.fail('chunk-not-found'),
              onSome: Effect.succeed,
            })
          ),
          Effect.retry(Schedule.recurs(5))
        )

      expect(savedChunk.id).toBe(chunk.id)

      const stats = yield* cache.stats
      expect(stats.size).toBeGreaterThan(0)
    }).pipe(
      Effect.provideSomeLayer(
        Layer.mergeAll(
          ChunkInfrastructureLayer.pipe(Layer.provide(provideChunkCacheConfig({ maxEntries: 8 }))),
          ChunkRepositoryMemoryLayer
        )
      )
    )
  )
})
