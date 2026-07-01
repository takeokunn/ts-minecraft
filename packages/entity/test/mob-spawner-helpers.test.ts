import { describe, expect, it } from 'vitest'
import {
  getSpawnPosition,
  selectMobType,
} from '@ts-minecraft/entity/application/mob/mob-spawner-helpers'
import { MIN_SPAWN_DISTANCE } from '@ts-minecraft/entity/domain/mob/spawner-config'
import { PASSIVE_MOBS, HOSTILE_MOBS } from '@ts-minecraft/entity/domain/mob/mob-categories'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import type { Position } from '@ts-minecraft/core'

// ─── helpers ─────────────────────────────────────────────────────────────────

const origin: Position = { x: 0, y: 64, z: 0 }

// ─── getSpawnPosition ─────────────────────────────────────────────────────────
describe('getSpawnPosition', () => {
  it('preserves the player y-coordinate', () => {
    const result = getSpawnPosition(origin, 0)
    expect(result.y).toBe(origin.y)
  })

  it('cursor=0 produces a point due east at MIN_SPAWN_DISTANCE (angle=0 → cos=1, sin=0)', () => {
    const result = getSpawnPosition(origin, 0)
    expect(result.x).toBeCloseTo(MIN_SPAWN_DISTANCE)
    expect(result.z).toBeCloseTo(0)
  })

  it('cursor=4 produces a point due north at MIN_SPAWN_DISTANCE (angle=π/2 → cos≈0, sin≈1)', () => {
    // cursor % 16 = 4 → angle = 4/16 * 2π = π/2
    // cursor % 4 = 0 → distance = MIN_SPAWN_DISTANCE
    const result = getSpawnPosition(origin, 4)
    expect(result.x).toBeCloseTo(0, 5)
    expect(result.z).toBeCloseTo(MIN_SPAWN_DISTANCE)
  })

  it('cursor%4=1 adds 8 blocks to the base distance', () => {
    // cursor=1: distance = MIN_SPAWN_DISTANCE + 1*8 = 24
    const result = getSpawnPosition(origin, 1)
    const expectedDistance = MIN_SPAWN_DISTANCE + 8
    const actualDistance = Math.hypot(result.x - origin.x, result.z - origin.z)
    expect(actualDistance).toBeCloseTo(expectedDistance)
  })

  it('cursor%4=3 is the farthest spawn band (MIN + 3*8 blocks)', () => {
    const result = getSpawnPosition(origin, 3)
    const expectedDistance = MIN_SPAWN_DISTANCE + 24
    const actualDistance = Math.hypot(result.x - origin.x, result.z - origin.z)
    expect(actualDistance).toBeCloseTo(expectedDistance)
  })

  it('cursor=16 wraps angle back to 0 (same direction as cursor=0)', () => {
    const r0 = getSpawnPosition(origin, 0)
    const r16 = getSpawnPosition(origin, 16)
    // cursor=16: angle same, distance same (16%4=0)
    expect(r16.x).toBeCloseTo(r0.x)
    expect(r16.z).toBeCloseTo(r0.z)
  })

  it('works with a non-origin player position (offsets applied correctly)', () => {
    const player: Position = { x: 100, y: 70, z: -200 }
    const result = getSpawnPosition(player, 0)
    expect(result.y).toBe(70)
    expect(result.x).toBeCloseTo(100 + MIN_SPAWN_DISTANCE)
    expect(result.z).toBeCloseTo(-200, 5)
  })

  it('produces 16 distinct angle directions across cursor 0..15', () => {
    const angles = Array.from({ length: 16 }, (_, i) => {
      const r = getSpawnPosition(origin, i)
      return Math.atan2(r.z - origin.z, r.x - origin.x)
    })
    const unique = new Set(angles.map((a) => a.toFixed(6)))
    expect(unique.size).toBe(16)
  })
})

// ─── selectMobType ─────────────────────────────────────────────────────────
describe('selectMobType', () => {
  it('returns a hostile mob at night for cursor=0', () => {
    const result = selectMobType(true, 0)
    expect(result).toBe(HOSTILE_MOBS[0])
  })

  it('returns a hostile mob at night for cursor=1', () => {
    expect(selectMobType(true, 1)).toBe(HOSTILE_MOBS[1])
  })

  it('cycles through all hostile mob types at night', () => {
    const types = HOSTILE_MOBS.map((_, i) => selectMobType(true, i))
    for (let i = 0; i < HOSTILE_MOBS.length; i++) {
      expect(types[i]).toBe(HOSTILE_MOBS[i])
    }
  })

  it('wraps night cursor at HOSTILE_MOBS.length', () => {
    const first = selectMobType(true, 0)
    const wrapped = selectMobType(true, HOSTILE_MOBS.length)
    expect(wrapped).toBe(first)
  })

  it('returns a passive mob during the day for cursor=0', () => {
    expect(selectMobType(false, 0)).toBe(PASSIVE_MOBS[0])
  })

  it('returns a passive mob during the day for cursor=1', () => {
    expect(selectMobType(false, 1)).toBe(PASSIVE_MOBS[1])
  })

  it('cycles through all passive mob types during the day', () => {
    for (let i = 0; i < PASSIVE_MOBS.length; i++) {
      expect(selectMobType(false, i)).toBe(PASSIVE_MOBS[i])
    }
  })

  it('wraps day cursor at PASSIVE_MOBS.length', () => {
    const first = selectMobType(false, 0)
    const wrapped = selectMobType(false, PASSIVE_MOBS.length)
    expect(wrapped).toBe(first)
  })

  it('returns EntityType.Zombie as night default (first hostile mob)', () => {
    expect(selectMobType(true, 0)).toBe(EntityType.Zombie)
  })

  it('returns EntityType.Cow as day default (first passive mob)', () => {
    expect(selectMobType(false, 0)).toBe(EntityType.Cow)
  })
})
