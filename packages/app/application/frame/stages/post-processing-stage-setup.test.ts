import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableRef } from 'effect'
import { postProcessingSetupStage } from '@ts-minecraft/app/frame/stages/post-processing-stage'
import { resolvePreset } from '@ts-minecraft/game'

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
    const dirtyCalledRef = MutableRef.make(false)
    const lights = { light: { castShadow: false } }
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: lights as never },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // high has shadowsEnabled: true
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => { MutableRef.set(dirtyCalledRef, true) },
      },
    )
    expect(MutableRef.get(dirtyCalledRef)).toBe(true)
    expect(lights.light.castShadow).toBe(true)
  }))

  it.effect('does NOT call markShadowMapDirty when shadow state is unchanged', () => Effect.gen(function* () {
    const dirtyCalledRef = MutableRef.make(false)
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),   // high has shadowsEnabled: true (same as stub)
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => { MutableRef.set(dirtyCalledRef, true) },
      },
    )
    expect(MutableRef.get(dirtyCalledRef)).toBe(false)
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

})
