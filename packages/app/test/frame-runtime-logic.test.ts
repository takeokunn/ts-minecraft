import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  copyCameraPoseInto,
  hasCameraPoseChanged,
  advanceFixedStep,
  decideAdaptiveQuality,
  type CameraPoseSnapshot,
  type AdaptiveQualityInput,
} from '../application/frame/frame-runtime-logic'

// ─── helpers ──────────────────────────────────────────────────────────────────

const makePose = (overrides: Partial<CameraPoseSnapshot> = {}): CameraPoseSnapshot => ({
  version: 0, x: 0, y: 0, z: 0,
  qx: 0, qy: 0, qz: 0, qw: 1,
  p0: 1, p5: 1, p10: -1, p14: -1,
  ...overrides,
})

const makeAdaptiveInput = (overrides: Partial<AdaptiveQualityInput> = {}): AdaptiveQualityInput => ({
  adaptivePerformanceMode: true,
  graphicsQuality: 'high',
  renderDistance: 8,
  fps: 30,
  cooldown: 0,
  ...overrides,
})

// ─── copyCameraPoseInto ───────────────────────────────────────────────────────

describe('copyCameraPoseInto', () => {
  it('copies all fields from src into dst', () => {
    const src = makePose({ version: 5, x: 1, y: 2, z: 3, qx: 0.1, qy: 0.2, qz: 0.3, qw: 0.9, p0: 2, p5: 3, p10: -2, p14: -5 })
    const dst = makePose()
    copyCameraPoseInto(src, dst)
    expect(dst).toEqual(src)
  })

  it('does not mutate src', () => {
    const src = makePose({ version: 7 })
    const original = { ...src }
    const dst = makePose()
    copyCameraPoseInto(src, dst)
    expect(src).toEqual(original)
  })
})

// ─── hasCameraPoseChanged ─────────────────────────────────────────────────────

describe('hasCameraPoseChanged', () => {
  it('returns false when both snapshots are identical', () => {
    const a = makePose({ version: 1, x: 5 })
    const b = makePose({ version: 1, x: 5 })
    expect(hasCameraPoseChanged(a, b)).toBe(false)
  })

  it('returns true when version differs', () => {
    const a = makePose({ version: 1 })
    const b = makePose({ version: 2 })
    expect(hasCameraPoseChanged(a, b)).toBe(true)
  })

  it('returns true when position differs', () => {
    expect(hasCameraPoseChanged(makePose({ x: 0 }), makePose({ x: 1 }))).toBe(true)
    expect(hasCameraPoseChanged(makePose({ y: 0 }), makePose({ y: 1 }))).toBe(true)
    expect(hasCameraPoseChanged(makePose({ z: 0 }), makePose({ z: 1 }))).toBe(true)
  })

  it('returns true when quaternion differs', () => {
    expect(hasCameraPoseChanged(makePose({ qx: 0 }), makePose({ qx: 0.5 }))).toBe(true)
    expect(hasCameraPoseChanged(makePose({ qw: 1 }), makePose({ qw: 0.5 }))).toBe(true)
  })

  it('returns true when projection element differs', () => {
    expect(hasCameraPoseChanged(makePose({ p0: 1 }), makePose({ p0: 2 }))).toBe(true)
    expect(hasCameraPoseChanged(makePose({ p14: -1 }), makePose({ p14: -2 }))).toBe(true)
  })
})

// ─── advanceFixedStep ─────────────────────────────────────────────────────────

describe('advanceFixedStep', () => {
  it('returns 0 ticks when accumulated < interval', () => {
    const [ticks, rem] = advanceFixedStep(0, 0.01, 0.05)
    expect(ticks).toBe(0)
    expect(rem).toBeCloseTo(0.01, 5)
  })

  it('returns 1 tick when accumulated crosses interval exactly', () => {
    const [ticks, rem] = advanceFixedStep(0, 0.05, 0.05)
    expect(ticks).toBe(1)
    expect(rem).toBeCloseTo(0, 5)
  })

  it('returns 2 ticks when accumulated crosses two intervals', () => {
    const [ticks, rem] = advanceFixedStep(0, 0.1, 0.05)
    expect(ticks).toBe(2)
    expect(rem).toBeCloseTo(0, 5)
  })

  it('preserves leftover sub-interval time as remainder', () => {
    const [ticks, rem] = advanceFixedStep(0, 0.07, 0.05)
    expect(ticks).toBe(1)
    expect(rem).toBeCloseTo(0.02, 5)
  })

  it('accumulated carry-over counts toward next step', () => {
    const [, remainder] = advanceFixedStep(0, 0.04, 0.05)
    const [ticks] = advanceFixedStep(remainder, 0.02, 0.05)
    expect(ticks).toBe(1)
  })
})

// ─── decideAdaptiveQuality ────────────────────────────────────────────────────

describe('decideAdaptiveQuality', () => {
  it('returns no patch when adaptivePerformanceMode is false', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ adaptivePerformanceMode: false }))
    expect(Option.isNone(result.settingsPatch)).toBe(true)
    expect(result.nextCooldown).toBe(0)
  })

  it('decrements cooldown without patching when cooldown > 0', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ cooldown: 5 }))
    expect(Option.isNone(result.settingsPatch)).toBe(true)
    expect(result.nextCooldown).toBe(4)
  })

  it('returns no patch when fps >= threshold (110)', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ fps: 120, cooldown: 0 }))
    expect(Option.isNone(result.settingsPatch)).toBe(true)
  })

  it('returns no patch when fps is exactly 0 (first frame guard)', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ fps: 0, cooldown: 0 }))
    expect(Option.isNone(result.settingsPatch)).toBe(true)
  })

  it('lowers graphicsQuality from ultra to high when fps is low', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'ultra', fps: 30 }))
    const patch = Option.getOrThrow(result.settingsPatch)
    expect(patch.graphicsQuality).toBe('high')
    expect(result.nextCooldown).toBe(20)
  })

  it('lowers graphicsQuality from high to medium when fps is low', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'high', fps: 30 }))
    const patch = Option.getOrThrow(result.settingsPatch)
    expect(patch.graphicsQuality).toBe('medium')
  })

  it('lowers graphicsQuality from medium to low when fps is low', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'medium', fps: 30 }))
    const patch = Option.getOrThrow(result.settingsPatch)
    expect(patch.graphicsQuality).toBe('low')
  })

  it('reduces renderDistance when at low quality and renderDistance > 4', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'low', renderDistance: 8, fps: 30 }))
    const patch = Option.getOrThrow(result.settingsPatch)
    expect(patch.renderDistance).toBe(7)
    expect(result.nextCooldown).toBe(20)
  })

  it('does nothing when at low quality and renderDistance <= 4', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'low', renderDistance: 4, fps: 30 }))
    expect(Option.isNone(result.settingsPatch)).toBe(true)
  })
})
