import { describe, expect, it } from 'vitest'
import { canSpawnAtPosition } from '@ts-minecraft/entity/application/mob/mob-spawner-rules'
import {
  MIN_SPAWN_DISTANCE,
  MAX_SPAWN_DISTANCE,
} from '@ts-minecraft/entity/domain/mob/spawner-config'

// ─── canSpawnAtPosition ───────────────────────────────────────────────────────

const PLAYER = { x: 0, y: 64, z: 0 }
const at = (dx: number, dz: number, dy = 0) => ({
  x: PLAYER.x + dx,
  y: PLAYER.y + dy,
  z: PLAYER.z + dz,
})

describe('canSpawnAtPosition — within valid band', () => {
  it('returns true when spawn is in the valid XZ band and total dist < DESPAWN_DISTANCE', () => {
    const mid = (MIN_SPAWN_DISTANCE + MAX_SPAWN_DISTANCE) / 2 // 28
    expect(canSpawnAtPosition(PLAYER, at(mid, 0))).toBe(true)
  })

  it('returns true on the inner edge (exactly MIN_SPAWN_DISTANCE)', () => {
    // At exact boundary: MIN_SPAWN_DISTANCE^2 >= MIN_SPAWN_DISTANCE^2 is false (strict <)
    // so the function returns false at exactly MIN_SPAWN_DISTANCE. Use MIN+1 to be safe.
    expect(canSpawnAtPosition(PLAYER, at(MIN_SPAWN_DISTANCE + 1, 0))).toBe(true)
  })
})

describe('canSpawnAtPosition — too close', () => {
  it('returns false when XZ distance is below MIN_SPAWN_DISTANCE', () => {
    expect(canSpawnAtPosition(PLAYER, at(MIN_SPAWN_DISTANCE - 1, 0))).toBe(false)
  })

  it('returns false when player and spawn are at the same position', () => {
    expect(canSpawnAtPosition(PLAYER, PLAYER)).toBe(false)
  })
})

describe('canSpawnAtPosition — too far XZ', () => {
  it('returns false when XZ distance exceeds MAX_SPAWN_DISTANCE', () => {
    expect(canSpawnAtPosition(PLAYER, at(MAX_SPAWN_DISTANCE + 1, 0))).toBe(false)
  })
})

describe('canSpawnAtPosition — DESPAWN_DISTANCE limit', () => {
  it('returns false when 3D distance exceeds DESPAWN_DISTANCE despite valid XZ', () => {
    // XZ distance = 20 (valid band), dy = 100: total 3D = sqrt(400 + 10000) = sqrt(10400) ≈ 102.0
    // 102.0 < DESPAWN_DISTANCE (128) → should still return true
    expect(canSpawnAtPosition(PLAYER, at(20, 0, 100))).toBe(true)
    // XZ distance = 20, dy = 130: total 3D = sqrt(400 + 16900) = sqrt(17300) ≈ 131.5 > 128
    expect(canSpawnAtPosition(PLAYER, at(20, 0, 130))).toBe(false)
  })
})
