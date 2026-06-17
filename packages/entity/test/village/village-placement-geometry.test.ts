import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { VillageStructureId } from '@ts-minecraft/entity'
import {
  collectStructureFootprintCells,
  groundVillageStructure,
} from '../../domain/village'
import { makeTestVillageStructure } from './test-utils'

describe('village/village-placement-geometry', () => {
  it('grounds a structure to the first solid block above the surface', () => {
    const structure = makeTestVillageStructure({
      structureId: VillageStructureId.make('test-village:grounded'),
      anchor: { x: 1, y: 30, z: 2 },
    })

    expect(groundVillageStructure(structure, 8)).toEqual({
      ...structure,
      anchor: { x: 1, y: 9, z: 2 },
    })
  })

  it('leaves a floating structure unchanged', () => {
    const structure = makeTestVillageStructure({
      structureId: VillageStructureId.make('test-village:floating'),
      anchor: { x: 4, y: 30, z: 5 },
    })

    expect(groundVillageStructure(structure, -1)).toBe(structure)
  })

  it('collects all footprint cells in anchor-relative order', () => {
    const structure = makeTestVillageStructure({
      anchor: { x: 10, y: 64, z: 20 },
      size: { x: 2, y: 3, z: 2 },
    })

    expect(collectStructureFootprintCells(structure)).toEqual([
      { x: 10, z: 20 },
      { x: 10, z: 21 },
      { x: 11, z: 20 },
      { x: 11, z: 21 },
    ])
  })
})
