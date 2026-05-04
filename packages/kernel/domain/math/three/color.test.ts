import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { ColorSchema, makeColor, fromHex } from './color'

describe('ColorSchema', () => {
  it('decodes a valid color with all channels in [0,1]', () => {
    const result = Schema.decodeUnknownSync(ColorSchema)({ r: 1, g: 0, b: 0.5 })
    expect(result).toEqual({ r: 1, g: 0, b: 0.5 })
  })

  it('decodes a black color (all zeros)', () => {
    const result = Schema.decodeUnknownSync(ColorSchema)({ r: 0, g: 0, b: 0 })
    expect(result).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('decodes a white color (all ones)', () => {
    const result = Schema.decodeUnknownSync(ColorSchema)({ r: 1, g: 1, b: 1 })
    expect(result).toEqual({ r: 1, g: 1, b: 1 })
  })

  it('rejects r > 1', () => {
    expect(() => Schema.decodeUnknownSync(ColorSchema)({ r: 1.1, g: 0, b: 0 })).toThrow()
  })

  it('rejects g < 0', () => {
    expect(() => Schema.decodeUnknownSync(ColorSchema)({ r: 0, g: -0.1, b: 0 })).toThrow()
  })

  it('rejects NaN channel', () => {
    expect(() => Schema.decodeUnknownSync(ColorSchema)({ r: NaN, g: 0, b: 0 })).toThrow()
  })

  it('rejects Infinity channel', () => {
    expect(() => Schema.decodeUnknownSync(ColorSchema)({ r: 0, g: Infinity, b: 0 })).toThrow()
  })

  it('encode/decode roundtrip for ColorSchema', () => {
    const original = { r: 0.2, g: 0.5, b: 0.8 }
    const decoded = Schema.decodeUnknownSync(ColorSchema)(original)
    const encoded = Schema.encodeSync(ColorSchema)(decoded)
    expect(encoded).toEqual(original)
  })
})

describe('makeColor', () => {
  it('creates a Color from r, g, b components', () => {
    const c = makeColor(1, 0, 0)
    expect(c).toEqual({ r: 1, g: 0, b: 0 })
  })

  it('creates a mid-range color', () => {
    const c = makeColor(0.25, 0.5, 0.75)
    expect(c).toEqual({ r: 0.25, g: 0.5, b: 0.75 })
  })
})

describe('fromHex', () => {
  it('parses #ff0000 as red', () => {
    const c = fromHex('#ff0000')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
  })

  it('parses #0000ff as blue', () => {
    const c = fromHex('#0000ff')
    expect(c.r).toBeCloseTo(0)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(1)
  })

  it('parses #ffffff as white', () => {
    const c = fromHex('#ffffff')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(1)
    expect(c.b).toBeCloseTo(1)
  })

  it('parses #000000 as black', () => {
    const c = fromHex('#000000')
    expect(c.r).toBeCloseTo(0)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
  })

  it('parses hex strings without a # prefix', () => {
    const c = fromHex('00ff00')
    expect(c.r).toBeCloseTo(0)
    expect(c.g).toBeCloseTo(1)
    expect(c.b).toBeCloseTo(0)
  })
})
