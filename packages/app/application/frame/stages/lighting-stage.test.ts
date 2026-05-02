import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect, Option, Ref } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import { lightingStage } from '@ts-minecraft/app/frame/stages/lighting-stage'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import * as THREE from 'three'
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

// ---------------------------------------------------------------------------
// Step 2.5: Shadow map dirty flag
// These tests call lightingStage directly to isolate the shadow counter
// from cameraStage's renderDistance-change detection (which also fires
// markShadowMapDirty on the first frame).
// ---------------------------------------------------------------------------

// Minimal DayNightLights stub — lightingStage only reads it via updateDayNightCycle
const makeFakeEffectiveLights = () => ({
  light: {
    intensity: 1,
    castShadow: true,
    position: { set: () => {} },
    color: { setHSL: () => {} },
    target: { position: { set: () => {} }, updateMatrixWorld: () => {} },
    shadow: { camera: { left: -128, right: 128, top: 128, bottom: -128, updateProjectionMatrix: () => {} } },
  } as unknown as THREE.DirectionalLight,
  ambientLight: {
    intensity: 0.3,
    color: { setHSL: () => {} },
  } as unknown as THREE.AmbientLight,
  renderer: { setClearColor: () => {} } as unknown as THREE.WebGLRenderer,
  skyNight: new THREE.Color(0x000000),
  skyDay: new THREE.Color(0x88ccff),
  skyCurrent: new THREE.Color(),
  sky: Option.none(),
})

const makeLightingServices = () => ({
  timeService: {
    advanceTick: () => Effect.void,
    getTimeOfDay: () => Effect.succeed(0.5),
    isNight: () => Effect.succeed(false),
    setDayLength: () => Effect.void,
    setTimeOfDay: () => Effect.void,
    getDayLength: () => Effect.succeed(1200),
  },
  musicManager: { updateFromContext: () => Effect.void },
  chunkMeshService: { setSunIntensity: () => Effect.void },
})

describe('step 2.5 — shadow map dirty flag', () => {
  it.effect('marks shadowMap.needsUpdate=true on the 8th frame when castShadow=true', () =>
    Effect.gen(function* () {
      const shadowUpdateCounterRef = yield* Ref.make(0)
      const state = { needsUpdate: false }
      const markShadowMapDirty = () => { state.needsUpdate = true }
      const deps = {
        lights: { light: { castShadow: true } },
        renderer: {},
      }
      const services = makeLightingServices()
      const effectiveLights = makeFakeEffectiveLights()
      const inputs = { deltaTime: 0.016 as DeltaTimeSecs, effectiveLights, playerPos: { x: 0, y: 64, z: 0 }, markShadowMapDirty }

      // 7 frames — counter increments 1→7; shadowFrame never reaches 0 again yet.
      yield* Effect.forEach(Arr.makeBy(7, (i) => i), () =>
        lightingStage(deps as never, services as never, { shadowUpdateCounterRef }, inputs),
        { concurrency: 1 },
      )
      expect(state.needsUpdate).toBe(false)

      // 8th frame: (7+1)%8=0 → shadowFrame===0 && castShadow=true → triggers dirty.
      yield* lightingStage(deps as never, services as never, { shadowUpdateCounterRef }, inputs)
      expect(state.needsUpdate).toBe(true)
    })
  )

  it.effect('does NOT mark shadowMap.needsUpdate when castShadow=false', () =>
    Effect.gen(function* () {
      const shadowUpdateCounterRef = yield* Ref.make(0)
      const state = { needsUpdate: false }
      const markShadowMapDirty = () => { state.needsUpdate = true }
      const deps = {
        lights: { light: { castShadow: false } },
        renderer: {},
      }
      const services = makeLightingServices()
      const effectiveLights = makeFakeEffectiveLights()
      const inputs = { deltaTime: 0.016 as DeltaTimeSecs, effectiveLights, playerPos: { x: 0, y: 64, z: 0 }, markShadowMapDirty }

      // 8 full frames — counter wraps to 0 on the 8th, but castShadow=false suppresses it.
      yield* Effect.forEach(Arr.makeBy(8, (i) => i), () =>
        lightingStage(deps as never, services as never, { shadowUpdateCounterRef }, inputs),
        { concurrency: 1 },
      )
      expect(state.needsUpdate).toBe(false)
    })
  )
})
