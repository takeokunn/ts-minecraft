import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { ColorPortSchema } from './day-night-port'

describe('ColorPortSchema', () => {
  it('accepts an RGB color object with setHSL and lerpColors methods', () => {
    const valid = { r: 0.1, g: 0.2, b: 0.3, setHSL: () => {}, lerpColors: () => {} }
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)(valid)).not.toThrow()
  })

  it('rejects a color-like object missing RGB channels', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)({ setHSL: () => {}, lerpColors: () => {} })).toThrow()
  })

  it('rejects a plain object missing setHSL', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)({ r: 0, g: 0, b: 0, lerpColors: () => {} })).toThrow()
  })

  it('rejects a plain object missing lerpColors', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)({ r: 0, g: 0, b: 0, setHSL: () => {} })).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)(null)).toThrow()
  })

  it('rejects a primitive string', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)('red')).toThrow()
  })
})
