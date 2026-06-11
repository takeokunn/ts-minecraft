import { describe, it } from '@effect/vitest'
import {
DEFAULT_SETTINGS,
makeDeps,
makeInputService,
makeInventoryRenderer,
makeServices,
makeSettingsOverlay,
runFrame,
} from '@test/frame-handler-test-kit'
import { createFrameHandlers } from '@ts-minecraft/app'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { resolvePreset } from '@ts-minecraft/game'
import { Effect,MutableRef,Option } from 'effect'
import { expect,vi } from 'vitest'

// Derive from the preset (not hard-coded) so retuning pixelRatioCap doesn't break
// these tests. The node test env has no `window`, so devicePixelRatio defaults to
// 1 and min(1, cap) === cap for any sub-native low cap.
const LOW_PIXEL_RATIO = resolvePreset('low').pixelRatioCap

// ---------------------------------------------------------------------------
// FR-009: Refraction pre-pass skip on low quality
// ---------------------------------------------------------------------------

describe('FR-009 — refraction pre-pass skip on low quality', () => {
  it.effect('does NOT call doRefractionPrePass when graphicsQuality is low', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Override settingsService to return low quality
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    yield* runFrame(deps, services)

    expect(refractionSpy).not.toHaveBeenCalled()
  }))

  it.effect('calls doRefractionPrePass when graphicsQuality is high', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Default settings already have graphicsQuality: 'high'
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    yield* runFrame(deps, services)

    expect(refractionSpy).toHaveBeenCalledOnce()
  }))

  it.effect('calls doRefractionPrePass when graphicsQuality is medium', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'medium' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    yield* runFrame(deps, services)

    expect(refractionSpy).toHaveBeenCalledOnce()
  }))

  it.effect('skips doRefractionPrePass on the second identical ultra-quality frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'ultra' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    expect(refractionSpy).toHaveBeenCalledOnce()
  }))
})

// ---------------------------------------------------------------------------
// FR-008: Graphics quality caching (pass enable sync)
// ---------------------------------------------------------------------------

describe('FR-008 — graphics quality caching', () => {
  it.effect('skips doRefractionPrePass on second frame when quality stays low both times', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    // Run two frames with the same handler instance to test caching
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    // doRefractionPrePass should never be called (low quality skips it)
    expect(refractionSpy).not.toHaveBeenCalled()
  }))

  it.effect('throttles doRefractionPrePass based on quality preset (high = every 2 frames)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    // Run three frames: high quality (refractionThrottleFrames=2) runs on frames 1 and 3
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    // The unchanged-frame cache suppresses the repeated render, so only the first frame runs.
    expect(refractionSpy).toHaveBeenCalledTimes(1)
  }))

  it.effect('resumes doRefractionPrePass when quality changes from low to high', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const callCountRef = MutableRef.make(0)
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() => {
      const count = MutableRef.updateAndGet(callCountRef, n => n + 1)
      // First frame: low quality, second frame: high quality
      const quality = count <= 1 ? 'low' : 'high'
      return Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: quality as 'low' | 'high' })
    })
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs) // low — skip refraction
    yield* handler(0.016 as DeltaTimeSecs) // high — call refraction

    // Only the second frame should call doRefractionPrePass
    expect(refractionSpy).toHaveBeenCalledOnce()
  }))

  it.effect('applies a reduced pixel ratio for low quality', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)

    expect((deps.renderer.setPixelRatio as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(LOW_PIXEL_RATIO)
  }))

  it.effect('applies the reduced pixel ratio to composer when present', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false, true)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)

    const composer = Option.getOrNull(deps.composer)
    expect((composer as { setPixelRatio: ReturnType<typeof vi.fn> }).setPixelRatio).toHaveBeenCalledWith(LOW_PIXEL_RATIO)
  }))
})
