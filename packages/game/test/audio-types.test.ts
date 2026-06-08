import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { clamp01, clampPan } from '../domain/audio-utils'
import { OscillatorWaveSchema, ToneHandleSchema, ToneRequestSchema } from '../domain/audio-types'

describe('clamp01', () => {
  it('returns 0 when input is 0', () => {
    expect(clamp01(0)).toBe(0)
  })

  it('returns 1 when input is 1', () => {
    expect(clamp01(1)).toBe(1)
  })

  it('returns 0.5 when input is 0.5', () => {
    expect(clamp01(0.5)).toBe(0.5)
  })

  it('clamps -0.1 to 0', () => {
    expect(clamp01(-0.1)).toBe(0)
  })

  it('clamps 1.1 to 1', () => {
    expect(clamp01(1.1)).toBe(1)
  })
})

describe('clampPan', () => {
  it('returns 0 when input is 0', () => {
    expect(clampPan(0)).toBe(0)
  })

  it('returns 1 when input is 1', () => {
    expect(clampPan(1)).toBe(1)
  })

  it('returns -1 when input is -1', () => {
    expect(clampPan(-1)).toBe(-1)
  })

  it('clamps 1.5 to 1', () => {
    expect(clampPan(1.5)).toBe(1)
  })

  it('clamps -1.5 to -1', () => {
    expect(clampPan(-1.5)).toBe(-1)
  })
})

describe('OscillatorWaveSchema', () => {
  const decode = Schema.decodeUnknownEither(OscillatorWaveSchema)

  it("accepts 'sine'", () => {
    expect(Either.isRight(decode('sine'))).toBe(true)
  })

  it("accepts 'square'", () => {
    expect(Either.isRight(decode('square'))).toBe(true)
  })

  it("accepts 'sawtooth'", () => {
    expect(Either.isRight(decode('sawtooth'))).toBe(true)
  })

  it("accepts 'triangle'", () => {
    expect(Either.isRight(decode('triangle'))).toBe(true)
  })

  it("accepts 'custom'", () => {
    expect(Either.isRight(decode('custom'))).toBe(true)
  })

  it("rejects 'invalid'", () => {
    expect(Either.isLeft(decode('invalid'))).toBe(true)
  })
})

describe('ToneHandleSchema', () => {
  const decode = Schema.decodeUnknownEither(ToneHandleSchema)

  it('accepts { id: 0 }', () => {
    expect(Either.isRight(decode({ id: 0 }))).toBe(true)
  })

  it('accepts { id: 42 }', () => {
    expect(Either.isRight(decode({ id: 42 }))).toBe(true)
  })

  it('rejects { id: -1 } (nonNegative constraint)', () => {
    expect(Either.isLeft(decode({ id: -1 }))).toBe(true)
  })

  it('rejects { id: 1.5 } (int constraint)', () => {
    expect(Either.isLeft(decode({ id: 1.5 }))).toBe(true)
  })
})

describe('ToneRequestSchema', () => {
  const decode = Schema.decodeUnknownEither(ToneRequestSchema)
  const baseRequest = {
    frequency: 440,
    durationMs: 100,
    gain: 0.5,
    wave: 'sine',
    loop: false,
  }

  it('defaults pan to 0 when omitted for backward compatible centered playback', () => {
    const result = decode(baseRequest)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.pan).toBe(0)
    }
  })

  it('accepts optional 3D position coordinates', () => {
    const result = decode({
      ...baseRequest,
      pan: 0.25,
      position: { x: 3, y: -2, z: 8 },
    })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.position).toEqual({ x: 3, y: -2, z: 8 })
    }
  })

  it('rejects non-finite 3D position coordinates', () => {
    expect(Either.isLeft(decode({
      ...baseRequest,
      position: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
    }))).toBe(true)
  })
})
