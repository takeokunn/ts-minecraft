import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import { ChunkService, getLightAt, LIGHT_LEVEL_MAX } from '@ts-minecraft/world'
import type { ChunkService as ChunkServiceType } from '@ts-minecraft/world'
import { computeFreshLight, propagateIncremental, updateExistingLight } from './light-engine-helpers'

const LAVA = blockTypeToIndex('LAVA')

const withChunkService = <A>(f: (chunkService: ChunkServiceType) => Effect.Effect<A, never>): Effect.Effect<A, never> =>
  Effect.flatMap(ChunkService, (cs) => f(cs)).pipe(Effect.provide(ChunkService.Default))

describe('domain/light-engine-helpers', () => {
  it.effect('computeFreshLight returns both grids of the correct size', () =>
    withChunkService((cs) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const { skyLight, blockLight } = computeFreshLight(chunk)
        expect(skyLight.byteLength).toBe(16 * 16 * 256 / 2)
        expect(blockLight.byteLength).toBe(16 * 16 * 256 / 2)
      })
    )
  )

  it.effect('updateExistingLight reuses valid buffers and recomputes in place', () =>
    withChunkService((cs) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const first = computeFreshLight(chunk)
        chunk.skyLight = first.skyLight
        chunk.blockLight = first.blockLight

        const second = updateExistingLight(chunk)

        expect(second.skyLight).toBe(first.skyLight)
        expect(second.blockLight).toBe(first.blockLight)
      })
    )
  )

  it.effect('propagateIncremental falls back to a full recompute when light buffers are missing', () =>
    withChunkService((cs) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA

        const result = propagateIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])

        expect(result.boundary).toEqual({ nx: true, px: true, nz: true, pz: true })
        expect(getLightAt(result.blockLight, 8, 100, 8)).toBe(15)
        expect(Option.isSome(result.affectedAABB)).toBe(true)
      })
    )
  )

  it.effect('propagateIncremental ignores out-of-bounds dirty voxels', () =>
    withChunkService((cs) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const grids = computeFreshLight(chunk)
        chunk.skyLight = grids.skyLight
        chunk.blockLight = grids.blockLight

        const result = propagateIncremental(chunk, [{ lx: -1, y: 0, lz: 0 }, { lx: 0, y: 256, lz: 0 }])

        expect(result.boundary).toEqual({ nx: false, px: false, nz: false, pz: false })
        expect(Option.isNone(result.affectedAABB)).toBe(true)
      })
    )
  )

  it.effect('propagateIncremental applies a local block-light update in place', () =>
    withChunkService((cs) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const grids = computeFreshLight(chunk)
        chunk.skyLight = grids.skyLight
        chunk.blockLight = grids.blockLight
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA

        const result = propagateIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])

        expect(getLightAt(result.blockLight, 8, 100, 8)).toBe(15)
        expect(getLightAt(result.blockLight, 9, 100, 8)).toBe(14)
        expect(getLightAt(result.skyLight, 8, 255, 8)).toBe(LIGHT_LEVEL_MAX)
        expect(Option.isSome(result.affectedAABB)).toBe(true)
      })
    )
  )
})
