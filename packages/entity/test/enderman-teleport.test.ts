import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import type { Position } from '@ts-minecraft/core'
import {
  TELEPORT_MAX_RANGE,
  TELEPORT_MIN_RANGE,
  computeEndermanTeleportTarget,
  shouldEndermanTeleport,
} from '../domain/mob/enderman-teleport'

const target: Position = { x: 100, y: 64, z: -20 }
const current: Position = { x: 0, y: 70, z: 0 }

const horizontalDistance = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

describe('enderman-teleport', () => {
  describe('computeEndermanTeleportTarget', () => {
    it('uses deterministic random attempts to compute a target-level position', () => {
      const result = computeEndermanTeleportTarget(current, target, [0.75, 0.5])

      expect(result).toEqual({ x: 116, y: 64, z: -20 })
    })

    it('skips invalid attempts and returns the first valid teleport position', () => {
      const result = computeEndermanTeleportTarget(current, target, [0.5, 0.5, 0.75, 0.5])

      expect(result).toEqual({ x: 116, y: 64, z: -20 })
    })

    it('returns null when no attempt is within the valid range', () => {
      const attempts = Array.from({ length: 32 }, () => 0.5)

      expect(computeEndermanTeleportTarget(current, target, attempts)).toBeNull()
    })

    it('keeps positions within min/max horizontal range near the target', () => {
      const result = computeEndermanTeleportTarget(current, target, [0.8, 0.5])

      expect(result).not.toBeNull()
      const distance = horizontalDistance(result as Position, target)
      expect(distance).toBeGreaterThanOrEqual(TELEPORT_MIN_RANGE)
      expect(distance).toBeLessThanOrEqual(TELEPORT_MAX_RANGE)
    })
  })

  describe('shouldEndermanTeleport', () => {
    it('teleports on damage only when the hit roll is under 30%', () => {
      expect(shouldEndermanTeleport(true, 0, 0.29)).toBe(true)
      expect(shouldEndermanTeleport(true, 100, 0.3)).toBe(false)
    })

    it('teleports when stuck for more than 40 ticks', () => {
      expect(shouldEndermanTeleport(false, 40, 0.99)).toBe(false)
      expect(shouldEndermanTeleport(false, 41, 0.99)).toBe(true)
    })

    it('teleports occasionally during chase at a 5% roll threshold', () => {
      expect(shouldEndermanTeleport(false, 0, 0.049)).toBe(true)
      expect(shouldEndermanTeleport(false, 0, 0.05)).toBe(false)
    })
  })
})
