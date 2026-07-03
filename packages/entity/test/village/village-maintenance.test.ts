import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Ref } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { VillageStructureId } from '@ts-minecraft/entity/domain/village/village-model';
import { chunkBlockIndexUnchecked, type Chunk } from '@ts-minecraft/world'
import { runVillageMaintenance, syncVillagerEntities } from '../../application/village/village-maintenance'
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
          entityManager: { getEntities: () => Effect.succeed([]), addEntity: () => Effect.succeed('e1' as never) },
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
          entityManager: { getEntities: () => Effect.succeed([]), addEntity: () => Effect.succeed('e1' as never) },
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

describe('village/village-maintenance / villager entity sync', () => {
  const villageWithVillagers = (id: string, center: { x: number; y: number; z: number }, count: number) => ({
    ...makeTestVillage({ center }),
    villagers: Array.from({ length: count }, (_, i) => ({
      villagerId: `${id}:villager-${i}`,
      profession: 'farmer',
      experience: 0,
      position: { x: center.x + i, y: center.y, z: center.z },
      activity: 'idle',
    })),
  }) as never

  it.effect('spawns one Villager entity per domain villager on an activated village', () =>
    Effect.gen(function* () {
      const added: Array<{ type: string; position: { x: number; y: number; z: number } }> = []
      const entityManager = {
        getEntities: () => Effect.succeed([]),
        addEntity: (type: never, position: never) => {
          added.push({ type, position })
          return Effect.succeed('e1' as never)
        },
      }
      const spawned = yield* syncVillagerEntities(entityManager as never, [
        villageWithVillagers('v1', { x: 100, y: 64, z: 100 }, 3),
      ])
      expect(spawned).toBe(3)
      expect(added).toHaveLength(3)
      expect(added.every((a) => a.type === 'Villager')).toBe(true)
    }),
  )

  it.effect('is idempotent — villagers already standing near the center are not respawned', () =>
    Effect.gen(function* () {
      const added: Array<string> = []
      const entityManager = {
        getEntities: () =>
          Effect.succeed([
            { type: 'Villager', position: { x: 101, y: 64, z: 100 } },
            { type: 'Villager', position: { x: 99, y: 64, z: 102 } },
            { type: 'Zombie', position: { x: 100, y: 64, z: 100 } },
          ] as never),
        addEntity: (type: never) => {
          added.push(type)
          return Effect.succeed('e1' as never)
        },
      }
      const spawned = yield* syncVillagerEntities(entityManager as never, [
        villageWithVillagers('v1', { x: 100, y: 64, z: 100 }, 2),
      ])
      expect(spawned).toBe(0)
      expect(added).toHaveLength(0)
    }),
  )
})
