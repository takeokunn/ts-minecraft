import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { GAMEPLAY_HUD_HIDDEN_CLASS } from '@ts-minecraft/presentation'
import { DEFAULT_SETTINGS } from '../../../test/frame-handler-test-kit/shared'
import { makeDeps } from '../../../test/frame-handler-test-kit/orchestration/deps'
import { makeInputService } from '../../../test/frame-handler-test-kit/presentation/input'
import {
  makeInventoryRenderer,
  makeSettingsOverlay,
} from '../../../test/frame-handler-test-kit/presentation/overlay'
import { makeServices } from '../../../test/frame-handler-test-kit/services'
import { runFrame } from '../../../test/frame-handler-test-kit/orchestration/harness'

const stubDocumentBodyClassList = (initialClasses: ReadonlySet<string> = new Set()): void => {
  const classes = new Set(initialClasses)
  vi.stubGlobal('document', {
    body: {
      classList: {
        contains: (name: string) => classes.has(name),
      },
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Step 9: FPS display
// ---------------------------------------------------------------------------

describe('step 9 — FPS display', () => {
  it.effect('uses fpsCounter.tick result for the frame FPS', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const fpsElement = { textContent: '' } as HTMLElement
    const depsWithEl: FrameHandlerDeps = { ...deps, fpsElement: Option.some(fpsElement) }
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const tickSpy = vi.fn(() => Effect.succeed(60))
    const getSpy = vi.fn(() => Effect.succeed(10))
    Object.assign(services.fpsCounter, { tick: tickSpy, getFPS: getSpy })

    yield* runFrame(depsWithEl, services)

    expect(tickSpy).toHaveBeenCalledOnce()
    expect(getSpy).not.toHaveBeenCalled()
    expect(fpsElement.textContent).toBe('60.0')
  }))

  it.effect('calls fpsCounter.tick with the deltaTime each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.succeed(0))
    Object.assign(services.fpsCounter, { tick: spy })

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(0.016)
  }))

  it.effect('updates fpsElement.textContent when fpsElement is non-null', () => Effect.gen(function* () {
    // Use a plain stub instead of document.createElement (env is 'node', not jsdom)
    const fpsElement = { textContent: '' } as HTMLElement
    const deps = yield* makeDeps(false)
    const depsWithEl: FrameHandlerDeps = { ...deps, fpsElement: Option.some(fpsElement) }
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.fpsCounter, { tick: vi.fn(() => Effect.succeed(42)) })

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
    Object.assign(services.settingsService, { getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'high' as const })) })
    const updateSpy = vi.fn(() => Effect.void)
    Object.assign(services.settingsService, { updateSettings: updateSpy })
    // Return very low FPS to ensure adaptive-quality WOULD fire if not paused
    Object.assign(services.fpsCounter, { tick: vi.fn(() => Effect.succeed(10)) })

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
    Object.assign(services.settingsService, { getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: false, graphicsQuality: 'high' as const })) })
    const updateSpy = vi.fn(() => Effect.void)
    Object.assign(services.settingsService, { updateSettings: updateSpy })
    Object.assign(services.fpsCounter, { tick: vi.fn(() => Effect.succeed(30)) })

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
    Object.assign(services.settingsService, { getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'high' as const })) })
    const updateSpy = vi.fn(() => Effect.void)
    Object.assign(services.settingsService, { updateSettings: updateSpy })
    Object.assign(services.fpsCounter, { tick: vi.fn(() => Effect.succeed(30)) })

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
    Object.assign(services.settingsService, { getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'low' as const, renderDistance: 8 })) })
    const updateSpy = vi.fn(() => Effect.void)
    Object.assign(services.settingsService, { updateSettings: updateSpy })
    Object.assign(services.fpsCounter, { tick: vi.fn(() => Effect.succeed(30)) })

    yield* runFrame(deps, services)

    expect(updateSpy).toHaveBeenCalledWith({ renderDistance: 7 })
  }))

  it.effect('lowers renderDistance even while chunk sync is pending', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.settingsService, { getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'low' as const, renderDistance: 8 })) })
    const updateSpy = vi.fn(() => Effect.void)
    Object.assign(services.settingsService, { updateSettings: updateSpy })
    Object.assign(services.fpsCounter, { tick: vi.fn(() => Effect.succeed(30)) })
    Object.assign(services.chunkManagerService, {
      loadChunksAroundPlayer: vi.fn(() => Effect.void),
      getLoadedChunks: vi.fn(() => Effect.succeed([{ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0), dirty: false }])),
    })
    Object.assign(services.worldRendererService, { syncChunksToScene: vi.fn(() => Effect.succeed(false)) })

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.016 as DeltaTimeSecs)

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
    Object.assign(services.hotbarRenderer, { render: spy })

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('skips hotbarRenderer.render while the gameplay HUD is hidden', () => Effect.gen(function* () {
    stubDocumentBodyClassList(new Set([GAMEPLAY_HUD_HIDDEN_CLASS]))
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    Object.assign(services.hotbarRenderer, { render: spy })

    yield* runFrame(deps, services)

    expect(spy).not.toHaveBeenCalled()
  }))
})
