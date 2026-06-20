import { describe, it, expect } from 'vitest'
import { Effect, MutableRef, Ref } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { copyCameraPoseInto, hasCameraPoseChanged, type CameraPoseSnapshot } from '../application/frame/frame-camera-pose'
import { advanceFixedStep, runTickable } from '../application/frame/frame-fixed-step'
import { decideAdaptiveQuality, type AdaptiveQualityInput } from '../application/frame/frame-adaptive-quality'

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

// ─── runTickable ──────────────────────────────────────────────────────────────

describe('runTickable', () => {
  const run = <A>(eff: Effect.Effect<A, never>) => Effect.runSync(eff)

  it('fires the tick once per fixed interval regardless of frame rate', () =>
    run(Effect.gen(function* () {
      const acc = MutableRef.make(0)
      const count = yield* Ref.make(0)
      const tick = Ref.update(count, (n) => n + 1)
      // Simulate 60 frames at ~60fps (deltaTime 1/60). 1s elapsed at a 0.05s (20Hz)
      // interval must fire exactly 20 ticks — NOT 60 (which a per-frame count would give).
      yield* Effect.repeatN(runTickable(acc, tick, DeltaTimeSecs.make(1 / 60), 0.05), 59)
      expect(yield* Ref.get(count)).toBe(20)
    })))

  it('catches up multiple ticks when a single frame spans several intervals', () =>
    run(Effect.gen(function* () {
      const acc = MutableRef.make(0)
      const count = yield* Ref.make(0)
      const tick = Ref.update(count, (n) => n + 1)
      // One long 0.16s frame at a 0.05s interval = 3 ticks (floor(0.16/0.05)).
      yield* runTickable(acc, tick, DeltaTimeSecs.make(0.16), 0.05)
      expect(yield* Ref.get(count)).toBe(3)
    })))

  it('does not fire until the interval is reached', () =>
    run(Effect.gen(function* () {
      const acc = MutableRef.make(0)
      const count = yield* Ref.make(0)
      const tick = Ref.update(count, (n) => n + 1)
      // Two sub-interval frames (0.02s each = 0.04s total < 0.05s) → no tick yet.
      yield* runTickable(acc, tick, DeltaTimeSecs.make(0.02), 0.05)
      yield* runTickable(acc, tick, DeltaTimeSecs.make(0.02), 0.05)
      expect(yield* Ref.get(count)).toBe(0)
      // The third frame crosses 0.05s → exactly one tick.
      yield* runTickable(acc, tick, DeltaTimeSecs.make(0.02), 0.05)
      expect(yield* Ref.get(count)).toBe(1)
    })))
})

// ─── decideAdaptiveQuality ────────────────────────────────────────────────────

describe('decideAdaptiveQuality', () => {
  it('returns no patch when adaptivePerformanceMode is false', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ adaptivePerformanceMode: false }))
    expect(result).toBe(0)
  })

  it('decrements cooldown without patching when cooldown > 0', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ cooldown: 5 }))
    expect(result).toBe(4)
  })

  it('returns no patch when fps is in the threshold deadband', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ fps: 55, cooldown: 0 }))
    expect(result).toBe(0)
  })

  it('does NOT degrade a smooth near-60fps experience (regression: old 110 threshold forced 60Hz users to the floor)', () => {
    const result = decideAdaptiveQuality(
      makeAdaptiveInput({ graphicsQuality: 'medium', renderDistance: 8, fps: 59, cooldown: 0 }),
    )
    expect(result).toBe(0)
  })

  it('returns no patch when fps is exactly 0 (first frame guard)', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ fps: 0, cooldown: 0 }))
    expect(result).toBe(0)
  })

  it('lowers graphicsQuality from ultra to high when fps is low', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'ultra', fps: 30 }))
    if (typeof result === 'number') throw new Error('expected patch')
    const patch = result.settingsPatch
    expect(patch.graphicsQuality).toBe('high')
    expect(result.nextCooldown).toBe(20)
  })

  it('lowers graphicsQuality from high to medium when fps is low', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'high', fps: 30 }))
    if (typeof result === 'number') throw new Error('expected patch')
    const patch = result.settingsPatch
    expect(patch.graphicsQuality).toBe('medium')
  })

  it('lowers graphicsQuality from medium to low when fps is low', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'medium', fps: 30 }))
    if (typeof result === 'number') throw new Error('expected patch')
    const patch = result.settingsPatch
    expect(patch.graphicsQuality).toBe('low')
  })

  it('reduces renderDistance when at low quality and renderDistance > 4', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'low', renderDistance: 8, fps: 30 }))
    if (typeof result === 'number') throw new Error('expected patch')
    const patch = result.settingsPatch
    expect(patch.renderDistance).toBe(7)
    expect(result.nextCooldown).toBe(20)
  })

  it('does nothing when at low quality and renderDistance <= 4', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'low', renderDistance: 4, fps: 30 }))
    expect(result).toBe(0)
  })

  it('increases renderDistance when fps is comfortably above the threshold', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'low', renderDistance: 6, fps: 120 }))
    if (typeof result === 'number') throw new Error('expected patch')
    expect(result.settingsPatch.renderDistance).toBe(7)
    expect(result.nextCooldown).toBe(20)
  })

  it('raises graphicsQuality after renderDistance has recovered', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'medium', renderDistance: 8, fps: 120 }))
    if (typeof result === 'number') throw new Error('expected patch')
    expect(result.settingsPatch.graphicsQuality).toBe('high')
    expect(result.nextCooldown).toBe(20)
  })

  it('does not auto-raise graphicsQuality beyond high', () => {
    const result = decideAdaptiveQuality(makeAdaptiveInput({ graphicsQuality: 'high', renderDistance: 8, fps: 120 }))
    expect(result).toBe(0)
  })
})
