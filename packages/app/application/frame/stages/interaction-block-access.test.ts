import { describe, it } from '@effect/vitest'
import { Effect, Either, HashMap, MutableRef, Option } from 'effect'
import { expect, vi } from 'vitest'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import type { DirtyChunkEntry } from '@ts-minecraft/app/frame/frame-maintenance-dirty'
import type { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import {
  buildBlockAtFromCache,
  buildChunkCache,
  InteractionBlockReadError,
  readChunkBlockId,
  markChunkDirtyAt,
  readBlockTypeAt,
} from './interaction-block-access'

const makeChunk = (x: number, z: number): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const setChunkBlock = (chunk: Chunk, lx: number, y: number, lz: number, type: BlockType): void => {
  chunk.blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex(type)
}

const makeChunkManager = (
  getChunk: (coord: { readonly x: number; readonly z: number }) => Effect.Effect<Chunk, Error>,
): ChunkManagerService => ({ getChunk }) as ChunkManagerService

describe('interaction-block-access', () => {
  it('builds a cache from loaded chunks and skips failed reads', () => {
    const chunk = makeChunk(2, -3)
    const cache = buildChunkCache([
      Option.none(),
      Option.some({ coord: { x: 2, z: -3 }, chunk }),
    ])

    expect(cache.size).toBe(1)
    expect(cache.get('2,-3')).toBe(chunk)
  })

  it.effect('reads the block type at world coordinates without hiding chunk read errors', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(-1, 2)
      setChunkBlock(chunk, 15, 12, 0, 'STONE')
      const getChunk = vi.fn(() => Effect.succeed(chunk))
      const blockType = yield* readBlockTypeAt(makeChunkManager(getChunk), { x: -1, y: 12, z: 32 })

      expect(blockType).toBe('STONE')
      expect(getChunk).toHaveBeenCalledWith({ x: -1, z: 2 })
    }),
  )

  it.effect('treats vertical out-of-world reads as air without touching chunk storage', () =>
    Effect.gen(function* () {
      const getChunk = vi.fn(() => Effect.fail(new Error('unexpected chunk read')))
      const chunkManager = makeChunkManager(getChunk)

      expect(yield* readBlockTypeAt(chunkManager, { x: 0, y: -1, z: 0 })).toBe('AIR')
      expect(yield* readBlockTypeAt(chunkManager, { x: 0, y: CHUNK_HEIGHT, z: 0 })).toBe('AIR')
      expect(getChunk).not.toHaveBeenCalled()
    }),
  )

  it.effect('propagates chunk read failures instead of converting them to air', () =>
    Effect.gen(function* () {
      const result = yield* readBlockTypeAt(
        makeChunkManager(() => Effect.fail(new Error('chunk unavailable'))),
        { x: 0, y: 64, z: 0 },
      ).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
    }),
  )

  it.effect('rejects incomplete chunk storage instead of converting missing cells to air', () =>
    Effect.gen(function* () {
      const incompleteChunk: Chunk = { ...makeChunk(0, 0), blocks: new Uint8Array(0) }
      const result = yield* readBlockTypeAt(
        makeChunkManager(() => Effect.succeed(incompleteChunk)),
        { x: 0, y: 64, z: 0 },
      ).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InteractionBlockReadError)
      }
    }),
  )

  it.effect('rejects chunk block indexes outside the fixed storage range', () =>
    Effect.gen(function* () {
      const result = yield* readChunkBlockId(makeChunk(0, 0).blocks, CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InteractionBlockReadError)
      }
    }),
  )

  it.effect('rejects fixed-length chunk storage with a missing cell', () =>
    Effect.gen(function* () {
      const sparseBlocks = { length: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT } as ArrayLike<number>
      const result = yield* readChunkBlockId(sparseBlocks, 0).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InteractionBlockReadError)
      }
    }),
  )

  it.effect('marks the chunk containing a position dirty when the updated chunk is readable', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(1, -1)
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, DirtyChunkEntry>())

      yield* markChunkDirtyAt(
        makeChunkManager(() => Effect.succeed(chunk)),
        dirtyChunksRef,
        { x: 16, y: 64, z: -1 },
      )

      const dirtyChunks = MutableRef.get(dirtyChunksRef)
      expect(HashMap.size(dirtyChunks)).toBe(1)
      expect(Option.getOrThrow(HashMap.get(dirtyChunks, '1,-1')).chunk).toBe(chunk)
    }),
  )

  it.effect('leaves dirty chunks unchanged when the updated chunk cannot be read', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, DirtyChunkEntry>())

      yield* markChunkDirtyAt(
        makeChunkManager(() => Effect.fail(new Error('chunk unavailable'))),
        dirtyChunksRef,
        { x: 0, y: 64, z: 0 },
      )

      expect(HashMap.size(MutableRef.get(dirtyChunksRef))).toBe(0)
    }),
  )

  it.effect('builds a block reader over a complete cache', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(-1, 0)
      setChunkBlock(chunk, 15, 20, 0, 'OBSIDIAN')
      const blockAt = yield* buildBlockAtFromCache(new Map([['-1,0', chunk]]), [{ x: -1, z: 0 }])

      expect(blockAt(-1, 20, 0)).toBe('OBSIDIAN')
      expect(blockAt(-1, -1, 0)).toBe('AIR')
      expect(blockAt(-1, CHUNK_HEIGHT, 0)).toBe('AIR')
    }),
  )

  it.effect('fails when a required cached chunk is missing', () =>
    Effect.gen(function* () {
      const result = yield* buildBlockAtFromCache(new Map(), [{ x: 0, z: 0 }]).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InteractionBlockReadError)
      }
    }),
  )

  it.effect('fails when a cached chunk has incomplete storage', () =>
    Effect.gen(function* () {
      const chunk: Chunk = { ...makeChunk(0, 0), blocks: new Uint8Array(0) }
      const result = yield* buildBlockAtFromCache(new Map([['0,0', chunk]]), [{ x: 0, z: 0 }]).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InteractionBlockReadError)
      }
    }),
  )
})
