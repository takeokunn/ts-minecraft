import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Ref } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { VillageStructureId } from '@ts-minecraft/entity/domain/village/village-model';
import { chunkBlockIndexUnchecked, type Chunk } from '@ts-minecraft/world'
import { runVillageMaintenance } from '../../application/village/village-maintenance'
import {
  placeVillageStructures,
} from '../../application/village/village-placement'
import { type VillagePlacementServices } from '../../application/village/village-placement-services'
import { VillagePlacementBlockReadError } from '../../application/village/village-placement-surface-error'
import { makeTestChunk, makeTestVillage } from './test-utils'

const setBlock = (
  blocks: Uint8Array,
  localX: number,
  y: number,
  localZ: number,
  blockType: Parameters<typeof blockTypeToIndex>[0],
) => {
  blocks[chunkBlockIndexUnchecked(localX, y, localZ)] = blockTypeToIndex(blockType)
}

const makePlacementServices = (
  getChunk: VillagePlacementServices['chunkManagerService']['getChunk'],
  forceSetBlock: VillagePlacementServices['blockService']['forceSetBlock'],
): VillagePlacementServices => ({
  chunkManagerService: { getChunk },
  blockService: { forceSetBlock },
})

const makeRoadVillage = (
  structureId: string,
  anchor: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
) =>
  makeTestVillage({
    structures: [{
      structureId: VillageStructureId.make(structureId),
      type: 'road',
      anchor,
      size,
    }],
    villagers: [],
  })

describe('village/village-maintenance / structure placement', () => {
  it.effect('runs the maintenance plan and places only newly created villages', () =>
    Effect.gen(function* () {
      const existingVillagesRef = yield* Ref.make<ReadonlyArray<ReturnType<typeof makeTestVillage>>>([])
      const newVillage = makeRoadVillage('test-village:maintenance-road', { x: 1, y: 42, z: 2 })
      const getVillages = vi.fn(() => Ref.get(existingVillagesRef))
      const update = vi.fn(() =>
        Ref.set(existingVillagesRef, [newVillage]).pipe(Effect.asVoid),
      )
      const getChunk = vi.fn(() => Effect.succeed(makeTestChunk(new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT))))
      const forceSetBlock = vi.fn(() => Effect.void)

      yield* runVillageMaintenance(
        {
          villageService: { getVillages, update },
          chunkManagerService: { getChunk },
          blockService: { forceSetBlock },
        },
        { x: 0, y: 64, z: 0 },
        12000,
        1 / 60,
      )

      expect(getVillages).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenCalledTimes(1)
      expect(getChunk).toHaveBeenCalledTimes(1)
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 1, y: 42, z: 2 }, 'GRAVEL')
    }),
  )

  it.effect('keeps running when the village state update fails', () =>
    Effect.gen(function* () {
      const getVillages = vi.fn(() => Effect.succeed([]))
      const update = vi.fn(() => Effect.fail(new Error('maintenance exploded')))
      const getChunk = vi.fn(() => Effect.succeed(makeTestChunk(new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT))))
      const forceSetBlock = vi.fn(() => Effect.void)

      yield* runVillageMaintenance(
        {
          villageService: { getVillages, update },
          chunkManagerService: { getChunk },
          blockService: { forceSetBlock },
        },
        { x: 0, y: 64, z: 0 },
        12000,
        1 / 60,
      )

      expect(getVillages).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenCalledTimes(1)
      expect(getChunk).not.toHaveBeenCalled()
      expect(forceSetBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('grounds new structures on terrain and fills foundations under lower columns', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      setBlock(blocks, 1, 8, 2, 'STONE')
      setBlock(blocks, 1, 20, 2, 'WATER')
      setBlock(blocks, 2, 6, 2, 'STONE')
      setBlock(blocks, 2, 21, 2, 'WOOD')

      const getChunk = vi.fn(() => Effect.succeed(makeTestChunk(blocks)))
      const forceSetBlock = vi.fn(() => Effect.void)
      const village = makeRoadVillage('test-village:road', { x: 1, y: 30, z: 2 }, { x: 2, y: 1, z: 1 })

      yield* placeVillageStructures(village, makePlacementServices(getChunk, forceSetBlock))

      expect(getChunk).toHaveBeenCalledTimes(1)
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 2, y: 7, z: 2 }, 'COBBLESTONE')
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 2, y: 8, z: 2 }, 'COBBLESTONE')
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 1, y: 9, z: 2 }, 'GRAVEL')
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 2, y: 9, z: 2 }, 'GRAVEL')
    }),
  )

  it.effect('keeps the planned height when the target chunk is unavailable', () =>
    Effect.gen(function* () {
      const getChunk = vi.fn(() => Effect.fail(new Error('chunk unavailable')))
      const forceSetBlock = vi.fn(() => Effect.void)
      const village = makeRoadVillage('test-village:path', { x: 1, y: 42, z: 2 })

      yield* placeVillageStructures(village, makePlacementServices(getChunk, forceSetBlock))

      expect(getChunk).toHaveBeenCalledTimes(1)
      expect(forceSetBlock).toHaveBeenCalledOnce()
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 1, y: 42, z: 2 }, 'GRAVEL')
    }),
  )

  it.effect('keeps the planned height when the loaded chunk has no ground blocks', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const getChunk = vi.fn(() => Effect.succeed(makeTestChunk(blocks)))
      const forceSetBlock = vi.fn(() => Effect.void)
      const village = makeRoadVillage('test-village:air-column', { x: 1, y: 42, z: 2 })

      yield* placeVillageStructures(village, makePlacementServices(getChunk, forceSetBlock))

      expect(getChunk).toHaveBeenCalledTimes(1)
      expect(forceSetBlock).toHaveBeenCalledOnce()
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 1, y: 42, z: 2 }, 'GRAVEL')
    }),
  )

  it.effect('rejects loaded chunks with truncated block storage', () =>
    Effect.gen(function* () {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT - 1)
      const getChunk = vi.fn(() => Effect.succeed(makeTestChunk(blocks as Chunk['blocks'])))
      const forceSetBlock = vi.fn(() => Effect.void)
      const village = makeRoadVillage('test-village:truncated', { x: 1, y: 42, z: 2 })

      const result = yield* placeVillageStructures(village, makePlacementServices(getChunk, forceSetBlock)).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(VillagePlacementBlockReadError)
        expect(result.left.message).toContain('complete chunk block buffer')
      }
      expect(forceSetBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('rejects loaded chunks with sparse block storage', () =>
    Effect.gen(function* () {
      const blocks = { length: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT } as ArrayLike<number>
      const getChunk = vi.fn(() => Effect.succeed(makeTestChunk(blocks as Chunk['blocks'])))
      const forceSetBlock = vi.fn(() => Effect.void)
      const village = makeRoadVillage('test-village:sparse', { x: 1, y: 42, z: 2 })

      const result = yield* placeVillageStructures(village, makePlacementServices(getChunk, forceSetBlock)).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(VillagePlacementBlockReadError)
        expect(result.left.message).toContain('no value at index')
      }
      expect(forceSetBlock).not.toHaveBeenCalled()
    }),
  )
})
