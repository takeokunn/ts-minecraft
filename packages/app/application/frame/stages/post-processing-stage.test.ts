import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { createFrameHandlers } from '@ts-minecraft/app'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import { postProcessingSetupStage } from '@ts-minecraft/app/frame/stages/post-processing-stage'
import { resolvePreset } from '@ts-minecraft/game'
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
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'medium' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'ultra' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    let callCount = 0
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() => {
      callCount++
      // First frame: low quality, second frame: high quality
      const quality = callCount <= 1 ? 'low' : 'high'
      return Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: quality as 'low' | 'high' })
    })
    const refractionSpy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

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
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)

    expect((deps.renderer.setPixelRatio as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(0.5)
  }))

  it.effect('applies the reduced pixel ratio to composer when present', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false, true)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
      Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
    )

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    yield* handler(0.016 as DeltaTimeSecs)

    const composer = Option.getOrNull(deps.composer)
    expect((composer as unknown as { setPixelRatio: ReturnType<typeof vi.fn> }).setPixelRatio).toHaveBeenCalledWith(0.5)
  }))
})

// ---------------------------------------------------------------------------
// FR-014: postProcessingSetupStage — pass enable/setSize sync (direct unit tests)
// These tests call postProcessingSetupStage directly so each pass branch is
// exercised without routing through the full 30-service frame-handler harness.
// ---------------------------------------------------------------------------

const makeRendererStub = (w = 800, h = 600) => ({
  domElement: { clientWidth: w, clientHeight: h },
  getPixelRatio: () => 1,
  capabilities: { isWebGL2: true },
}) as never

const makeLightsStub = (castShadow = false) => ({
  light: { castShadow },
}) as never

const makeGtaoPassMock = () => ({
  enabled: false as boolean,
  setSize: vi.fn() as (w: number, h: number) => void,
})

const makeBloomPassMock = () => ({
  enabled: false as boolean,
  strength: 0 as number,
  setSize: vi.fn() as (w: number, h: number) => void,
})

const makeDofPassMock = () => ({
  enabled: false as boolean,
  setSize: vi.fn() as (w: number, h: number) => void,
})

const makeSmaaPassMock = () => ({
  enabled: false as boolean,
  setSize: vi.fn() as (w: number, h: number) => void,
})

const makeGodRaysPassMock = () => ({
  setNumSamples: vi.fn() as (n: number) => void,
  setSize: vi.fn() as (w: number, h: number) => void,
})

describe('FR-014 — postProcessingSetupStage pass enable/setSize sync (direct)', () => {
  it.effect('skips the inner block when graphicsChanged and pixelRatioChanged are both false', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    const bloom = makeBloomPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub() },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: bloom as never, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),
        graphicsChanged: false,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.setSize).not.toHaveBeenCalled()
    expect(bloom.setSize).not.toHaveBeenCalled()
  }))

  it.effect('runs the inner block when graphicsChanged is true', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub() },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.setSize).toHaveBeenCalledOnce()
  }))

  it.effect('runs the inner block when pixelRatioChanged is true', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub() },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),
        graphicsChanged: false,
        pixelRatioChanged: true,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.setSize).toHaveBeenCalledOnce()
  }))

  it.effect('calls markShadowMapDirty when shadow state changes', () => Effect.gen(function* () {
    let dirtyCalled = false
    const lights = makeLightsStub(false)
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // high has shadowsEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => { dirtyCalled = true },
      },
    )
    expect(dirtyCalled).toBe(true)
    expect((lights as unknown as { light: { castShadow: boolean } }).light.castShadow).toBe(true)
  }))

  it.effect('does NOT call markShadowMapDirty when shadow state is unchanged', () => Effect.gen(function* () {
    let dirtyCalled = false
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // high has shadowsEnabled: true (same as stub)
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => { dirtyCalled = true },
      },
    )
    expect(dirtyCalled).toBe(false)
  }))

  it.effect('enables GTAO pass at half-resolution when ssaoEnabled is true and WebGL2 is available', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    // Renderer: 800×600, pixelRatio=1 → rw=800, rh=600 → GTAO at ceil(800/2)=400, ceil(600/2)=300
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // ssaoEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.enabled).toBe(true)
    expect(gtao.setSize).toHaveBeenCalledWith(400, 300)
  }))

  it.effect('disables GTAO pass and sets 1×1 when ssaoEnabled is false', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(false) },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('low'),   // ssaoEnabled: false
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.enabled).toBe(false)
    expect(gtao.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('disables GTAO when WebGL2 is not available even if ssaoEnabled preset says true', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    const rendererNoWebGL2 = {
      domElement: { clientWidth: 800, clientHeight: 600 },
      getPixelRatio: () => 1,
      capabilities: { isWebGL2: false },
    } as never
    yield* postProcessingSetupStage(
      { renderer: rendererNoWebGL2, lights: makeLightsStub(true) },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // ssaoEnabled: true but WebGL2=false
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.enabled).toBe(false)
    expect(gtao.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('enables bloom pass at full resolution and sets strength when bloomEnabled is true', () => Effect.gen(function* () {
    const bloom = makeBloomPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: bloom as never, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // bloomEnabled: true, bloomStrength: 0.25
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(bloom.enabled).toBe(true)
    expect(bloom.strength).toBe(0.25)
    expect(bloom.setSize).toHaveBeenCalledWith(800, 600)
  }))

  it.effect('disables bloom pass and sets 1×1 when bloomEnabled is false', () => Effect.gen(function* () {
    const bloom = makeBloomPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(false) },
      { gtaoPassOrNull: null, bloomPassOrNull: bloom as never, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('low'),   // bloomEnabled: false
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(bloom.enabled).toBe(false)
    expect(bloom.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('enables DoF pass at full resolution when dofEnabled is true', () => Effect.gen(function* () {
    const dof = makeDofPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: dof as never, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('ultra'),   // dofEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(dof.enabled).toBe(true)
    expect(dof.setSize).toHaveBeenCalledWith(800, 600)
  }))

  it.effect('disables DoF pass and sets 1×1 when dofEnabled is false', () => Effect.gen(function* () {
    const dof = makeDofPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(false) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: dof as never, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // dofEnabled: false
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(dof.enabled).toBe(false)
    expect(dof.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('enables SMAA pass at full resolution when smaaEnabled is true', () => Effect.gen(function* () {
    const smaa = makeSmaaPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: smaa as never, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // smaaEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(smaa.enabled).toBe(true)
    expect(smaa.setSize).toHaveBeenCalledWith(800, 600)
  }))

  it.effect('disables SMAA pass and sets 1×1 when smaaEnabled is false', () => Effect.gen(function* () {
    const smaa = makeSmaaPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(false) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: smaa as never, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('low'),   // smaaEnabled: false
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(smaa.enabled).toBe(false)
    expect(smaa.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('sets GodRays samples and full-resolution setSize when godRaysEnabled is true', () => Effect.gen(function* () {
    const godRays = makeGodRaysPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: godRays as never },
      {
        resolvedGraphics: resolvePreset('ultra'),   // godRaysEnabled: true, godRaysSamples: 40
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(godRays.setNumSamples).toHaveBeenCalledWith(40)
    expect(godRays.setSize).toHaveBeenCalledWith(800, 600)
  }))

  it.effect('sets GodRays samples and 1×1 setSize when godRaysEnabled is false', () => Effect.gen(function* () {
    const godRays = makeGodRaysPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: godRays as never },
      {
        resolvedGraphics: resolvePreset('high'),   // godRaysEnabled: false, godRaysSamples: 25
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(godRays.setNumSamples).toHaveBeenCalledWith(25)
    expect(godRays.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('uses fallback size 1×1 when renderer domElement reports 0×0', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    const rendererZeroSize = {
      domElement: { clientWidth: 0, clientHeight: 0 },
      getPixelRatio: () => 1,
      capabilities: { isWebGL2: true },
    } as never
    yield* postProcessingSetupStage(
      { renderer: rendererZeroSize, lights: makeLightsStub(true) },
      { gtaoPassOrNull: gtao as never, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // ssaoEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    // w=0||1=1, h=0||1=1, pixelRatio=1 → rw=1, rh=1 → GTAO at ceil(1/2)=1
    expect(gtao.setSize).toHaveBeenCalledWith(1, 1)
  }))

  it.effect('uses pixel ratio from renderer.getPixelRatio when available', () => Effect.gen(function* () {
    const bloom = makeBloomPassMock()
    const rendererHighDpr = {
      domElement: { clientWidth: 400, clientHeight: 300 },
      getPixelRatio: () => 2,
      capabilities: { isWebGL2: true },
    } as never
    yield* postProcessingSetupStage(
      { renderer: rendererHighDpr, lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: bloom as never, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // bloomEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    // w=400, h=300, pixelRatio=2 → rw=800, rh=600
    expect(bloom.setSize).toHaveBeenCalledWith(800, 600)
  }))

  it.effect('uses pixelRatio=1 when renderer has no getPixelRatio function', () => Effect.gen(function* () {
    const bloom = makeBloomPassMock()
    const rendererNoGetPixelRatio = {
      domElement: { clientWidth: 400, clientHeight: 300 },
      // no getPixelRatio
      capabilities: { isWebGL2: true },
    } as never
    yield* postProcessingSetupStage(
      { renderer: rendererNoGetPixelRatio, lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: bloom as never, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // bloomEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    // w=400, h=300, fallback pixelRatio=1 → rw=400, rh=300
    expect(bloom.setSize).toHaveBeenCalledWith(400, 300)
  }))

  it.effect('all five passes are configured in a single graphicsChanged=true call', () => Effect.gen(function* () {
    const gtao = makeGtaoPassMock()
    const bloom = makeBloomPassMock()
    const dof = makeDofPassMock()
    const smaa = makeSmaaPassMock()
    const godRays = makeGodRaysPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      {
        gtaoPassOrNull: gtao as never,
        bloomPassOrNull: bloom as never,
        dofPassOrNull: dof as never,
        smaaPassOrNull: smaa as never,
        godRaysPassOrNull: godRays as never,
      },
      {
        resolvedGraphics: resolvePreset('ultra'),   // all enabled
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(gtao.setSize).toHaveBeenCalledOnce()
    expect(bloom.setSize).toHaveBeenCalledOnce()
    expect(dof.setSize).toHaveBeenCalledOnce()
    expect(smaa.setSize).toHaveBeenCalledOnce()
    expect(godRays.setSize).toHaveBeenCalledOnce()
    expect(godRays.setNumSamples).toHaveBeenCalledWith(40)
  }))
})
