import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect, vi } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked, type Chunk } from '@ts-minecraft/world'
import {
  makeVillageSurfaceResolver,
  readVillageBlockId,
} from '../../application/village/village-placement-surface'
import { VillagePlacementBlockReadError } from '../../application/village/village-placement-surface-error'
import { makeTestChunk } from './test-utils'

const setBlock = (
  blocks: Uint8Array,
  localX: number,
  y: number,
  localZ: number,
  blockType: Parameters<typeof blockTypeToIndex>[0],
) => {
  blocks[chunkBlockIndexUnchecked(localX, y, localZ)] = blockTypeToIndex(blockType)
}

describe('village/village-placement.surface', () => {
  it.effect('caches chunk loads for repeated queries in the same chunk', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      setBlock(blocks, 1, 9, 2, 'STONE')
      const chunk = makeTestChunk(blocks)
      const getChunk = vi.fn(() => Effect.succeed(chunk))
      const resolveSurface = makeVillageSurfaceResolver({ getChunk })

      const first = yield* resolveSurface(17, 18)
      const second = yield* resolveSurface(17, 18)

      expect(first).toBe(9)
      expect(second).toBe(9)
      expect(getChunk).toHaveBeenCalledTimes(1)
      expect(getChunk).toHaveBeenCalledWith({ x: 1, z: 1 })
    }),
  )

  it.effect('returns the highest solid block while skipping non-ground blocks', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      setBlock(blocks, 3, 6, 4, 'STONE')
      setBlock(blocks, 3, 7, 4, 'WATER')
      setBlock(blocks, 3, 8, 4, 'LEAVES')
      setBlock(blocks, 3, 9, 4, 'WOOD')
      const chunk = makeTestChunk(blocks)
      const getChunk = vi.fn(() => Effect.succeed(chunk))
      const resolveSurface = makeVillageSurfaceResolver({ getChunk })

      const surfaceY = yield* resolveSurface(3, 4)

      expect(surfaceY).toBe(6)
      expect(getChunk).toHaveBeenCalledTimes(1)
    }),
  )

  it.effect('fails when the chunk block buffer is truncated', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT - 1)
      const chunk = {
        coord: { x: 0, z: 0 },
        blocks: blocks as unknown as Chunk['blocks'],
        dirty: false,
      } as Chunk
      const getChunk = vi.fn(() => Effect.succeed(chunk))
      const resolveSurface = makeVillageSurfaceResolver({ getChunk })

      const result = yield* resolveSurface(0, 0).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(VillagePlacementBlockReadError)
        expect(result.left.message).toContain('complete chunk block buffer')
      }
      expect(getChunk).toHaveBeenCalledTimes(1)
    }),
  )

  it.effect('fails when the requested block index is outside chunk bounds', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

      const result = yield* readVillageBlockId(blocks, CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(VillagePlacementBlockReadError)
        expect(result.left.message).toContain('outside chunk bounds')
      }
    }),
  )
})
