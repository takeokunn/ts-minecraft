import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { CameraRotationPortSchema, CameraTransformPortSchema } from './camera-port'

// ── Shared test-double factories ───────────────────────────────────────────

const makeRotation = () => ({
  rotation: { set: (_x: number, _y: number, _z: number, _order?: string) => {} },
})

const makeTransform = () => ({
  rotation: { set: (_x: number, _y: number, _z: number, _order?: string) => {} },
  position: { set: (_x: number, _y: number, _z: number) => {} },
  lookAt: (_x: number, _y: number, _z: number) => {},
})

// ── CameraRotationPortSchema ───────────────────────────────────────────────

describe('CameraRotationPortSchema', () => {
  it('accepts an object with rotation.set function', () => {
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)(makeRotation())).not.toThrow()
  })

  it('rejects when rotation.set is not a function', () => {
    const invalid = { rotation: { set: 42 } }
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)(invalid)).toThrow()
  })

  it('rejects when rotation is missing entirely', () => {
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)({})).toThrow()
  })

  it('rejects when rotation.set is missing (empty nested object)', () => {
    const invalid = { rotation: {} }
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)(invalid)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)(null)).toThrow()
  })

  it('rejects a plain string', () => {
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)('camera')).toThrow()
  })

  it('rejects a number', () => {
    expect(() => Schema.decodeUnknownSync(CameraRotationPortSchema)(0)).toThrow()
  })
})

// ── CameraTransformPortSchema ──────────────────────────────────────────────

describe('CameraTransformPortSchema', () => {
  it('accepts a fully-formed transform port', () => {
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(makeTransform())).not.toThrow()
  })

  it('rejects when rotation.set is not a function', () => {
    const invalid = { ...makeTransform(), rotation: { set: 'not-a-fn' } }
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(invalid)).toThrow()
  })

  it('rejects when position.set is not a function', () => {
    const invalid = { ...makeTransform(), position: { set: null } }
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(invalid)).toThrow()
  })

  it('rejects when lookAt is not a function', () => {
    const invalid = { ...makeTransform(), lookAt: 'not-a-fn' }
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(invalid)).toThrow()
  })

  it('rejects when position is missing', () => {
    const { position: _omitted, ...rest } = makeTransform()
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(rest)).toThrow()
  })

  it('rejects when lookAt is missing', () => {
    const { lookAt: _omitted, ...rest } = makeTransform()
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(rest)).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(null)).toThrow()
  })

  it('a CameraRotationPort (subset) is rejected — lacks position and lookAt', () => {
    const rotationOnly = makeRotation()
    expect(() => Schema.decodeUnknownSync(CameraTransformPortSchema)(rotationOnly)).toThrow()
  })
})
