import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'
import { VillageStructureId } from '@ts-minecraft/entity/domain/village/village-model';
import { makeTestVillage, makeTestVillageStructure } from './test-utils'
import {
  buildVillageFoundationPlacements,
  groundVillageStructures,
} from '../../application/village/village-placement-plan'
import { buildFoundationPlacementsFromFootprint } from '../../application/village/village-placement-foundation'
import { type VillageBlockPlacement } from '../../application/village/village-placement-foundation-types'
import { type VillageSurfaceResolver } from '../../application/village/village-placement-surface'

const makeSurfaceResolver = (heights: Record<string, number>): VillageSurfaceResolver =>
  vi.fn((wx: number, wz: number) =>
    Effect.succeed(heights[`${wx},${wz}`] ?? -1),
  )

describe('village/village-placement.plan', () => {
  it.effect('grounds structures to the first solid block above the surface', () =>
    Effect.gen(function* () {
      const village = makeTestVillage({
        structures: [
          makeTestVillageStructure({
            structureId: VillageStructureId.make('test-village:grounded'),
            anchor: { x: 1, y: 30, z: 2 },
          }),
          makeTestVillageStructure({
            structureId: VillageStructureId.make('test-village:floating'),
            anchor: { x: 4, y: 30, z: 5 },
          }),
        ],
        villagers: [],
      })
      const surfaceAt = makeSurfaceResolver({
        '1,2': 8,
      })

      const groundedStructures = yield* groundVillageStructures(village, surfaceAt)

      expect(groundedStructures).toEqual([
        expect.objectContaining({
          structureId: VillageStructureId.make('test-village:grounded'),
          anchor: { x: 1, y: 9, z: 2 },
        }),
        expect.objectContaining({
          structureId: VillageStructureId.make('test-village:floating'),
          anchor: { x: 4, y: 30, z: 5 },
        }),
      ])
      expect(surfaceAt).toHaveBeenCalledWith(1, 2)
      expect(surfaceAt).toHaveBeenCalledWith(4, 5)
    }),
  )

  it.effect('caps foundation depth while filling below grounded structures', () =>
    Effect.sync(() => {
      const placements = buildFoundationPlacementsFromFootprint([
        { x: 1, z: 2, surfaceY: 8 },
        { x: 2, z: 2, surfaceY: 6 },
      ], 30)

      expect(placements).toHaveLength(24)
      expect(placements.every((placement: VillageBlockPlacement) => placement.blockType === 'COBBLESTONE')).toBe(true)
      expect(placements).toEqual(expect.arrayContaining([
        { position: { x: 1, y: 18, z: 2 }, blockType: 'COBBLESTONE' },
        { position: { x: 1, y: 29, z: 2 }, blockType: 'COBBLESTONE' },
        { position: { x: 2, y: 18, z: 2 }, blockType: 'COBBLESTONE' },
        { position: { x: 2, y: 29, z: 2 }, blockType: 'COBBLESTONE' },
      ]))
    }),
  )

  it.effect('builds foundation placements from grounded structures through the effectful surface resolver', () =>
    Effect.gen(function* () {
      const groundedStructures = [
        makeTestVillageStructure({
          structureId: VillageStructureId.make('test-village:road'),
          anchor: { x: 1, y: 30, z: 2 },
          size: { x: 2, y: 1, z: 1 },
        }),
      ]
      const surfaceAt = makeSurfaceResolver({
        '1,2': 8,
        '2,2': 6,
      })

      const placements = yield* buildVillageFoundationPlacements(groundedStructures, surfaceAt)

      expect(placements).toHaveLength(24)
      expect(placements.every((placement: VillageBlockPlacement) => placement.blockType === 'COBBLESTONE')).toBe(true)
      expect(placements).toEqual(expect.arrayContaining([
        { position: { x: 1, y: 18, z: 2 }, blockType: 'COBBLESTONE' },
        { position: { x: 1, y: 29, z: 2 }, blockType: 'COBBLESTONE' },
        { position: { x: 2, y: 18, z: 2 }, blockType: 'COBBLESTONE' },
        { position: { x: 2, y: 29, z: 2 }, blockType: 'COBBLESTONE' },
      ]))
    }),
  )
})
