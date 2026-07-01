import { describe, expect, it } from 'vitest'
import {
  INITIAL_VILLAGE_STATE,
  flattenVillagers,
} from '@ts-minecraft/entity/domain/village/village-state'
import type { Village, Villager } from '@ts-minecraft/entity/domain/village/village-model'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeVillager = (id: string): Villager =>
  ({ villagerId: id }) as unknown as Villager

const makeVillage = (id: string, villagers: Villager[]): Village =>
  ({ villageId: id, villagers }) as unknown as Village

// ─── INITIAL_VILLAGE_STATE ────────────────────────────────────────────────────
describe('INITIAL_VILLAGE_STATE', () => {
  it('starts with an empty villages array', () => {
    expect(INITIAL_VILLAGE_STATE.villages).toHaveLength(0)
  })

  it('starts with nextVillageNumber = 1', () => {
    expect(INITIAL_VILLAGE_STATE.nextVillageNumber).toBe(1)
  })

  it('starts with updateTick = 0', () => {
    expect(INITIAL_VILLAGE_STATE.updateTick).toBe(0)
  })
})

// ─── flattenVillagers ─────────────────────────────────────────────────────────
describe('flattenVillagers', () => {
  it('returns an empty array for zero villages', () => {
    expect(flattenVillagers([])).toHaveLength(0)
  })

  it('returns an empty array for a village with no villagers', () => {
    const village = makeVillage('v1', [])
    expect(flattenVillagers([village])).toHaveLength(0)
  })

  it('returns the villagers from a single village', () => {
    const va = makeVillager('a')
    const vb = makeVillager('b')
    const village = makeVillage('v1', [va, vb])
    const result = flattenVillagers([village])
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(va)
    expect(result[1]).toBe(vb)
  })

  it('concatenates villagers from multiple villages in order', () => {
    const v1 = makeVillage('v1', [makeVillager('a'), makeVillager('b')])
    const v2 = makeVillage('v2', [makeVillager('c')])
    const result = flattenVillagers([v1, v2])
    expect(result).toHaveLength(3)
    const ids = (result as Villager[]).map((v) => v.villagerId as string)
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('handles mixed empty and non-empty villages', () => {
    const empty = makeVillage('v1', [])
    const full = makeVillage('v2', [makeVillager('x'), makeVillager('y')])
    const result = flattenVillagers([empty, full])
    expect(result).toHaveLength(2)
  })

  it('returns a flat array (no nesting) regardless of village count', () => {
    const villages = Array.from({ length: 5 }, (_, i) =>
      makeVillage(`v${i}`, [makeVillager(`villager-${i}`)])
    )
    const result = flattenVillagers(villages)
    expect(result).toHaveLength(5)
    expect(Array.isArray(result[0])).toBe(false)
  })
})
