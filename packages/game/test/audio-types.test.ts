import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { clamp01, clampPan, OscillatorWaveSchema, ToneHandleSchema } from '../domain/audio-types'

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
