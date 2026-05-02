import { describe, expect, it } from 'vitest'
import { Array as Arr } from 'effect'
import { EntityId } from '@ts-minecraft/entities'
import { hashEntityId, makeWanderDirection, toPublicEntity } from '@ts-minecraft/entities'
import type { ManagedEntity } from '@ts-minecraft/entities'
import { AIState } from '@ts-minecraft/entities'

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
    ] as const

    it('does not expose AI-internal fields on the result', () => {
      const managed = makeManagedEntity()
      const pub = toPublicEntity(managed)
      Arr.forEach(internalFields, (field) => {
        expect(pub).not.toHaveProperty(field)
      })
    })

    it('result has exactly the six Entity keys', () => {
      const managed = makeManagedEntity()
      const pub = toPublicEntity(managed)
      const keys = Object.keys(pub).sort()
      expect(keys).toEqual(['entityId', 'health', 'position', 'rotation', 'type', 'velocity'])
    })
  })
})
