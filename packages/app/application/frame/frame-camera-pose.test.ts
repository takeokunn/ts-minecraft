import { describe, expect, it } from 'vitest'
import {
  copyCameraPoseInto,
  hasCameraPoseChanged,
  type CameraPoseSnapshot,
} from './frame-camera-pose'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeSnapshot = (overrides: Partial<CameraPoseSnapshot> = {}): CameraPoseSnapshot => ({
  version: 1,
  x: 0, y: 64, z: 0,
  qx: 0, qy: 0, qz: 0, qw: 1,
  p0: 1, p5: 1, p10: 1, p14: 1,
  ...overrides,
})

// ─── copyCameraPoseInto ───────────────────────────────────────────────────────
describe('copyCameraPoseInto', () => {
  it('copies all fields from src into dst', () => {
    const src = makeSnapshot({ version: 5, x: 10, y: 80, z: -5, qw: 0.5 })
    const dst = makeSnapshot()
    copyCameraPoseInto(src, dst)
    expect(dst.version).toBe(5)
    expect(dst.x).toBe(10)
    expect(dst.y).toBe(80)
    expect(dst.z).toBe(-5)
    expect(dst.qw).toBe(0.5)
  })

  it('does not mutate the source', () => {
    const src = makeSnapshot({ version: 3 })
    const originalVersion = src.version
    const dst = makeSnapshot()
    copyCameraPoseInto(src, dst)
    expect(src.version).toBe(originalVersion)
  })
})

// ─── hasCameraPoseChanged ─────────────────────────────────────────────────────
describe('hasCameraPoseChanged', () => {
  it('returns false when both snapshots are identical', () => {
    const a = makeSnapshot()
    const b = makeSnapshot()
    expect(hasCameraPoseChanged(a, b)).toBe(false)
  })

  it('returns true when version differs', () => {
    const a = makeSnapshot({ version: 1 })
    const b = makeSnapshot({ version: 2 })
    expect(hasCameraPoseChanged(a, b)).toBe(true)
  })

  it('returns true when X position differs', () => {
    const a = makeSnapshot({ x: 0 })
    const b = makeSnapshot({ x: 1 })
    expect(hasCameraPoseChanged(a, b)).toBe(true)
  })

  it('returns true when quaternion differs', () => {
    const a = makeSnapshot({ qx: 0 })
    const b = makeSnapshot({ qx: 0.1 })
    expect(hasCameraPoseChanged(a, b)).toBe(true)
  })

  it('returns true when projection matrix element p10 differs', () => {
    const a = makeSnapshot({ p10: 1 })
    const b = makeSnapshot({ p10: 2 })
    expect(hasCameraPoseChanged(a, b)).toBe(true)
  })

  it('returns false after copyCameraPoseInto (round-trip identity)', () => {
    const src = makeSnapshot({ version: 7, x: 100, qy: 0.3 })
    const dst = makeSnapshot()
    copyCameraPoseInto(src, dst)
    expect(hasCameraPoseChanged(src, dst)).toBe(false)
  })
})
