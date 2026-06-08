/**
 * Tests for the core domain test-builders.
 *
 * Each builder is verified for:
 *   a) default value (no overrides)
 *   b) partial override
 *   c) full override
 */
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { Vector3Schema } from './math/vector3'
import { QuaternionSchema } from './math/quaternion'
import { ColorSchema } from './math/color'
import { PositionSchema } from './position'
import { ColorPortSchema } from './math/color-port'
import {
  makeTestVector3,
  makeTestQuaternion,
  makeTestColor,
  makeTestPosition,
  makeTestColorPort,
} from './builders'

// ── makeTestVector3 ────────────────────────────────────────────────────────

describe('makeTestVector3', () => {
  it('returns the zero vector by default', () => {
    expect(makeTestVector3()).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('partial override of x only', () => {
    expect(makeTestVector3({ x: 5 })).toEqual({ x: 5, y: 0, z: 0 })
  })

  it('partial override of y only', () => {
    expect(makeTestVector3({ y: -3 })).toEqual({ x: 0, y: -3, z: 0 })
  })

  it('partial override of z only', () => {
    expect(makeTestVector3({ z: 10 })).toEqual({ x: 0, y: 0, z: 10 })
  })

  it('full override produces the specified vector', () => {
    expect(makeTestVector3({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('default result is valid Vector3Schema', () => {
    expect(Schema.is(Vector3Schema)(makeTestVector3())).toBe(true)
  })

  it('overridden result is valid Vector3Schema', () => {
    expect(Schema.is(Vector3Schema)(makeTestVector3({ x: 100, y: -50.5, z: 0.001 }))).toBe(true)
  })
})

// ── makeTestQuaternion ─────────────────────────────────────────────────────

describe('makeTestQuaternion', () => {
  it('returns the identity quaternion by default', () => {
    expect(makeTestQuaternion()).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('partial override of w only', () => {
    expect(makeTestQuaternion({ w: 0 })).toEqual({ x: 0, y: 0, z: 0, w: 0 })
  })

  it('partial override of y only', () => {
    expect(makeTestQuaternion({ y: 0.707 })).toEqual({ x: 0, y: 0.707, z: 0, w: 1 })
  })

  it('full override produces the specified quaternion', () => {
    expect(makeTestQuaternion({ x: 0.5, y: 0.5, z: 0.5, w: 0.5 })).toEqual({
      x: 0.5,
      y: 0.5,
      z: 0.5,
      w: 0.5,
    })
  })

  it('default result is valid QuaternionSchema', () => {
    expect(Schema.is(QuaternionSchema)(makeTestQuaternion())).toBe(true)
  })

  it('overridden result is valid QuaternionSchema', () => {
    expect(Schema.is(QuaternionSchema)(makeTestQuaternion({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 }))).toBe(true)
  })
})

// ── makeTestColor ──────────────────────────────────────────────────────────

describe('makeTestColor', () => {
  const RED_COLOR = { r: 1, g: 0, b: 0 }

  it('returns pure red by default', () => {
    expect(makeTestColor()).toEqual(RED_COLOR)
  })

  it('partial override of g creates yellow-ish', () => {
    expect(makeTestColor({ g: 1 })).toEqual({ r: 1, g: 1, b: 0 })
  })

  it('full override produces the specified color', () => {
    const CUSTOM_COLOR = { r: 0.25, g: 0.5, b: 0.75 }
    expect(makeTestColor(CUSTOM_COLOR)).toEqual(CUSTOM_COLOR)
  })

  it('default result is valid ColorSchema', () => {
    expect(Schema.is(ColorSchema)(makeTestColor())).toBe(true)
  })

  it('overridden result is valid ColorSchema', () => {
    expect(Schema.is(ColorSchema)(makeTestColor({ r: 0, g: 0, b: 1 }))).toBe(true)
  })
})

// ── makeTestPosition ───────────────────────────────────────────────────────

describe('makeTestPosition', () => {
  it('returns origin by default', () => {
    expect(makeTestPosition()).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('partial override places player above ground', () => {
    expect(makeTestPosition({ y: 64 })).toEqual({ x: 0, y: 64, z: 0 })
  })

  it('full override produces an arbitrary position', () => {
    expect(makeTestPosition({ x: 100, y: 65, z: -200 })).toEqual({ x: 100, y: 65, z: -200 })
  })

  it('default result is valid PositionSchema', () => {
    expect(Schema.is(PositionSchema)(makeTestPosition())).toBe(true)
  })

  it('overridden result is valid PositionSchema', () => {
    expect(Schema.is(PositionSchema)(makeTestPosition({ x: -500, y: 0.5, z: 999 }))).toBe(true)
  })
})

// ── makeTestColorPort ──────────────────────────────────────────────────────

describe('makeTestColorPort', () => {
  it('returns a ColorPort with r, g, b, setHSL, lerpColors by default', () => {
    const port = makeTestColorPort()
    expect(port.r).toBe(0)
    expect(port.g).toBe(0)
    expect(port.b).toBe(0)
    expect(typeof port.setHSL).toBe('function')
    expect(typeof port.lerpColors).toBe('function')
  })

  it('partial override of r', () => {
    const port = makeTestColorPort({ r: 0.8 })
    expect(port.r).toBeCloseTo(0.8)
    expect(port.g).toBe(0)
    expect(port.b).toBe(0)
  })

  it('full channel override', () => {
    const port = makeTestColorPort({ r: 1, g: 0.5, b: 0.25 })
    expect(port.r).toBe(1)
    expect(port.g).toBe(0.5)
    expect(port.b).toBe(0.25)
  })

  it('default result satisfies ColorPortSchema', () => {
    expect(Schema.is(ColorPortSchema)(makeTestColorPort())).toBe(true)
  })

  it('custom setHSL function is preserved', () => {
    const customSetHSL = () => { /* no-op marker */ }
    const port = makeTestColorPort({ setHSL: customSetHSL })
    expect(port.setHSL).toBe(customSetHSL)
  })
})
