import { describe, expect, it } from 'vitest'
import {
  CHORUS_FRUIT_TELEPORT_RADIUS,
  resolveChorusFruitTeleportTarget,
} from './chorus-fruit'

// ─── resolveChorusFruitTeleportTarget ─────────────────────────────────────────
describe('resolveChorusFruitTeleportTarget', () => {
  it('preserves the y coordinate', () => {
    const pos = { x: 10, y: 64, z: 20 }
    const result = resolveChorusFruitTeleportTarget(pos, () => 0.5)
    expect(result.y).toBe(64)
  })

  it('stays within teleport radius for roll=0 (maximum negative offset)', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const result = resolveChorusFruitTeleportTarget(pos, () => 0)
    // roll=0 → offset = (0 * 2 - 1) * radius = -radius
    expect(result.x).toBeCloseTo(-CHORUS_FRUIT_TELEPORT_RADIUS)
    expect(result.z).toBeCloseTo(-CHORUS_FRUIT_TELEPORT_RADIUS)
  })

  it('stays within teleport radius for roll=1 (maximum positive offset)', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const result = resolveChorusFruitTeleportTarget(pos, () => 1)
    expect(result.x).toBeCloseTo(CHORUS_FRUIT_TELEPORT_RADIUS)
    expect(result.z).toBeCloseTo(CHORUS_FRUIT_TELEPORT_RADIUS)
  })

  it('returns origin offset for roll=0.5 (zero offset)', () => {
    const pos = { x: 10, y: 64, z: 20 }
    const result = resolveChorusFruitTeleportTarget(pos, () => 0.5)
    // roll=0.5 → offset = (0.5 * 2 - 1) * radius = 0 * radius = 0
    expect(result.x).toBeCloseTo(10)
    expect(result.z).toBeCloseTo(20)
  })

  it('clamps roll values above 1', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const result = resolveChorusFruitTeleportTarget(pos, () => 2)
    // clamp(2)=1 → same as roll=1
    expect(result.x).toBeCloseTo(CHORUS_FRUIT_TELEPORT_RADIUS)
  })

  it('clamps roll values below 0', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const result = resolveChorusFruitTeleportTarget(pos, () => -1)
    // clamp(-1)=0 → same as roll=0
    expect(result.x).toBeCloseTo(-CHORUS_FRUIT_TELEPORT_RADIUS)
  })

  it('uses different roll values for x and z (two distinct calls)', () => {
    const pos = { x: 0, y: 64, z: 0 }
    let callCount = 0
    const result = resolveChorusFruitTeleportTarget(pos, () => {
      callCount++
      return callCount === 1 ? 0 : 1 // x gets 0, z gets 1
    })
    expect(result.x).toBeCloseTo(-CHORUS_FRUIT_TELEPORT_RADIUS)
    expect(result.z).toBeCloseTo(CHORUS_FRUIT_TELEPORT_RADIUS)
  })
})
