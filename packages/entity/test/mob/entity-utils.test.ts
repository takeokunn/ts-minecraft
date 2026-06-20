import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity';
import { BABY_GROW_TICKS } from '@ts-minecraft/entity/domain/mob/breeding';
import { hashEntityId, makeWanderDirection, toPublicEntity } from '@ts-minecraft/entity/domain/mob/entity-utils';
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { makeWanderDirectionFromHash, computeEndermanTeleportPosition } from '../../domain/mob/entity-utils'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

describe('entity/entity-utils', () => {
  describe('hashEntityId', () => {
    it('is deterministic: same input returns same output', () => {
      const id = EntityId.make('entity-42')
      expect(hashEntityId(id)).toBe(hashEntityId(id))
    })

    it('returns a non-negative integer', () => {
      const id = EntityId.make('entity-1')
      const result = hashEntityId(id)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(result)).toBe(true)
    })

    it('produces different hashes for different entity ids', () => {
      const id1 = EntityId.make('entity-1')
      const id2 = EntityId.make('entity-2')
      expect(hashEntityId(id1)).not.toBe(hashEntityId(id2))
    })

    it('returns 0 for empty string', () => {
      const id = EntityId.make('')
      expect(hashEntityId(id)).toBe(0)
    })
  })

  describe('makeWanderDirection', () => {
    it('returns a unit vector (x² + y² + z² ≈ 1)', () => {
      const id = EntityId.make('entity-1')
      const dir = makeWanderDirection(id, 0)
      const magnitude = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z)
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('always has y === 0 (horizontal movement only)', () => {
      const id = EntityId.make('entity-5')
      const dir = makeWanderDirection(id, 10)
      expect(dir.y).toBe(0)
    })

    it('is deterministic: same entityId + tick returns same direction', () => {
      const id = EntityId.make('entity-3')
      const dir1 = makeWanderDirection(id, 7)
      const dir2 = makeWanderDirection(id, 7)
      expect(dir1.x).toBe(dir2.x)
      expect(dir1.z).toBe(dir2.z)
    })

    it('produces different directions for different ticks', () => {
      const id = EntityId.make('entity-1')
      const dir0 = makeWanderDirection(id, 0)
      const dir1 = makeWanderDirection(id, 1)
      // tick*29 shifts the angle, so directions differ
      expect(dir0.x).not.toBeCloseTo(dir1.x, 5)
    })

    it('x and z are in range [-1, 1] across multiple ticks', () => {
      const id = EntityId.make('entity-7')
      Arr.forEach(Arr.makeBy(20, (tick) => tick), (tick) => {
        const dir = makeWanderDirection(id, tick)
        expect(dir.x).toBeGreaterThanOrEqual(-1)
        expect(dir.x).toBeLessThanOrEqual(1)
        expect(dir.z).toBeGreaterThanOrEqual(-1)
        expect(dir.z).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('toPublicEntity', () => {
    const makeManagedEntity = (): ManagedEntity => ({
      entityId: EntityId.make('entity-99'),
      position: { x: 1, y: 64, z: 2 },
      velocity: { x: 0.5, y: 0, z: -0.5 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      health: 15,
      type: 'Zombie',
      behavior: 'hostile',
      maxHealth: 20,
      attackDamage: 3,
      speed: 2,
      detectionRange: 16,
      attackRange: 2,
      fleeHealthThreshold: 0,
      drops: [],
      aiState: AIState.Chase,
      wanderDirection: { x: 1, y: 0, z: 0 },
      attackCooldownRemaining: 0.5,
      isGrounded: false,
      knockbackSecsRemaining: 0,
      stuckTicks: 0,
      fuseSecs: 0,
    })

    it('preserves all public Entity fields', () => {
      const managed = makeManagedEntity()
      const pub = toPublicEntity(managed)
      expect(pub.entityId).toBe(managed.entityId)
      expect(pub.position).toEqual(managed.position)
      expect(pub.velocity).toEqual(managed.velocity)
      expect(pub.rotation).toEqual(managed.rotation)
      expect(pub.health).toBe(managed.health)
      expect(pub.type).toBe(managed.type)
    })

    const internalFields = [
      'aiState',
      'wanderDirection',
      'behavior',
      'maxHealth',
      'attackDamage',
      'attackCooldownRemaining',
      'drops',
      'isGrounded',
      'stuckTicks',
      'fuseSecs',
    ] as const

    it('does not expose AI-internal fields on the result', () => {
      const managed = makeManagedEntity()
      const pub = toPublicEntity(managed)
      Arr.forEach(internalFields, (field) => {
        expect(pub).not.toHaveProperty(field)
      })
    })

    it('result has exactly the seven Entity keys (incl. isBaby, R6d)', () => {
      const managed = makeManagedEntity()
      const pub = toPublicEntity(managed)
      const keys = Object.keys(pub).sort()
      expect(keys).toEqual(['entityId', 'health', 'isBaby', 'position', 'rotation', 'type', 'velocity'])
    })

    it('isBaby reflects ageTicks vs BABY_GROW_TICKS (R6d)', () => {
      expect(toPublicEntity({ ...makeManagedEntity(), ageTicks: BABY_GROW_TICKS }).isBaby).toBe(false)
      expect(toPublicEntity({ ...makeManagedEntity(), ageTicks: 0 }).isBaby).toBe(true)
    })
  })

  describe('makeWanderDirectionFromHash', () => {
    it('returns a unit vector on the horizontal plane', () => {
      const dir = makeWanderDirectionFromHash(42, 0)
      const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z)
      expect(mag).toBeCloseTo(1, 5)
      expect(dir.y).toBe(0)
    })

    it('is deterministic: same hash + tick → same result', () => {
      const d1 = makeWanderDirectionFromHash(7, 3)
      const d2 = makeWanderDirectionFromHash(7, 3)
      expect(d1.x).toBe(d2.x)
      expect(d1.z).toBe(d2.z)
    })

    it('different ticks produce different directions (29-step rotation per tick)', () => {
      const d0 = makeWanderDirectionFromHash(1, 0)
      const d1 = makeWanderDirectionFromHash(1, 1)
      expect(d0.x).not.toBeCloseTo(d1.x, 5)
    })

    it('produces different results for different hash values', () => {
      const d0 = makeWanderDirectionFromHash(0, 100)
      const d1 = makeWanderDirectionFromHash(1, 100)
      expect(d0.x).not.toBeCloseTo(d1.x, 5)
    })
  })

  describe('computeEndermanTeleportPosition', () => {
    it('preserves Y position (teleport stays at same height)', () => {
      const origin = { x: 0, y: 64, z: 0 }
      const result = computeEndermanTeleportPosition(origin, 10)
      expect(result.y).toBe(origin.y)
    })

    it('moves some horizontal distance from the origin', () => {
      const origin = { x: 0, y: 64, z: 0 }
      const result = computeEndermanTeleportPosition(origin, 10)
      const dist = Math.hypot(result.x - origin.x, result.z - origin.z)
      expect(dist).toBeGreaterThan(0)
    })

    it('is deterministic: same position + health → same result', () => {
      const origin = { x: 5, y: 70, z: -3 }
      const r1 = computeEndermanTeleportPosition(origin, 7)
      const r2 = computeEndermanTeleportPosition(origin, 7)
      expect(r1.x).toBe(r2.x)
      expect(r1.z).toBe(r2.z)
    })

    it('distance is between 4 and 12 (4 + health%8)', () => {
      for (let health = 0; health <= 20; health++) {
        const origin = { x: 0, y: 64, z: 0 }
        const result = computeEndermanTeleportPosition(origin, health)
        const dist = Math.hypot(result.x - origin.x, result.z - origin.z)
        const expectedDist = 4 + (Math.floor(health) % 8)
        expect(dist).toBeCloseTo(expectedDist, 5)
      }
    })

    it('preserves the original position object (no mutation)', () => {
      const origin = { x: 1, y: 64, z: 2 }
      computeEndermanTeleportPosition(origin, 15)
      expect(origin).toEqual({ x: 1, y: 64, z: 2 })
    })
  })
})
