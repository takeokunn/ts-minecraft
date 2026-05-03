import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableRef, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app'
import {
  DEFAULT_SETTINGS,
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Step 9: FPS display
// ---------------------------------------------------------------------------

describe('step 9 — FPS display', () => {
  it.effect('calls fpsCounter.getFPS each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.succeed(60))
    ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('calls fpsCounter.tick with the deltaTime each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.fpsCounter as unknown as { tick: unknown }).tick = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(0.016)
  }))

  it.effect('updates fpsElement.textContent when fpsElement is non-null', () => Effect.gen(function* () {
    // Use a plain stub instead of document.createElement (env is 'node', not jsdom)
    const fpsElement = { textContent: '' } as unknown as HTMLElement
    const deps = yield* makeDeps(false)
    const depsWithEl: FrameHandlerDeps = { ...deps, fpsElement: Option.some(fpsElement) }
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(42))

    yield* runFrame(depsWithEl, services)

    expect(fpsElement.textContent).toBe('42.0')
  }))
})

describe('adaptive performance mode', () => {
  it.effect('suspends adaptive-quality evaluation and never calls updateSettings when session is paused', () => Effect.gen(function* () {
    // FR-1.4: pause-menu overhead can temporarily tank FPS; suppress adaptive-quality
    // switches while paused so a low-FPS pause event does not downgrade graphics.
    const deps = yield* makeDeps(false)
    MutableRef.set(deps.sessionPausedRef, true)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'high' as const })
    )
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
    // Return very low FPS to ensure adaptive-quality WOULD fire if not paused
    ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(10))

    yield* runFrame(deps, services)

    // Even with low FPS + adaptivePerformanceMode=true, updateSettings must NOT be called when paused
    expect(updateSpy).not.toHaveBeenCalled()
  }))

  it.effect('does not auto-degrade quality when adaptivePerformanceMode is disabled', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: false, graphicsQuality: 'high' as const })
    )
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
    ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(100))

    yield* runFrame(deps, services)

    expect(updateSpy).not.toHaveBeenCalled()
  }))

  it.effect('lowers graphicsQuality when adaptivePerformanceMode is enabled and FPS drops', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'high' as const })
    )
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
    ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(100))

    yield* runFrame(deps, services)

    expect(updateSpy).toHaveBeenCalledWith({ graphicsQuality: 'medium' })
  }))

  it.effect('lowers renderDistance when adaptivePerformanceMode is enabled and quality is already low', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'low' as const, renderDistance: 8 })
    )
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
    ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(100))

    yield* runFrame(deps, services)

    expect(updateSpy).toHaveBeenCalledWith({ renderDistance: 7 })
  }))
})

// ---------------------------------------------------------------------------
// Step 11: HUD render
// ---------------------------------------------------------------------------

describe('step 11 — HUD render', () => {
  it.effect('calls hotbarRenderer.render every frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.hotbarRenderer as unknown as { render: unknown }).render = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))
})
