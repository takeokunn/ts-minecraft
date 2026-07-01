import { describe, expect, it } from 'vitest'
import { ensureVillageInState } from '@ts-minecraft/entity/domain/village/village-creation-resolution'
import { INITIAL_VILLAGE_STATE } from '@ts-minecraft/entity/domain/village/village-state'
import { VILLAGE_NEAR_DISTANCE } from '@ts-minecraft/entity/domain/village/village-simulation-constants'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const playerAt = (x: number, z: number) => ({ x, y: 64, z })
const CENTER = playerAt(0, 0)
const FAR = playerAt(VILLAGE_NEAR_DISTANCE * 2, VILLAGE_NEAR_DISTANCE * 2)

// ─── ensureVillageInState ─────────────────────────────────────────────────────

describe('ensureVillageInState — empty state', () => {
  it('creates a village when state has none', () => {
    const [newState] = ensureVillageInState(INITIAL_VILLAGE_STATE, CENTER)
    expect(newState.villages).toHaveLength(1)
  })

  it('increments nextVillageNumber after creation', () => {
    const [newState] = ensureVillageInState(INITIAL_VILLAGE_STATE, CENTER)
    expect(newState.nextVillageNumber).toBe(2)
  })

  it('returned village id uses the initial village number', () => {
    const [, village] = ensureVillageInState(INITIAL_VILLAGE_STATE, CENTER)
    expect(String(village.villageId)).toBe('village-1')
  })
})

describe('ensureVillageInState — existing nearby village', () => {
  const [stateWithOne, firstVillage] = ensureVillageInState(INITIAL_VILLAGE_STATE, CENTER)

  it('returns the existing village when player is within VILLAGE_NEAR_DISTANCE', () => {
    const [, found] = ensureVillageInState(stateWithOne, CENTER)
    expect(String(found.villageId)).toBe(String(firstVillage.villageId))
  })

  it('does not add another village when one is nearby', () => {
    const [same] = ensureVillageInState(stateWithOne, CENTER)
    expect(same.villages).toHaveLength(1)
  })

  it('does not change nextVillageNumber when returning existing village', () => {
    const [same] = ensureVillageInState(stateWithOne, CENTER)
    expect(same.nextVillageNumber).toBe(stateWithOne.nextVillageNumber)
  })
})

describe('ensureVillageInState — far player creates second village', () => {
  const [stateWithOne] = ensureVillageInState(INITIAL_VILLAGE_STATE, CENTER)

  it('adds a second village when player is far from all existing villages', () => {
    const [twoVillage] = ensureVillageInState(stateWithOne, FAR)
    expect(twoVillage.villages).toHaveLength(2)
  })

  it('increments nextVillageNumber for the second village', () => {
    const [twoVillage] = ensureVillageInState(stateWithOne, FAR)
    expect(twoVillage.nextVillageNumber).toBe(3)
  })

  it('preserves the existing village in the villages array', () => {
    const [twoVillage, second] = ensureVillageInState(stateWithOne, FAR)
    expect(String(second.villageId)).toBe('village-2')
    expect(twoVillage.villages[0]!.villageId).toBe(stateWithOne.villages[0]!.villageId)
  })
})
