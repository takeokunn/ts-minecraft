import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Ref } from 'effect'
import * as THREE from 'three'
import { DEBUG_FEATURE_FLAG_DEFAULTS, type DebugFeatureFlags } from '@ts-minecraft/app/debug-feature-flags'
import { renderStage } from '@ts-minecraft/app/frame/stages/render-stage'
import { createAttackSwingState } from '@ts-minecraft/presentation/hud/attack-swing'
import { resolvePreset } from '@ts-minecraft/game'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeGodRaysPassMock = () => ({
  enabled: false as boolean,
  sunScreenPos: new THREE.Vector2(),
  setNumSamples: (_n: number) => {},
})

const makeComposerMock = () => {
  let renderCalled = false
  return {
    render: () => { renderCalled = true },
    wasRenderCalled: () => renderCalled,
  }
}

const makeRendererMock = () => {
  let renderCalled = false
  return {
    render: (_scene: unknown, _camera: unknown) => { renderCalled = true },
    info: { render: { calls: 42 } },
    wasRenderCalled: () => renderCalled,
  }
}

const makeDeps = (renderer: ReturnType<typeof makeRendererMock>) => ({
  renderer: renderer as never,
  scene: {} as never,
  camera: new THREE.PerspectiveCamera() as never,
  lights: {
    light: {
      position: new THREE.Vector3(0, 80, 0),
    },
  } as never,
})

// Override Vector3.project on the instance so tests control what NDC coords the sun maps to.
const makeControlledSunPos = (ndcX: number, ndcY: number, ndcZ: number): THREE.Vector3 => {
  const v = new THREE.Vector3()
  v.project = () => { v.set(ndcX, ndcY, ndcZ); return v }
  return v
}

const makePerfHud = () => ({
  setDrawCalls: (_n: number) => Effect.void,
})

const makeServices = (flags: DebugFeatureFlags = DEBUG_FEATURE_FLAG_DEFAULTS) => ({
  perfHud: makePerfHud(),
  debugFeatureFlags: {
    getFlags: () => Effect.succeed({ ...flags }),
  },
})

const makeRefs = () => ({
  totalTimeSecsRef: Ref.unsafeMake(0),
  attackSwingStateRef: Ref.unsafeMake(createAttackSwingState()),
})

// ---------------------------------------------------------------------------
// render-stage tests
// ---------------------------------------------------------------------------

describe('render-stage', () => {
  describe('when no composer and no godRays pass', () => {
    it.effect('calls renderer.render directly', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: null, composerOrNull: null }
        const inputs = { resolvedGraphics: resolvePreset('low'), sunWorldPos: new THREE.Vector3() }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(renderer.wasRenderCalled()).toBe(true)
      })
    )
  })

  describe('when composer is present', () => {
    it.effect('calls composer.render instead of renderer.render', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const composer = makeComposerMock()
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: null, composerOrNull: composer as never }
        const inputs = { resolvedGraphics: resolvePreset('ultra'), sunWorldPos: new THREE.Vector3() }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(composer.wasRenderCalled()).toBe(true)
        expect(renderer.wasRenderCalled()).toBe(false)
      })
    )

    it.effect('falls back to renderer.render when post-processing debug flag is disabled', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const composer = makeComposerMock()
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: null, composerOrNull: composer as never }
        const inputs = { resolvedGraphics: resolvePreset('ultra'), sunWorldPos: new THREE.Vector3() }
        const services = makeServices({ ...DEBUG_FEATURE_FLAG_DEFAULTS, 'rendering.postProcessing': false })

        yield* renderStage(deps, services as never, makeRefs() as never, resolved, inputs)

        expect(composer.wasRenderCalled()).toBe(false)
        expect(renderer.wasRenderCalled()).toBe(true)
      })
    )
  })

  describe('godRays pass present + godRaysEnabled=true', () => {
    it.effect('enables god rays when sun is on screen', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const godRaysPass = makeGodRaysPassMock()
        const deps = makeDeps(renderer)
        // sunWorldPos.project() → NDC (0,0,0): sunU=0.5, sunV=0.5, z=0 (in front)
        const resolved = { godRaysPassOrNull: godRaysPass as never, composerOrNull: null }
        const resolvedGraphics = { ...resolvePreset('ultra'), godRaysEnabled: true, godRaysSamples: 40 }
        const inputs = { resolvedGraphics, sunWorldPos: makeControlledSunPos(0, 0, 0) }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(godRaysPass.enabled).toBe(true)
      })
    )

    it.effect('disables god rays when sun is behind camera (z > 1)', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const godRaysPass = makeGodRaysPassMock()
        godRaysPass.enabled = true
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: godRaysPass as never, composerOrNull: null }
        const resolvedGraphics = { ...resolvePreset('ultra'), godRaysEnabled: true, godRaysSamples: 40 }
        const inputs = { resolvedGraphics, sunWorldPos: makeControlledSunPos(0, 0, 1.5) }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(godRaysPass.enabled).toBe(false)
      })
    )

    it.effect('disables god rays when sun is off-screen', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const godRaysPass = makeGodRaysPassMock()
        godRaysPass.enabled = true
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: godRaysPass as never, composerOrNull: null }
        const resolvedGraphics = { ...resolvePreset('ultra'), godRaysEnabled: true, godRaysSamples: 40 }
        // NDC (2, 2, 0): sunU = (2+1)*0.5 = 1.5, sunV = 1.5 → off-screen (> 1.2)
        const inputs = { resolvedGraphics, sunWorldPos: makeControlledSunPos(2, 2, 0) }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(godRaysPass.enabled).toBe(false)
      })
    )

    it.effect('reduces sample count by 50% when sun is in outer 40% of screen', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const godRaysPass = { ...makeGodRaysPassMock(), samplesSet: 0 }
        godRaysPass.setNumSamples = (n: number) => { godRaysPass.samplesSet = n }
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: godRaysPass as never, composerOrNull: null }
        const resolvedGraphics = { ...resolvePreset('ultra'), godRaysEnabled: true, godRaysSamples: 40 }
        // NDC (0.8, 0, 0): sunU = (0.8+1)*0.5 = 0.9, sunV = 0.5
        // distFromCenter = sqrt((0.9-0.5)² + 0²) = 0.4 > 0.3 → half samples
        const inputs = { resolvedGraphics, sunWorldPos: makeControlledSunPos(0.8, 0, 0) }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        // adaptiveSamples = max(5, floor(40 * 0.5)) = 20
        expect(godRaysPass.samplesSet).toBe(20)
      })
    )

    it.effect('keeps full sample count when sun is near screen center', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const godRaysPass = { ...makeGodRaysPassMock(), samplesSet: 0 }
        godRaysPass.setNumSamples = (n: number) => { godRaysPass.samplesSet = n }
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: godRaysPass as never, composerOrNull: null }
        const resolvedGraphics = { ...resolvePreset('ultra'), godRaysEnabled: true, godRaysSamples: 40 }
        // NDC (0, 0, 0): sunU=0.5, sunV=0.5, distFromCenter=0 ≤ 0.3 → full samples
        const inputs = { resolvedGraphics, sunWorldPos: makeControlledSunPos(0, 0, 0) }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(godRaysPass.samplesSet).toBe(40)
      })
    )
  })

  describe('godRays pass present + godRaysEnabled=false', () => {
    it.effect('disables god rays pass regardless of sun position', () =>
      Effect.gen(function* () {
        const renderer = makeRendererMock()
        const godRaysPass = makeGodRaysPassMock()
        godRaysPass.enabled = true
        const deps = makeDeps(renderer)
        const resolved = { godRaysPassOrNull: godRaysPass as never, composerOrNull: null }
        const resolvedGraphics = { ...resolvePreset('ultra'), godRaysEnabled: false }
        const inputs = { resolvedGraphics, sunWorldPos: new THREE.Vector3() }

        yield* renderStage(deps, makeServices() as never, makeRefs() as never, resolved, inputs)

        expect(godRaysPass.enabled).toBe(false)
      })
    )
  })
})
