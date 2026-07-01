import { describe, expect, it } from 'vitest'
import {
  collectStructureFootprintCells,
  groundVillageStructure,
  snapVillageCenter,
} from '@ts-minecraft/entity/domain/village/village-placement-geometry'
import type { VillageStructure } from '@ts-minecraft/entity/domain/village/village-model'
import { VillageStructureId } from '@ts-minecraft/entity/domain/village/village-model'

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeStructure = (
  ax: number,
  ay: number,
  az: number,
  sx = 3,
  sz = 3,
): VillageStructure => ({
  structureId: VillageStructureId.make('s1'),
  type: 'house',
  anchor: { x: ax, y: ay, z: az },
  size: { x: sx, y: 4, z: sz },
})

// ─── groundVillageStructure ───────────────────────────────────────────────────
describe('groundVillageStructure', () => {
  it('sets anchor.y to groundY + 1 when groundY >= 0', () => {
    const s = makeStructure(10, 64, 10)
    const result = groundVillageStructure(s, 60)
    expect(result.anchor.y).toBe(61)
  })

  it('returns structure unchanged when groundY is negative', () => {
    const s = makeStructure(10, 64, 10)
    const result = groundVillageStructure(s, -1)
    expect(result).toBe(s)
  })

  it('preserves anchor x and z when grounding', () => {
    const s = makeStructure(5, 70, 15)
    const result = groundVillageStructure(s, 55)
    expect(result.anchor.x).toBe(5)
    expect(result.anchor.z).toBe(15)
  })

  it('does not mutate the original structure', () => {
    const s = makeStructure(0, 64, 0)
    groundVillageStructure(s, 50)
    expect(s.anchor.y).toBe(64)
  })
})

// ─── snapVillageCenter ────────────────────────────────────────────────────────
describe('snapVillageCenter', () => {
  it('snaps x and z to the nearest 96-grid cell centre (+ 48)', () => {
    const result = snapVillageCenter({ x: 0, y: 64, z: 0 })
    expect(result.x).toBe(48)
    expect(result.z).toBe(48)
  })

  it('rounds y up to 64 when below sea level', () => {
    const result = snapVillageCenter({ x: 0, y: 30, z: 0 })
    expect(result.y).toBe(64)
  })

  it('keeps y unchanged when already >= 64', () => {
    const result = snapVillageCenter({ x: 0, y: 80, z: 0 })
    expect(result.y).toBe(80)
  })

  it('snaps x for negative world coordinates', () => {
    // -96 + 48 = -48
    const result = snapVillageCenter({ x: -50, y: 64, z: 0 })
    expect(result.x).toBe(-48)
  })
})

// ─── collectStructureFootprintCells ──────────────────────────────────────────
describe('collectStructureFootprintCells', () => {
  it('returns sizeX * sizeZ cells', () => {
    const s = makeStructure(0, 64, 0, 3, 4)
    expect(collectStructureFootprintCells(s)).toHaveLength(12)
  })

  it('cell coordinates are offset from anchor', () => {
    const s = makeStructure(10, 64, 20, 2, 2)
    const cells = collectStructureFootprintCells(s)
    expect(cells).toContainEqual({ x: 10, z: 20 })
    expect(cells).toContainEqual({ x: 11, z: 20 })
    expect(cells).toContainEqual({ x: 10, z: 21 })
    expect(cells).toContainEqual({ x: 11, z: 21 })
  })

  it('returns an empty array for a 0×0 structure', () => {
    const s = { ...makeStructure(0, 64, 0), size: { x: 0, y: 4, z: 0 } }
    expect(collectStructureFootprintCells(s as any)).toHaveLength(0)
  })
})
