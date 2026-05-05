import { describe, expect, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import { blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/kernel'
import { ChunkService, ChunkServiceLive } from '@ts-minecraft/terrain'
import type { ChunkService as ChunkServiceType } from '@ts-minecraft/terrain'
import { LIGHT_LEVEL_MAX, getLightAt } from '@ts-minecraft/world-state'
import { LightEngineLive, LightEngineService } from '@ts-minecraft/terrain'

// Explicit interfaces for test-time chunk mutations
interface ChunkWithSkyLight {
  skyLight: Uint8Array
  blockLight?: Uint8Array
}
interface ChunkWithBlockLight {
  blockLight: Uint8Array
  skyLight?: Uint8Array
}

const STONE = blockTypeToIndex('STONE')
const LAVA = blockTypeToIndex('LAVA')
const REDSTONE_ORE = blockTypeToIndex('REDSTONE_ORE')

const withLightService = <A>(
  f: (chunkService: ChunkServiceType, lightService: LightEngineService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.all([ChunkService, LightEngineService]).pipe(
    Effect.flatMap(([cs, ls]) => f(cs, ls)),
    Effect.provide(Layer.mergeAll(ChunkServiceLive, LightEngineLive)),
  )

describe('application/light/light-engine-service', () => {
  it.effect('computeLight returns both grids of the correct size', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const { skyLight, blockLight } = yield* ls.computeLight(chunk)
        expect(skyLight.byteLength).toBe(16 * 16 * 256 / 2)
        expect(blockLight.byteLength).toBe(16 * 16 * 256 / 2)
      })
    )
  )

  it.effect('all-AIR chunk: sky light = 15 everywhere', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const { skyLight } = yield* ls.updateLight(chunk)
        expect(getLightAt(skyLight, 0, 0, 0)).toBe(LIGHT_LEVEL_MAX)
        expect(getLightAt(skyLight, 7, 100, 7)).toBe(LIGHT_LEVEL_MAX)
        expect(getLightAt(skyLight, 15, 255, 15)).toBe(LIGHT_LEVEL_MAX)
      })
    )
  )

  it.effect('all-STONE chunk: sky light = 0 everywhere', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks.fill(STONE)
        const { skyLight } = yield* ls.updateLight(chunk)
        expect(getLightAt(skyLight, 0, 0, 0)).toBe(0)
        expect(getLightAt(skyLight, 7, 100, 7)).toBe(0)
      })
    )
  )

  it.effect('LAVA block emits level 15 and attenuates by 1 per step in AIR', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA
        const { blockLight } = yield* ls.updateLight(chunk)
        expect(getLightAt(blockLight, 8, 100, 8)).toBe(15)
        expect(getLightAt(blockLight, 9, 100, 8)).toBe(14)
        expect(getLightAt(blockLight, 8, 100, 10)).toBe(13)
        expect(getLightAt(blockLight, 8, 100, 11)).toBe(12)
      })
    )
  )

  it.effect('REDSTONE_ORE emits level 9', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = REDSTONE_ORE
        const { blockLight } = yield* ls.updateLight(chunk)
        expect(getLightAt(blockLight, 8, 100, 8)).toBe(9)
      })
    )
  )

  it.effect('two emitters compose via max per voxel', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(2, 100, 8)] = LAVA
        chunk.blocks[blockIndexUnsafe(14, 100, 8)] = LAVA
        const { blockLight } = yield* ls.updateLight(chunk)
        expect(getLightAt(blockLight, 8, 100, 8)).toBe(9)
      })
    )
  )

  it.effect('sky light blocked by a STONE column: under = 0 lateral-side = 15', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        Arr.forEach(Arr.makeBy(256, i => i), (y) => {
          chunk.blocks[blockIndexUnsafe(8, y, 8)] = STONE
        })
        const { skyLight, blockLight } = yield* ls.updateLight(chunk)
        expect(getLightAt(blockLight, 8, 0, 8)).toBe(0)
        expect(getLightAt(skyLight, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
      })
    )
  )

  it.effect('getSkyLight before updateLight defaults to 15; getBlockLight defaults to 0', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        expect(chunk.skyLight).toBeUndefined()
        expect(ls.getSkyLight(chunk, 5, 5, 5)).toBe(15)
        expect(ls.getBlockLight(chunk, 5, 5, 5)).toBe(0)
      })
    )
  )

  it.effect('updateLight returns valid grids of correct size without mutating the chunk', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const grids = yield* ls.updateLight(chunk)
        expect(grids.skyLight).toBeDefined()
        expect(grids.blockLight).toBeDefined()
        expect(grids.skyLight.byteLength).toBe(16 * 16 * 256 / 2)
        expect(grids.blockLight.byteLength).toBe(16 * 16 * 256 / 2)
        expect(chunk.skyLight).toBeUndefined()
        expect(chunk.blockLight).toBeUndefined()
      })
    )
  )

  it.effect('getSkyLight returns 0 for out-of-bounds coordinates', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        yield* ls.updateLight(chunk)
        expect(ls.getSkyLight(chunk, -1, 0, 0)).toBe(0)
        expect(ls.getSkyLight(chunk, 16, 0, 0)).toBe(0)
        expect(ls.getSkyLight(chunk, 0, -1, 0)).toBe(0)
        expect(ls.getSkyLight(chunk, 0, 256, 0)).toBe(0)
        expect(ls.getSkyLight(chunk, 0, 0, -1)).toBe(0)
        expect(ls.getSkyLight(chunk, 0, 0, 16)).toBe(0)
      })
    )
  )

  it.effect('getBlockLight returns 0 for out-of-bounds coordinates', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA
        yield* ls.updateLight(chunk)
        expect(ls.getBlockLight(chunk, -1, 100, 8)).toBe(0)
        expect(ls.getBlockLight(chunk, 16, 100, 8)).toBe(0)
        expect(ls.getBlockLight(chunk, 8, -1, 8)).toBe(0)
        expect(ls.getBlockLight(chunk, 8, 256, 8)).toBe(0)
        expect(ls.getBlockLight(chunk, 8, 100, -1)).toBe(0)
        expect(ls.getBlockLight(chunk, 8, 100, 16)).toBe(0)
      })
    )
  )

  it.effect('updateLight reuses an existing valid-length sky buffer (lightBufferOrFresh onSome path)', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const firstGrids = yield* ls.updateLight(chunk)

        // Attach the grids so the second call sees valid-length buffers → onSome: (b) => b
        ;(chunk as ChunkWithSkyLight).skyLight = firstGrids.skyLight
        ;(chunk as ChunkWithBlockLight).blockLight = firstGrids.blockLight

        const secondGrids = yield* ls.updateLight(chunk)

        expect(secondGrids.skyLight).toBe(firstGrids.skyLight)
        expect(secondGrids.blockLight).toBe(firstGrids.blockLight)
        expect(secondGrids.skyLight.byteLength).toBe(16 * 16 * 256 / 2)
      })
    )
  )

  it.effect('updateLight discards a wrong-length existing buffer (lightBufferOrFresh filter false → onNone)', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        ;(chunk as ChunkWithSkyLight).skyLight = new Uint8Array(4)

        const grids = yield* ls.updateLight(chunk)

        expect(grids.skyLight).not.toBe((chunk as ChunkWithSkyLight).skyLight)
        expect(grids.skyLight.byteLength).toBe(16 * 16 * 256 / 2)
      })
    )
  )

  it.effect('getSkyLight reads from existing skyLight buffer (onSome path)', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const grids = yield* ls.updateLight(chunk)
        // Attach the computed grid so getSkyLight hits the onSome: (grid) => getLightAt path
        ;(chunk as ChunkWithSkyLight).skyLight = grids.skyLight
        // All-AIR chunk: sky light at top is max (15)
        const level = ls.getSkyLight(chunk, 0, 255, 0)
        expect(level).toBe(15)
      })
    )
  )

  it.effect('getBlockLight reads from existing blockLight buffer (onSome path)', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA
        const grids = yield* ls.updateLight(chunk)
        // Attach the computed grid so getBlockLight hits the onSome: (grid) => getLightAt path
        ;(chunk as ChunkWithBlockLight).blockLight = grids.blockLight
        const level = ls.getBlockLight(chunk, 8, 100, 8)
        expect(level).toBe(15)
      })
    )
  )
})
