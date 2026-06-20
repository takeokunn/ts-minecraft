import { describe, it, expect } from 'vitest'
import { FIRE_DAMAGE, FIRE_DAMAGE_INTERVAL_SECS, LAVA_BURN_DURATION_SECS, LAVA_DAMAGE_INTERVAL_SECS, LIGHTNING_DAMAGE, LIGHTNING_DAMAGE_INTERVAL_SECS, MAX_AIR_SECS, VOID_DAMAGE_Y } from '@ts-minecraft/entity/domain/environment-hazard.config'
import { accrueHazardTicks, isSuffocatingBlock, nextAirSecs } from '@ts-minecraft/entity/domain/environment-hazard-resolution'

describe('accrueHazardTicks', () => {
  it('emits no tick until the interval elapses', () => {
    const r = accrueHazardTicks(0, 0.2, LAVA_DAMAGE_INTERVAL_SECS)
    expect(r.ticks).toBe(0)
    expect(r.acc).toBeCloseTo(0.2)
  })

  it('emits one tick exactly at the interval and carries the remainder', () => {
    const r = accrueHazardTicks(0.4, 0.2, LAVA_DAMAGE_INTERVAL_SECS) // 0.6 total, interval 0.5
    expect(r.ticks).toBe(1)
    expect(r.acc).toBeCloseTo(0.1)
  })

  it('emits multiple ticks for a large dt (low-fps frame), frame-rate independent', () => {
    const r = accrueHazardTicks(0, 1.6, LAVA_DAMAGE_INTERVAL_SECS) // 3.2 intervals
    expect(r.ticks).toBe(3)
    expect(r.acc).toBeCloseTo(0.1)
  })
})

describe('nextAirSecs', () => {
  it('refills instantly to MAX when the head is not submerged', () => {
    expect(nextAirSecs(2, false, 0.1)).toBe(MAX_AIR_SECS)
  })

  it('drains by dt while submerged', () => {
    expect(nextAirSecs(10, true, 0.5)).toBeCloseTo(9.5)
  })

  it('clamps at 0 (never negative)', () => {
    expect(nextAirSecs(0.1, true, 0.5)).toBe(0)
  })

  it('RESPIRATION: refills to effectiveMax when surfacing (larger than default)', () => {
    const effectiveMax = MAX_AIR_SECS + 15 // RESPIRATION I
    expect(nextAirSecs(2, false, 0.1, effectiveMax)).toBe(effectiveMax)
  })

  it('RESPIRATION: drains from extended max at same rate', () => {
    const effectiveMax = MAX_AIR_SECS + 30 // RESPIRATION II
    expect(nextAirSecs(effectiveMax, true, 1)).toBeCloseTo(effectiveMax - 1)
  })
})

describe('isSuffocatingBlock', () => {
  it('treats null, air, liquids, and known non-solid utility blocks as non-suffocating', () => {
    expect(isSuffocatingBlock(null)).toBe(false)
    expect(isSuffocatingBlock('AIR')).toBe(false)
    expect(isSuffocatingBlock('WATER')).toBe(false)
    expect(isSuffocatingBlock('LAVA')).toBe(false)
    expect(isSuffocatingBlock('TORCH')).toBe(false)
    expect(isSuffocatingBlock('GLASS')).toBe(false)
    expect(isSuffocatingBlock('LEAVES')).toBe(false)
    expect(isSuffocatingBlock('DOOR')).toBe(false)
    expect(isSuffocatingBlock('DOOR_OPEN')).toBe(false)
    expect(isSuffocatingBlock('LADDER')).toBe(false)
    expect(isSuffocatingBlock('COBWEB')).toBe(false)
    expect(isSuffocatingBlock('PRESSURE_PLATE')).toBe(false)
    expect(isSuffocatingBlock('STONE_SLAB')).toBe(false)
    expect(isSuffocatingBlock('OAK_STAIRS')).toBe(false)
    expect(isSuffocatingBlock('SAPLING')).toBe(false)
    expect(isSuffocatingBlock('DANDELION')).toBe(false)
    expect(isSuffocatingBlock('POPPY')).toBe(false)
    expect(isSuffocatingBlock('BROWN_MUSHROOM')).toBe(false)
    expect(isSuffocatingBlock('RED_MUSHROOM')).toBe(false)
    expect(isSuffocatingBlock('TALL_GRASS')).toBe(false)
    expect(isSuffocatingBlock('FERN')).toBe(false)
    expect(isSuffocatingBlock('CACTUS')).toBe(false)
  })

  it('treats full solid blocks as suffocating', () => {
    expect(isSuffocatingBlock('STONE')).toBe(true)
    expect(isSuffocatingBlock('DIRT')).toBe(true)
    expect(isSuffocatingBlock('OBSIDIAN')).toBe(true)
  })
})

describe('void damage constants', () => {
  it('uses the vanilla-style below-world threshold', () => {
    expect(VOID_DAMAGE_Y).toBe(-64)
  })
})

describe('lava afterburn constants', () => {
  it('uses a short post-lava burn window with one-second fire ticks', () => {
    expect(LAVA_BURN_DURATION_SECS).toBe(8)
    expect(FIRE_DAMAGE).toBe(1)
    expect(FIRE_DAMAGE_INTERVAL_SECS).toBe(1)
  })
})

describe('lightning damage constants', () => {
  it('uses vanilla direct-strike damage with one-second cadence', () => {
    expect(LIGHTNING_DAMAGE).toBe(5)
    expect(LIGHTNING_DAMAGE_INTERVAL_SECS).toBe(1)
  })
})
