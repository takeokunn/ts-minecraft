import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Step 2: Day/night cycle
// ---------------------------------------------------------------------------

describe('step 2 — day/night cycle', () => {
  it.effect('calls timeService.advanceTick each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.timeService as unknown as { advanceTick: unknown }).advanceTick = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))
})

// ---------------------------------------------------------------------------
// Step 2.8: Sun intensity wiring
// ---------------------------------------------------------------------------

describe('step 2.8 — sun intensity wiring', () => {
  it.effect('calls chunkMeshService.setSunIntensity each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.chunkMeshService as unknown as { setSunIntensity: unknown }).setSunIntensity = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('passes a clamped [0,1] sun intensity to setSunIntensity', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Force noon (timeOfDay = 0.5) so sin curve peaks at 1.0
    ;(services.timeService as unknown as { getTimeOfDay: unknown }).getTimeOfDay = vi.fn(() =>
      Effect.succeed(0.5)
    )
    const spy = vi.fn(() => Effect.void)
    ;(services.chunkMeshService as unknown as { setSunIntensity: unknown }).setSunIntensity = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
    const arg = spy.mock.calls[0]?.[0] as number
    expect(arg).toBeGreaterThanOrEqual(0)
    expect(arg).toBeLessThanOrEqual(1)
    // At timeOfDay=0.5 (noon), sin((0.5-0.25)*2π) = sin(π/2) = 1
    expect(arg).toBeCloseTo(1, 5)
  }))

  it.effect('reports zero sun intensity at midnight (timeOfDay=0)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.timeService as unknown as { getTimeOfDay: unknown }).getTimeOfDay = vi.fn(() =>
      Effect.succeed(0)
    )
    const spy = vi.fn(() => Effect.void)
    ;(services.chunkMeshService as unknown as { setSunIntensity: unknown }).setSunIntensity = spy

    yield* runFrame(deps, services)

    // sin((0-0.25)*2π) = sin(-π/2) = -1, clamped to 0
    const arg = spy.mock.calls[0]?.[0] as number
    expect(arg).toBe(0)
  }))
})
