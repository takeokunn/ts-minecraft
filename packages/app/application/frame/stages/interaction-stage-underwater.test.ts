import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect, vi } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import {
  buildPlayerUnderwaterChunkCache,
  getPlayerChunkCoord,
  getPlayerUnderwater,
} from '@ts-minecraft/app/frame/stages/interaction-stage-underwater'

const makeChunk = (x: number, z: number) => ({
  coord: { x, z },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
})

const setChunkBlock = (chunk: ReturnType<typeof makeChunk>, x: number, y: number, z: number, blockType: BlockType): void => {
  const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  chunk.blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex(blockType)
}

describe('interaction-stage-underwater', () => {
  it('floors world coordinates into the containing chunk coordinate', () => {
    expect(getPlayerChunkCoord({ x: 0.1, y: 64, z: 15.9 })).toEqual({ x: 0, z: 0 })
    expect(getPlayerChunkCoord({ x: -0.1, y: 64, z: -16.01 })).toEqual({ x: -1, z: -2 })
  })

  it.effect('loads the 3x3 chunk neighborhood in dx-major, dz-minor order', () =>
    Effect.gen(function* () {
      const requested: Array<{ readonly x: number; readonly z: number }> = []
      const services = {
        chunkManagerService: {
          getChunk: (coord: { readonly x: number; readonly z: number }) => {
            requested.push(coord)
            if (coord.x === 1 && coord.z === 0) return Effect.succeed(makeChunk(coord.x, coord.z))
            return Effect.fail(new Error('chunk unavailable'))
          },
        },
      }

      const cache = yield* buildPlayerUnderwaterChunkCache(services as never, { x: 0, z: 0 })

      expect(requested).toEqual([
        { x: -1, z: -1 },
        { x: -1, z: 0 },
        { x: -1, z: 1 },
        { x: 0, z: -1 },
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: -1 },
        { x: 1, z: 0 },
        { x: 1, z: 1 },
      ])
      expect(cache).toHaveLength(9)
      expect(cache[7]).not.toBeNull()
      expect(cache.every((entry, index) => (index === 7 ? entry !== null : entry === null))).toBe(true)
    }),
  )

  it.effect('returns true when the player position is inside water', () =>
    Effect.gen(function* () {
      const centerChunk = makeChunk(0, 0)
      setChunkBlock(centerChunk, 1, 63, 2, 'WATER')
      const services = {
        chunkManagerService: {
          getChunk: (coord: { readonly x: number; readonly z: number }) =>
            Effect.succeed(coord.x === 0 && coord.z === 0 ? centerChunk : makeChunk(coord.x, coord.z)),
        },
      }
      const deps = {
        camera: {
          position: { x: 1.2, y: 63.4, z: 2.7 },
        },
      }

      const result = yield* getPlayerUnderwater(deps as never, services as never)

      expect(result).toBe(true)
    }),
  )
})
