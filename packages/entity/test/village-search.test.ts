import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  findClosestVillagerInRange,
  findNearestVillage,
  findStructureAnchor,
} from '@ts-minecraft/entity/domain/village/village-search'
import type { Village, Villager, VillageStructure } from '@ts-minecraft/entity/domain/village/village-model'
import type { Position } from '@ts-minecraft/core'

// ─── helpers ─────────────────────────────────────────────────────────────────

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })

const makeVillager = (id: string, x: number, z: number): Villager =>
  ({ villagerId: id, position: pos(x, 64, z) }) as unknown as Villager

const makeVillage = (id: string, x: number, z: number): Village =>
  ({ villageId: id, center: pos(x, 64, z) }) as unknown as Village

const makeStructure = (id: string, anchorX: number, anchorZ: number): VillageStructure =>
  ({ structureId: id, anchor: pos(anchorX, 64, anchorZ) }) as unknown as VillageStructure

const origin = pos(0, 64, 0)

// ─── findClosestVillagerInRange ───────────────────────────────────────────────
describe('findClosestVillagerInRange', () => {
  it('returns Option.none() for an empty villager list', () => {
    const result = findClosestVillagerInRange([], origin, 100)
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns Option.none() when the only villager is out of range', () => {
    const result = findClosestVillagerInRange([makeVillager('a', 50, 0)], origin, 9)
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns the villager when they are within range', () => {
    const villager = makeVillager('a', 3, 0)
    const result = findClosestVillagerInRange([villager], origin, 100)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(villager)
  })

  it('returns the closest villager when multiple are in range', () => {
    const near = makeVillager('near', 2, 0)
    const mid = makeVillager('mid', 5, 0)
    const result = findClosestVillagerInRange([mid, near], origin, 100)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(near)
  })

  it('returns Option.none() when all villagers exceed maxDistanceSq', () => {
    // villager at distance 10 → dSq = 100; maxDistanceSq = 99
    const result = findClosestVillagerInRange([makeVillager('a', 10, 0)], origin, 99)
    expect(Option.isNone(result)).toBe(true)
  })

  it('includes a villager at exactly the boundary distance (≤ inclusive)', () => {
    // villager at (3,64,4) → dSq = 9+0+16 = 25; maxDistanceSq = 25
    const result = findClosestVillagerInRange([makeVillager('a', 3, 4)], origin, 25)
    expect(Option.isSome(result)).toBe(true)
  })

  it('ignores villagers farther than the current closest candidate', () => {
    const close = makeVillager('close', 1, 0)
    const farOut = makeVillager('far', 100, 0)
    const result = findClosestVillagerInRange([farOut, close], origin, 10000)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(close)
  })
})

// ─── findNearestVillage ───────────────────────────────────────────────────────
describe('findNearestVillage', () => {
  it('returns Option.none() for an empty village list', () => {
    const result = findNearestVillage([], origin)
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns the only village when the list has one entry', () => {
    const village = makeVillage('v1', 50, 0)
    const result = findNearestVillage([village], origin)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(village)
  })

  it('returns the nearest village by distance', () => {
    const near = makeVillage('near', 10, 0)
    const far = makeVillage('far', 100, 0)
    const result = findNearestVillage([far, near], origin)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(near)
  })

  it('has no range cutoff — returns nearest even very far away', () => {
    const distant = makeVillage('distant', 10000, 0)
    const result = findNearestVillage([distant], origin)
    expect(Option.isSome(result)).toBe(true)
  })

  it('picks the first entry among ties (deterministic scan order)', () => {
    const a = makeVillage('a', 5, 0)
    const b = makeVillage('b', -5, 0)
    const result = findNearestVillage([a, b], origin)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(a)
  })
})

// ─── findStructureAnchor ──────────────────────────────────────────────────────
describe('findStructureAnchor', () => {
  it('returns Option.none() for an empty structure list', () => {
    const result = findStructureAnchor([], 'well-1' as VillageStructure['structureId'])
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns Option.none() when the target structureId is absent', () => {
    const structures = [makeStructure('house-1', 10, 20)]
    const result = findStructureAnchor(structures, 'well-1' as VillageStructure['structureId'])
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns the anchor for a matching structureId', () => {
    const structures = [makeStructure('well-1', 15, 30)]
    const result = findStructureAnchor(structures, 'well-1' as VillageStructure['structureId'])
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.x).toBe(15)
      expect(result.value.z).toBe(30)
    }
  })

  it('returns the first matching anchor when multiple structures share the same id', () => {
    const structures = [makeStructure('road-1', 5, 0), makeStructure('road-1', 99, 0)]
    const result = findStructureAnchor(structures, 'road-1' as VillageStructure['structureId'])
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value.x).toBe(5)
  })

  it('correctly identifies the matching structure among several different ones', () => {
    const structures = [
      makeStructure('house-1', 1, 0),
      makeStructure('farm-1', 2, 0),
      makeStructure('well-1', 3, 0),
    ]
    const result = findStructureAnchor(structures, 'farm-1' as VillageStructure['structureId'])
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value.x).toBe(2)
  })
})
