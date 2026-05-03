import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { postProcessingSetupStage } from '@ts-minecraft/app/frame/stages/post-processing-stage'
import { resolvePreset } from '@ts-minecraft/game'

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

describe('FR-014 — postProcessingSetupStage pass enable/setSize sync (extra)', () => {
  it.effect('enables SMAA pass at full resolution when smaaEnabled is true', () => Effect.gen(function* () {
    const smaa = makeSmaaPassMock()
    yield* postProcessingSetupStage(
      { renderer: makeRendererStub(800, 600), lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: null, dofPassOrNull: null, smaaPassOrNull: smaa as never, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),
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
        resolvedGraphics: resolvePreset('low'),
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
        resolvedGraphics: resolvePreset('ultra'),
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
        resolvedGraphics: resolvePreset('high'),
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
        resolvedGraphics: resolvePreset('high'),
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
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
        resolvedGraphics: resolvePreset('high'),
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
    expect(bloom.setSize).toHaveBeenCalledWith(800, 600)
  }))

  it.effect('uses pixelRatio=1 when renderer has no getPixelRatio function', () => Effect.gen(function* () {
    const bloom = makeBloomPassMock()
    const rendererNoGetPixelRatio = {
      domElement: { clientWidth: 400, clientHeight: 300 },
      capabilities: { isWebGL2: true },
    } as never
    yield* postProcessingSetupStage(
      { renderer: rendererNoGetPixelRatio, lights: makeLightsStub(true) },
      { gtaoPassOrNull: null, bloomPassOrNull: bloom as never, dofPassOrNull: null, smaaPassOrNull: null, godRaysPassOrNull: null },
      {
        resolvedGraphics: resolvePreset('high'),
        graphicsChanged: true,
        pixelRatioChanged: false,
        markShadowMapDirty: () => {},
      },
    )
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
        resolvedGraphics: resolvePreset('ultra'),
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
