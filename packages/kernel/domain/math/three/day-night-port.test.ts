import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import { ColorPortSchema } from './day-night-port'

describe('ColorPortSchema', () => {
  it('accepts an object with setHSL and lerpColors methods', () => {
    const valid = { setHSL: () => {}, lerpColors: () => {} }
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)(valid)).not.toThrow()
  })

  it('rejects a plain object missing setHSL', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)({ lerpColors: () => {} })).toThrow()
  })

  it('rejects a plain object missing lerpColors', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)({ setHSL: () => {} })).toThrow()
  })

  it('rejects null', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)(null)).toThrow()
  })

  it('rejects a primitive string', () => {
    expect(() => Schema.decodeUnknownSync(ColorPortSchema)('red')).toThrow()
  })
})
