import { describe, expect, it } from '@effect/vitest'
import { ChunkAPIService, ChunkApplicationLive } from '@application/chunk'
import { createChunkPositionSync, createEmptyChunkDataAggregate, type ChunkData } from '@/domain/chunk'
import { ChunkCommandSchema } from '@/domain/chunk/types'
import { ChunkWorkerAdapterTag } from '@/infrastructure/chunk'
import { Clock, Duration, Effect, Fiber, Option, Schema } from 'effect'

const createSampleChunk = (x: number, z: number, suffix: string) =>
  Effect.gen(function* () {
    const position = createChunkPositionSync(x, z)
    const aggregate = yield* createEmptyChunkDataAggregate(position)
    return {
      id: `${position.x}:${position.z}:${suffix}`,
      position: aggregate.position,
      blocks: aggregate.blocks instanceof Uint16Array ? aggregate.blocks : new Uint16Array(aggregate.blocks),
      metadata: {
        ...aggregate.metadata,
        heightMap: [...aggregate.metadata.heightMap],
        lightLevel: aggregate.metadata.lightLevel ?? 0,
        lastUpdate: aggregate.metadata.lastUpdate ?? 0,
        isModified: aggregate.metadata.isModified ?? false,
        biome: aggregate.metadata.biome ?? 'plains',
      },
      isDirty: false,
    } satisfies ChunkData
  })

describe('ChunkAPIService', () => {
  it.effect('requestChunkGenerationでLoadChunkコマンドをキューに積む', () =>
    Effect.gen(function* () {
      const api = yield* ChunkAPIService
      const adapter = yield* ChunkWorkerAdapterTag
      const position = createChunkPositionSync(0, 0)

      // キューを初期化
      yield* adapter.drain

      yield* api.requestChunkGeneration([position], { actorId: 'test-actor' })

      const messageOption = yield* adapter.poll
      expect(Option.isSome(messageOption)).toBe(true)
      const message = messageOption.value
      expect(message?._tag).toBe('LoadChunkRequest')
      expect(message?.position).toEqual(position)
    }).pipe(Effect.provideSomeLayer(ChunkApplicationLive))
  )

  it.effect('requestAndWaitForChunksで生成されたチャンクを取得する', () =>
    Effect.gen(function* () {
      const api = yield* ChunkAPIService
      const adapter = yield* ChunkWorkerAdapterTag
      const position = createChunkPositionSync(4, 4)

      const awaitFiber = yield* Effect.fork(
        api.requestAndWaitForChunks([position], {
          actorId: 'test-actor',
          requesterId: 'test-requester',
          pollIntervalMs: 10,
          timeoutMs: 2_000,
        })
      )

      yield* Clock.sleep(Duration.millis(25))

      const chunk = yield* createSampleChunk(4, 4, 'api')
      const saveCommand = yield* Schema.decode(ChunkCommandSchema)({
        _tag: 'SaveChunk',
        commandId:
          typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        issuedAt: Date.now(),
        actorId: 'test-actor',
        chunk,
      })

      yield* adapter.publish(saveCommand)

      const chunks = yield* Fiber.join(awaitFiber)
      expect(chunks).toHaveLength(1)
      expect(chunks[0]?.id).toBe(chunk.id)
    }).pipe(Effect.provideSomeLayer(ChunkApplicationLive))
  )
})
