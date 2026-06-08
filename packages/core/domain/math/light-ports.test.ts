import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import {
  LightTargetPortSchema,
  LightPortSchema,
  AmbientLightPortSchema,
  RendererPortSchema,
  SkyMaterialPortSchema,
} from './light-ports'
import { makeTestColorPort } from '../builders'

// ── Shared test-double factories ───────────────────────────────────────────

const makeLightTarget = () => ({
  position: { set: (_x: number, _y: number, _z: number) => {} },
  updateMatrixWorld: () => {},
})

const makeLight = () => ({
  intensity: 1.0,
  castShadow: true,
  color: makeTestColorPort(),
  position: {
    x: 0,
    y: 100,
    z: 0,
    set: (_x: number, _y: number, _z: number) => {},
  },
  target: makeLightTarget(),
  shadow: {
    camera: {
      far: 500,
      left: -100,
      right: 100,
      top: 100,
      bottom: -100,
      updateProjectionMatrix: () => {},
    },
  },
})

const makeSkyMaterial = () => ({
  uniforms: {
    sunPosition: { value: { set: (_x: number, _y: number, _z: number) => {} } },
    turbidity: { value: 10 },
    rayleigh: { value: 2 },
  },
})

// ── LightTargetPortSchema ──────────────────────────────────────────────────

describe('LightTargetPortSchema', () => {
  it('accepts a valid light target with position.set and updateMatrixWorld', () => {
    expect(() => Schema.decodeUnknownSync(LightTargetPortSchema)(makeLightTarget())).not.toThrow()
  })

  it('rejects object missing position.set (non-function)', () => {
    const invalid = { position: { set: 'not-a-function' }, updateMatrixWorld: () => {} }
    expect(() => Schema.decodeUnknownSync(LightTargetPortSchema)(invalid)).toThrow()
  })

  it('rejects object missing updateMatrixWorld', () => {
    const invalid = { position: { set: () => {} } }
    expect(() => Schema.decodeUnknownSync(LightTargetPortSchema)(invalid)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(LightTargetPortSchema)(null)).toThrow()
  })

  it('rejects a plain string', () => {
    expect(() => Schema.decodeUnknownSync(LightTargetPortSchema)('light-target')).toThrow()
  })
})

// ── LightPortSchema ────────────────────────────────────────────────────────

describe('LightPortSchema', () => {
  it('accepts a fully-formed light object', () => {
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(makeLight())).not.toThrow()
  })

  it('accepts intensity = 0 (lights-off state)', () => {
    const light = { ...makeLight(), intensity: 0 }
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(light)).not.toThrow()
  })

  it('rejects when intensity is missing', () => {
    const { intensity: _omitted, ...rest } = makeLight()
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(rest)).toThrow()
  })

  it('rejects when castShadow is a string instead of boolean', () => {
    const invalid = { ...makeLight(), castShadow: 'yes' }
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(invalid)).toThrow()
  })

  it('rejects when position.set is not a function', () => {
    const light = makeLight()
    const invalid = { ...light, position: { ...light.position, set: 42 } }
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(invalid)).toThrow()
  })

  it('rejects when shadow.camera.updateProjectionMatrix is not a function', () => {
    const light = makeLight()
    const invalid = {
      ...light,
      shadow: {
        camera: { ...light.shadow.camera, updateProjectionMatrix: null },
      },
    }
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(invalid)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(LightPortSchema)(null)).toThrow()
  })
})

// ── AmbientLightPortSchema ─────────────────────────────────────────────────

describe('AmbientLightPortSchema', () => {
  const AMBIENT_INTENSITY = 0.5

  it('accepts a valid ambient light', () => {
    const ambient = { intensity: AMBIENT_INTENSITY, color: makeTestColorPort() }
    expect(() => Schema.decodeUnknownSync(AmbientLightPortSchema)(ambient)).not.toThrow()
  })

  it('accepts intensity = 0', () => {
    const ambient = { intensity: 0, color: makeTestColorPort() }
    expect(() => Schema.decodeUnknownSync(AmbientLightPortSchema)(ambient)).not.toThrow()
  })

  it('rejects missing intensity', () => {
    const invalid = { color: makeTestColorPort() }
    expect(() => Schema.decodeUnknownSync(AmbientLightPortSchema)(invalid)).toThrow()
  })

  it('rejects missing color', () => {
    const invalid = { intensity: AMBIENT_INTENSITY }
    expect(() => Schema.decodeUnknownSync(AmbientLightPortSchema)(invalid)).toThrow()
  })

  it('rejects intensity as string', () => {
    const invalid = { intensity: 'bright', color: makeTestColorPort() }
    expect(() => Schema.decodeUnknownSync(AmbientLightPortSchema)(invalid)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(AmbientLightPortSchema)(null)).toThrow()
  })
})

// ── RendererPortSchema ─────────────────────────────────────────────────────

describe('RendererPortSchema', () => {
  it('accepts an object with setClearColor function', () => {
    const renderer = { setClearColor: (_c: unknown) => {} }
    expect(() => Schema.decodeUnknownSync(RendererPortSchema)(renderer)).not.toThrow()
  })

  it('rejects object where setClearColor is not a function', () => {
    const invalid = { setClearColor: 'rgba(0,0,0,1)' }
    expect(() => Schema.decodeUnknownSync(RendererPortSchema)(invalid)).toThrow()
  })

  it('rejects object missing setClearColor', () => {
    const invalid = {}
    expect(() => Schema.decodeUnknownSync(RendererPortSchema)(invalid)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(RendererPortSchema)(null)).toThrow()
  })

  it('rejects a primitive string', () => {
    expect(() => Schema.decodeUnknownSync(RendererPortSchema)('renderer')).toThrow()
  })
})

// ── SkyMaterialPortSchema ──────────────────────────────────────────────────

describe('SkyMaterialPortSchema', () => {
  it('accepts a valid sky material with all required uniforms', () => {
    expect(() => Schema.decodeUnknownSync(SkyMaterialPortSchema)(makeSkyMaterial())).not.toThrow()
  })

  it('accepts turbidity = 0', () => {
    const sky = makeSkyMaterial()
    sky.uniforms.turbidity.value = 0
    expect(() => Schema.decodeUnknownSync(SkyMaterialPortSchema)(sky)).not.toThrow()
  })

  it('rejects when sunPosition.value.set is not a function', () => {
    const sky = makeSkyMaterial()
    const invalid = {
      uniforms: {
        ...sky.uniforms,
        sunPosition: { value: { set: 42 } },
      },
    }
    expect(() => Schema.decodeUnknownSync(SkyMaterialPortSchema)(invalid)).toThrow()
  })

  it('rejects when turbidity.value is a string', () => {
    const sky = makeSkyMaterial()
    const invalid = {
      uniforms: {
        ...sky.uniforms,
        turbidity: { value: 'high' },
      },
    }
    expect(() => Schema.decodeUnknownSync(SkyMaterialPortSchema)(invalid)).toThrow()
  })

  it('rejects when rayleigh.value is missing', () => {
    const invalid = {
      uniforms: {
        sunPosition: { value: { set: () => {} } },
        turbidity: { value: 10 },
      },
    }
    expect(() => Schema.decodeUnknownSync(SkyMaterialPortSchema)(invalid)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(SkyMaterialPortSchema)(null)).toThrow()
  })
})
