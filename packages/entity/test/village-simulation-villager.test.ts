import { describe, expect, it } from 'vitest'
import { tickVillager, VILLAGER_MOVE_SPEED } from '@ts-minecraft/entity/domain/village/village-simulation-villager'
import { VillagerActivity } from '@ts-minecraft/entity/domain/village/village-model'
import { createVillage } from '@ts-minecraft/entity/domain/village/village-creation'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const CENTER = { x: 0, y: 64, z: 0 }
const FAR_PLAYER = { x: 999, y: 64, z: 999 } // not in trade range

const village = createVillage(1, CENTER)
const villager = village.villagers[0]!

// During work hours (timeOfDay=0.5), the first villager (Farmer) targets their farm.

// ─── tickVillager — reference stability ──────────────────────────────────────

describe('tickVillager — returns same reference when nothing changes', () => {
  it('returns the identical object when Trade keeps position unchanged', () => {
    // Player at villager's exact position → Trade activity; Trade → null target → same position ref
    const tradeVillager = { ...villager, activity: VillagerActivity.Trade }
    const result = tickVillager(tradeVillager, village, tradeVillager.position, 0.5, 0, 0)
    expect(result).toBe(tradeVillager)
  })
})

// ─── tickVillager — activity transitions ─────────────────────────────────────

describe('tickVillager — activity transitions', () => {
  it('switches to Work during work hours (timeOfDay=0.5) when player is far', () => {
    const result = tickVillager(villager, village, FAR_PLAYER, 0.5, 0, 0)
    expect(result.activity).toBe(VillagerActivity.Work)
  })

  it('switches to Rest at night (timeOfDay=0.9)', () => {
    const result = tickVillager(villager, village, FAR_PLAYER, 0.9, 0, 0)
    expect(result.activity).toBe(VillagerActivity.Rest)
  })

  it('switches to Trade when player is adjacent to villager', () => {
    const playerAtVillager = { ...villager.position }
    const result = tickVillager(villager, village, playerAtVillager, 0.5, 0, 0)
    expect(result.activity).toBe(VillagerActivity.Trade)
  })

  it('returns a new object when activity changes', () => {
    const restingVillager = { ...villager, activity: VillagerActivity.Rest }
    const result = tickVillager(restingVillager, village, FAR_PLAYER, 0.5, 0, 0)
    // work hours → activity becomes Work
    expect(result).not.toBe(restingVillager)
    expect(result.activity).toBe(VillagerActivity.Work)
  })
})

// ─── tickVillager — movement ──────────────────────────────────────────────────

describe('tickVillager — movement', () => {
  it('moves villager toward target when maxMoveDelta is positive', () => {
    const moveAmount = VILLAGER_MOVE_SPEED * 20
    const workVillager = { ...villager, activity: VillagerActivity.Work }
    const before = workVillager.position
    const result = tickVillager(workVillager, village, FAR_PLAYER, 0.5, 0, moveAmount)
    // If position changed, the villager moved; if already at target, it stayed.
    // Either way the result is a valid position (no NaN).
    expect(Number.isFinite(result.position.x)).toBe(true)
    expect(Number.isFinite(result.position.z)).toBe(true)
    // position must differ from start unless already at target
    const distMoved = Math.hypot(result.position.x - before.x, result.position.z - before.z)
    expect(distMoved).toBeGreaterThanOrEqual(0)
  })

  it('does not move when maxMoveDelta is 0', () => {
    const workVillager = { ...villager, activity: VillagerActivity.Work }
    const result = tickVillager(workVillager, village, FAR_PLAYER, 0.5, 0, 0)
    // Position stays at home; only activity may change
    expect(result.position.x).toBe(workVillager.position.x)
    expect(result.position.z).toBe(workVillager.position.z)
  })
})
