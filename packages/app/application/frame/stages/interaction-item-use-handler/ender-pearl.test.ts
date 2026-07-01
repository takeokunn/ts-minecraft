import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  ENDER_PEARL_ENDERMITE_SPAWN_CHANCE,
  ENDER_PEARL_MAX_DISTANCE,
  resolveEnderPearlTeleportTarget,
  shouldSpawnEndermiteFromEnderPearl,
} from './ender-pearl'

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeVec3 = (x: number, y: number, z: number) =>
  ({ x, y, z, length: () => Math.sqrt(x * x + y * y + z * z) }) as any

// ─── resolveEnderPearlTeleportTarget ──────────────────────────────────────────
describe('resolveEnderPearlTeleportTarget', () => {
  it('travels ENDER_PEARL_MAX_DISTANCE along the direction when no hit', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const dir = makeVec3(0, 0, -1) // straight forward
    const result = resolveEnderPearlTeleportTarget(pos, dir, Option.none())
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(64)
    expect(result.z).toBeCloseTo(-ENDER_PEARL_MAX_DISTANCE)
  })

  it('clamps to hit distance when target hit is closer than max distance', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const dir = makeVec3(0, 0, -1)
    const hit = { blockX: 0, blockY: 64, blockZ: -5, distance: 5, normal: { x: 0, y: 0, z: 1 } }
    const result = resolveEnderPearlTeleportTarget(pos, dir, Option.some(hit))
    expect(result.z).toBeCloseTo(-5)
  })

  it('clamps to ENDER_PEARL_MAX_DISTANCE when hit distance exceeds max', () => {
    const pos = { x: 0, y: 64, z: 0 }
    const dir = makeVec3(0, 0, -1)
    const hit = { blockX: 0, blockY: 64, blockZ: -100, distance: 100, normal: { x: 0, y: 0, z: 1 } }
    const result = resolveEnderPearlTeleportTarget(pos, dir, Option.some(hit))
    expect(result.z).toBeCloseTo(-ENDER_PEARL_MAX_DISTANCE)
  })

  it('uses fallback direction (0, 0, -1) when direction vector has zero length', () => {
    const pos = { x: 10, y: 64, z: 20 }
    const dir = makeVec3(0, 0, 0) // zero-length vector
    const result = resolveEnderPearlTeleportTarget(pos, dir, Option.none())
    // dx=0, dy=0, dz=-1 → z decreases by MAX_DISTANCE
    expect(result.z).toBeCloseTo(20 - ENDER_PEARL_MAX_DISTANCE)
  })

  it('adds offset to origin position (non-zero starting coords)', () => {
    const pos = { x: 100, y: 70, z: 200 }
    const dir = makeVec3(1, 0, 0) // unit vector along X
    const result = resolveEnderPearlTeleportTarget(pos, dir, Option.none())
    expect(result.x).toBeCloseTo(100 + ENDER_PEARL_MAX_DISTANCE)
    expect(result.y).toBeCloseTo(70)
    expect(result.z).toBeCloseTo(200)
  })
})

// ─── shouldSpawnEndermiteFromEnderPearl ───────────────────────────────────────
describe('shouldSpawnEndermiteFromEnderPearl', () => {
  it('returns true for roll = 0 (lower bound)', () => {
    expect(shouldSpawnEndermiteFromEnderPearl(0)).toBe(true)
  })

  it('returns true for a roll just below the spawn chance', () => {
    expect(shouldSpawnEndermiteFromEnderPearl(ENDER_PEARL_ENDERMITE_SPAWN_CHANCE - 0.001)).toBe(true)
  })

  it('returns false for roll = spawn chance (exclusive upper bound)', () => {
    expect(shouldSpawnEndermiteFromEnderPearl(ENDER_PEARL_ENDERMITE_SPAWN_CHANCE)).toBe(false)
  })

  it('returns false for roll > spawn chance (most common outcome)', () => {
    expect(shouldSpawnEndermiteFromEnderPearl(0.5)).toBe(false)
  })

  it('returns false for negative roll', () => {
    expect(shouldSpawnEndermiteFromEnderPearl(-0.1)).toBe(false)
  })
})
