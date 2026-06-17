import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { ChunkManagerService } from '@ts-minecraft/world'
import { makeColumnReaderAt, PhysicsColumnReadError } from './physics-stage-utils'

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const makeChunkManagerService = (
  getChunk: ChunkManagerService['getChunk'],
): ChunkManagerService => ({ getChunk } as ChunkManagerService)

const makeChunk = (blocks: ArrayLike<number>) => ({
  coord: { x: 0, z: 0 },
  blocks,
})

describe('physics-stage-utils — column reader', () => {
  it.effect('reads block ids from a complete loaded chunk column', () => Effect.gen(function* () {
    const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
    blocks[64] = blockTypeToIndex('STONE')
    const service = makeChunkManagerService(vi.fn(() => Effect.succeed(makeChunk(blocks))))

    const blockAt = yield* makeColumnReaderAt(service, { x: 0, y: 64, z: 0 })

    expect(blockAt(64)).toBe('STONE')
    expect(blockAt(-1)).toBeNull()
    expect(blockAt(CHUNK_HEIGHT)).toBeNull()
  }))

  it.effect('keeps unloaded chunks as an empty column', () => Effect.gen(function* () {
    const service = makeChunkManagerService(vi.fn(() => Effect.fail(new Error('chunk not loaded'))))

    const blockAt = yield* makeColumnReaderAt(service, { x: 0, y: 64, z: 0 })

    expect(blockAt(64)).toBeNull()
  }))

  it.effect('fails instead of treating short chunk storage as air', () => Effect.gen(function* () {
    const service = makeChunkManagerService(vi.fn(() => Effect.succeed(makeChunk(new Uint8Array(0)))))

    const error = yield* makeColumnReaderAt(service, { x: 0, y: 64, z: 0 }).pipe(Effect.flip)

    expect(error).toBeInstanceOf(PhysicsColumnReadError)
    expect(error.message).toContain(`expected ${CHUNK_BLOCK_COUNT} block ids`)
  }))

  it.effect('fails instead of treating sparse chunk storage cells as air', () => Effect.gen(function* () {
    const sparseBlocks = { length: CHUNK_BLOCK_COUNT, 0: blockTypeToIndex('STONE') } as ArrayLike<number>
    const service = makeChunkManagerService(vi.fn(() => Effect.succeed(makeChunk(sparseBlocks))))

    const error = yield* makeColumnReaderAt(service, { x: 0, y: 64, z: 0 }).pipe(Effect.flip)

    expect(error).toBeInstanceOf(PhysicsColumnReadError)
    expect(error.message).toBe('block id at index 1 is missing')
  }))
})
