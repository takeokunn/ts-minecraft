import { describe, expect, it } from 'vitest'
import {
  hashEntityId,
  makeWanderDirectionFromHash,
  computeEndermanTeleportPosition,
} from '@ts-minecraft/entity/domain/mob/entity-utils'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'

// ─── hashEntityId ─────────────────────────────────────────────────────────────
describe('hashEntityId', () => {
  it('returns a non-negative integer', () => {
    const id = EntityId.make('zombie-1')
    expect(hashEntityId(id)).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic', () => {
    const id = EntityId.make('zombie-1')
    expect(hashEntityId(id)).toBe(hashEntityId(id))
  })

  it('produces different values for different ids', () => {
    const a = EntityId.make('zombie-1')
    const b = EntityId.make('zombie-2')
    expect(hashEntityId(a)).not.toBe(hashEntityId(b))
  })
})

// ─── makeWanderDirectionFromHash ──────────────────────────────────────────────
describe('makeWanderDirectionFromHash', () => {
  it('returns a unit-length vector (length ≈ 1)', () => {
    const dir = makeWanderDirectionFromHash(42, 100)
    const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z)
    expect(len).toBeCloseTo(1)
  })

  it('Y is always 0 (horizontal wandering only)', () => {
    for (let hash = 0; hash < 10; hash++) {
      expect(makeWanderDirectionFromHash(hash, 0).y).toBe(0)
    }
  })

  it('varies direction across ticks', () => {
    const d1 = makeWanderDirectionFromHash(0, 0)
    const d2 = makeWanderDirectionFromHash(0, 10)
    const different = d1.x !== d2.x || d1.z !== d2.z
    expect(different).toBe(true)
  })

  it('is deterministic for the same hash and tick', () => {
    const a = makeWanderDirectionFromHash(99, 50)
    const b = makeWanderDirectionFromHash(99, 50)
    expect(a).toEqual(b)
  })
})

// ─── computeEndermanTeleportPosition ─────────────────────────────────────────
describe('computeEndermanTeleportPosition', () => {
  const origin = { x: 0, y: 64, z: 0 }

  it('preserves the Y coordinate of the current position', () => {
    const result = computeEndermanTeleportPosition(origin, 10)
    expect(result.y).toBe(origin.y)
  })

  it('moves away from the current position (distance > 0)', () => {
    const result = computeEndermanTeleportPosition(origin, 10)
    const dx = result.x - origin.x
    const dz = result.z - origin.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    expect(dist).toBeGreaterThan(0)
  })

  it('is deterministic for the same input', () => {
    const a = computeEndermanTeleportPosition(origin, 15)
    const b = computeEndermanTeleportPosition(origin, 15)
    expect(a).toEqual(b)
  })

  it('produces different positions for different health values', () => {
    const a = computeEndermanTeleportPosition(origin, 5)
    const b = computeEndermanTeleportPosition(origin, 10)
    const different = a.x !== b.x || a.z !== b.z
    expect(different).toBe(true)
  })
})
