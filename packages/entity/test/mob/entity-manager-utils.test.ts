import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import {
  isHorizontalBlocked,
  toHorizontalTarget,
  isSamePosition,
  isSameVelocity,
  isFinitePosition,
  isFiniteVelocity,
  shouldDespawnEntity,
  MOB_STUCK_EPSILON,
} from '../../domain/mob/entity-manager-utils'
import { computeEndermanTeleportPosition, makeWanderDirectionFromHash } from '@ts-minecraft/entity/domain/mob/entity-utils';
import { distanceToPlayerSq } from '@ts-minecraft/entity/domain/mob/state-machine';
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { makeTestEntity } from './test-utils'

describe('entity/entity-manager-utils', () => {
  describe('makeTestEntity', () => {
    it('returns a valid entity with sensible defaults', () => {
      const entity = makeTestEntity()
      expect(typeof entity.entityId).toBe('string')
      expect(entity.entityId.length).toBeGreaterThan(0)
      expect(entity.type).toBe(EntityType.Zombie)
      expect(entity.health).toBe(20)
      expect(entity.position).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('allows overriding the entity type', () => {
      const entity = makeTestEntity({ type: EntityType.Cow })
      expect(entity.type).toBe(EntityType.Cow)
    })

    it('allows overriding the position', () => {
      const entity = makeTestEntity({ position: { x: 5, y: 64, z: -3 } })
      expect(entity.position).toEqual({ x: 5, y: 64, z: -3 })
    })

    it('creates a unique entityId on each call', () => {
      const a = makeTestEntity()
      const b = makeTestEntity()
      expect(a.entityId).not.toBe(b.entityId)
    })
  })

  describe('isSamePosition', () => {
    it('returns true when all three coordinates match exactly', () => {
      const pos = { x: 1.5, y: 64, z: -3 }
      expect(isSamePosition(pos, { ...pos })).toBe(true)
    })

    it('returns false when x differs', () => {
      expect(isSamePosition({ x: 1, y: 64, z: 0 }, { x: 2, y: 64, z: 0 })).toBe(false)
    })

    it('returns false when y differs', () => {
      expect(isSamePosition({ x: 1, y: 64, z: 0 }, { x: 1, y: 65, z: 0 })).toBe(false)
    })

    it('returns false when z differs', () => {
      expect(isSamePosition({ x: 1, y: 64, z: 0 }, { x: 1, y: 64, z: 1 })).toBe(false)
    })
  })

  describe('isSameVelocity', () => {
    it('returns true when all three components match exactly', () => {
      const vel = { x: 1.2, y: -3.5, z: 0 }
      expect(isSameVelocity(vel, { ...vel })).toBe(true)
    })

    it('returns false when x differs', () => {
      expect(isSameVelocity({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
    })

    it('returns false when y differs', () => {
      expect(isSameVelocity({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
    })

    it('returns false when z differs', () => {
      expect(isSameVelocity({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 })).toBe(false)
    })
  })

  describe('isFinitePosition', () => {
    it('returns true for normal coordinates', () => {
      expect(isFinitePosition({ x: 0, y: 64, z: -100 })).toBe(true)
    })

    it('returns false when x is NaN', () => {
      expect(isFinitePosition({ x: NaN, y: 64, z: 0 })).toBe(false)
    })

    it('returns false when y is Infinity', () => {
      expect(isFinitePosition({ x: 0, y: Infinity, z: 0 })).toBe(false)
    })

    it('returns false when z is -Infinity', () => {
      expect(isFinitePosition({ x: 0, y: 0, z: -Infinity })).toBe(false)
    })
  })

  describe('isFiniteVelocity', () => {
    it('returns true for zero velocity', () => {
      expect(isFiniteVelocity({ x: 0, y: 0, z: 0 })).toBe(true)
    })

    it('returns false when a component is NaN', () => {
      expect(isFiniteVelocity({ x: NaN, y: 0, z: 0 })).toBe(false)
    })

    it('returns false when a component is Infinity', () => {
      expect(isFiniteVelocity({ x: 0, y: Infinity, z: 0 })).toBe(false)
    })
  })

  describe('toHorizontalTarget', () => {
    it('copies player x and z, keeps entity y', () => {
      const entity = { x: 10, y: 64, z: 20 }
      const player = { x: 50, y: 70, z: 80 }
      const result = toHorizontalTarget(entity, player)
      expect(result.x).toBe(player.x)
      expect(result.y).toBe(entity.y)
      expect(result.z).toBe(player.z)
    })

    it('ignores the player y entirely', () => {
      const entity = { x: 0, y: 100, z: 0 }
      const player = { x: 5, y: 0, z: 5 }
      const result = toHorizontalTarget(entity, player)
      expect(result.y).toBe(entity.y)
    })
  })

  describe('isHorizontalBlocked', () => {
    it('detects x-axis block: x was moving, now stopped', () => {
      const before = { x: MOB_STUCK_EPSILON + 0.01, y: 0, z: 0 }
      const after  = { x: 0, y: 0, z: 0 }
      expect(isHorizontalBlocked(before, after)).toBe(true)
    })

    it('detects z-axis block: z was moving, now stopped', () => {
      const before = { x: 0, y: 0, z: MOB_STUCK_EPSILON + 0.01 }
      const after  = { x: 0, y: 0, z: 0 }
      expect(isHorizontalBlocked(before, after)).toBe(true)
    })

    it('returns false when x was already at zero before', () => {
      const before = { x: 0, y: 0, z: 0 }
      const after  = { x: 0, y: 0, z: 0 }
      expect(isHorizontalBlocked(before, after)).toBe(false)
    })

    it('returns false when both x and z remain moving', () => {
      const before = { x: 1, y: 0, z: 1 }
      const after  = { x: 0.9, y: 0, z: 0.9 }
      expect(isHorizontalBlocked(before, after)).toBe(false)
    })
  })
})

describe('entity/entity-utils (additional coverage)', () => {
  describe('makeWanderDirectionFromHash', () => {
    it('is deterministic: same hash + tick returns same direction', () => {
      const d1 = makeWanderDirectionFromHash(12345, 100)
      const d2 = makeWanderDirectionFromHash(12345, 100)
      expect(d1.x).toBe(d2.x)
      expect(d1.z).toBe(d2.z)
    })

    it('always has y === 0', () => {
      Arr.forEach([0, 1, 100, 999], (tick) => {
        expect(makeWanderDirectionFromHash(42, tick).y).toBe(0)
      })
    })

    it('returns a unit horizontal vector (x²+z² ≈ 1)', () => {
      const d = makeWanderDirectionFromHash(777, 50)
      expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 5)
    })

    it('produces different directions for different ticks (prime angle step avoids repetition)', () => {
      const d0 = makeWanderDirectionFromHash(0, 0)
      const d1 = makeWanderDirectionFromHash(0, 1)
      expect(d0.x).not.toBeCloseTo(d1.x, 5)
    })
  })

  describe('computeEndermanTeleportPosition', () => {
    it('moves in the horizontal plane (y is preserved)', () => {
      const pos = { x: 0, y: 64, z: 0 }
      const result = computeEndermanTeleportPosition(pos, 10)
      expect(result.y).toBe(pos.y)
    })

    it('teleports at least 4 blocks horizontally', () => {
      const pos = { x: 0, y: 64, z: 0 }
      const result = computeEndermanTeleportPosition(pos, 1)
      const dist = Math.hypot(result.x - pos.x, result.z - pos.z)
      expect(dist).toBeGreaterThanOrEqual(4)
    })

    it('teleports at most 11 blocks horizontally (dist formula: 4 + health%8)', () => {
      const pos = { x: 0, y: 64, z: 0 }
      Arr.forEach([0, 1, 5, 10, 15, 20], (health) => {
        const result = computeEndermanTeleportPosition(pos, health)
        const dist = Math.hypot(result.x - pos.x, result.z - pos.z)
        expect(dist).toBeLessThanOrEqual(12) // 4 + max 7 (health%8) = 11, allow rounding
      })
    })

    it('is deterministic: same pos + health always returns the same target', () => {
      const pos = { x: 10, y: 70, z: -5 }
      const r1 = computeEndermanTeleportPosition(pos, 8)
      const r2 = computeEndermanTeleportPosition(pos, 8)
      expect(r1).toEqual(r2)
    })
  })
})

describe('entity/state-machine (additional coverage)', () => {
  describe('distanceToPlayerSq', () => {
    it('returns 0 when entity is at player position', () => {
      const pos = { x: 5, y: 64, z: 10 }
      expect(distanceToPlayerSq(pos, pos)).toBe(0)
    })

    it('computes the correct squared 3D distance', () => {
      // dx=3, dy=0, dz=4 → 9+0+16=25
      expect(distanceToPlayerSq({ x: 3, y: 64, z: 4 }, { x: 0, y: 64, z: 0 })).toBe(25)
      // dx=3, dy=36, dz=4 → 9+1296+16=1321 (y is included)
      expect(distanceToPlayerSq({ x: 3, y: 64, z: 4 }, { x: 0, y: 100, z: 0 })).toBe(1321)
    })

    it('is symmetric (swap entity and player)', () => {
      const a = { x: 1, y: 64, z: 2 }
      const b = { x: 4, y: 80, z: 6 }
      expect(distanceToPlayerSq(a, b)).toBe(distanceToPlayerSq(b, a))
    })

    it('always returns a non-negative value', () => {
      expect(distanceToPlayerSq({ x: -5, y: 0, z: -3 }, { x: 2, y: 128, z: 7 })).toBeGreaterThanOrEqual(0)
    })
  })
})

// ── shouldDespawnEntity ───────────────────────────────────────────────────────

const makeEntity = (position: { x: number; y: number; z: number }, velocity = { x: 0, y: 0, z: 0 }) =>
  ({ position, velocity }) as never

describe('shouldDespawnEntity', () => {
  const player = { x: 0, y: 64, z: 0 }

  it('returns false when entity is within max distance', () => {
    const entity = makeEntity({ x: 10, y: 64, z: 0 })
    expect(shouldDespawnEntity(entity, player, 20)).toBe(false)
  })

  it('returns true when entity is beyond max distance (strictly greater)', () => {
    const entity = makeEntity({ x: 0, y: 64, z: 25 })
    expect(shouldDespawnEntity(entity, player, 20)).toBe(true)
  })

  it('returns false when entity is exactly at max distance boundary', () => {
    // distanceSq = 400 = 20², strict > so at boundary is false
    const entity = makeEntity({ x: 20, y: 64, z: 0 })
    expect(shouldDespawnEntity(entity, player, 20)).toBe(false)
  })

  it('returns true when entity has non-finite position (NaN)', () => {
    const entity = makeEntity({ x: NaN, y: 64, z: 0 })
    expect(shouldDespawnEntity(entity, player, 100)).toBe(true)
  })

  it('returns true when entity has non-finite position (Infinity)', () => {
    const entity = makeEntity({ x: Infinity, y: 64, z: 0 })
    expect(shouldDespawnEntity(entity, player, 100)).toBe(true)
  })

  it('returns true when entity velocity is non-finite', () => {
    const entity = makeEntity({ x: 5, y: 64, z: 0 }, { x: NaN, y: 0, z: 0 })
    expect(shouldDespawnEntity(entity, player, 100)).toBe(true)
  })
})
