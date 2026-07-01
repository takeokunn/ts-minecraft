import { describe, expect, it } from 'vitest'
import {
  BIAS,
  Y_STRIDE,
  XZ_STRIDE,
  toBlockPosition,
  positionKey,
  positionFromKey,
} from '@ts-minecraft/entity/domain/redstone/redstone-position-utils'

// ─── toBlockPosition ──────────────────────────────────────────────────────────
describe('toBlockPosition', () => {
  it('returns integer coords unchanged', () => {
    expect(toBlockPosition({ x: 3, y: 64, z: -5 })).toEqual({ x: 3, y: 64, z: -5 })
  })

  it('floors fractional x', () => {
    expect(toBlockPosition({ x: 1.9, y: 0, z: 0 })).toMatchObject({ x: 1 })
  })

  it('floors fractional y', () => {
    expect(toBlockPosition({ x: 0, y: 63.99, z: 0 })).toMatchObject({ y: 63 })
  })

  it('floors fractional z (negative)', () => {
    expect(toBlockPosition({ x: 0, y: 0, z: -0.1 })).toMatchObject({ z: -1 })
  })

  it('handles origin', () => {
    expect(toBlockPosition({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })
})

// ─── positionKey ─────────────────────────────────────────────────────────────
describe('positionKey', () => {
  it('produces a numeric key for the origin', () => {
    const key = positionKey({ x: 0, y: 0, z: 0 })
    // key = BIAS * XZ_STRIDE + 0 + BIAS = BIAS * (XZ_STRIDE + 1)
    expect(typeof key).toBe('number')
    expect(key).toBe(BIAS * XZ_STRIDE + BIAS)
  })

  it('produces distinct keys for different positions', () => {
    const k1 = positionKey({ x: 0, y: 0, z: 0 })
    const k2 = positionKey({ x: 1, y: 0, z: 0 })
    const k3 = positionKey({ x: 0, y: 1, z: 0 })
    const k4 = positionKey({ x: 0, y: 0, z: 1 })
    expect(new Set([k1, k2, k3, k4]).size).toBe(4)
  })

  it('handles negative x/z coordinates (BIAS keeps values non-negative)', () => {
    const key = positionKey({ x: -1, y: 0, z: -1 })
    expect(typeof key).toBe('number')
    expect(key).toBeGreaterThan(0)
  })

  it('floors fractional coordinates before encoding', () => {
    const keyFloat = positionKey({ x: 1.9, y: 0, z: 0 })
    const keyInt = positionKey({ x: 1, y: 0, z: 0 })
    expect(keyFloat).toBe(keyInt)
  })

  it('encodes y with Y_STRIDE spacing', () => {
    const k0 = positionKey({ x: 0, y: 0, z: 0 })
    const k1 = positionKey({ x: 0, y: 1, z: 0 })
    expect(k1 - k0).toBe(Y_STRIDE)
  })
})

// ─── positionFromKey ─────────────────────────────────────────────────────────
describe('positionFromKey', () => {
  it('round-trips the origin', () => {
    const key = positionKey({ x: 0, y: 0, z: 0 })
    expect(positionFromKey(key)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('round-trips a positive position', () => {
    const original = { x: 100, y: 64, z: 200 }
    const key = positionKey(original)
    expect(positionFromKey(key)).toEqual(original)
  })

  it('round-trips a negative position', () => {
    const original = { x: -50, y: 0, z: -100 }
    const key = positionKey(original)
    expect(positionFromKey(key)).toEqual(original)
  })

  it('round-trips the maximum safe coord boundary (±32767)', () => {
    const original = { x: 32767, y: 255, z: -32768 }
    const key = positionKey(original)
    expect(positionFromKey(key)).toEqual(original)
  })

  it('round-trips a mixed-sign coordinate', () => {
    const original = { x: -1, y: 100, z: 1 }
    const key = positionKey(original)
    expect(positionFromKey(key)).toEqual(original)
  })
})

// ─── key constants ────────────────────────────────────────────────────────────
describe('key encoding constants', () => {
  it('BIAS is 32768 (2^15)', () => {
    expect(BIAS).toBe(32768)
  })

  it('Y_STRIDE is 65536 (2^16)', () => {
    expect(Y_STRIDE).toBe(65536)
  })

  it('XZ_STRIDE is a multiple of Y_STRIDE', () => {
    expect(XZ_STRIDE % Y_STRIDE).toBe(0)
  })
})
