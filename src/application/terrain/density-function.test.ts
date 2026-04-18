import { describe, it, expect } from 'vitest'
import { computeColumnY, type ChannelSamples } from './density-function'

const makeSamples = (c: number, e: number, p: number, j: number): ChannelSamples => {
  const continentalness = new Float64Array(256)
  const erosion = new Float64Array(256)
  const pv = new Float64Array(256)
  const jaggedness = new Float64Array(256)
  continentalness[0] = c
  erosion[0] = e
  pv[0] = p
  jaggedness[0] = j
  return { continentalness, erosion, pv, jaggedness }
}

describe('application/terrain/density-function', () => {
  it('deep ocean (C=-0.9) yields low Y in the low 30s', () => {
    const samples = makeSamples(-0.9, 0, 0, 0)
    const y = computeColumnY(samples, 0, 0)
    expect(y).toBeGreaterThanOrEqual(30)
    expect(y).toBeLessThanOrEqual(40)
  })

  it('coast/beach (C=-0.1) yields Y close to SEA_LEVEL (55-60)', () => {
    const samples = makeSamples(-0.1, 0, 0, 0)
    const y = computeColumnY(samples, 0, 0)
    expect(y).toBeGreaterThanOrEqual(55)
    expect(y).toBeLessThanOrEqual(62)
  })

  it('flat inland plains (C=0.3, E=0.8) yields Y in low-to-mid 70s', () => {
    const samples = makeSamples(0.3, 0.8, 0, 0)
    const y = computeColumnY(samples, 0, 0)
    expect(y).toBeGreaterThanOrEqual(70)
    expect(y).toBeLessThanOrEqual(80)
  })

  it('mountain peak (C=0.8, E=-0.5, PV=0.9) yields Y in 130-170 range', () => {
    const samples = makeSamples(0.8, -0.5, 0.9, 0)
    const y = computeColumnY(samples, 0, 0)
    expect(y).toBeGreaterThanOrEqual(130)
    expect(y).toBeLessThanOrEqual(170)
  })

  it('valley in mountains (PV=-0.9) carves down meaningfully below peak (PV=0.9)', () => {
    const peak = computeColumnY(makeSamples(0.8, -0.5, 0.9, 0), 0, 0)
    const valley = computeColumnY(makeSamples(0.8, -0.5, -0.9, 0), 0, 0)
    expect(valley).toBeLessThan(peak)
    expect(peak - valley).toBeGreaterThanOrEqual(20)
    expect(peak - valley).toBeLessThanOrEqual(120)
  })

  it('eroded plateau (E=0.9) suppresses jaggedness — J=0 and J=1 give same Y', () => {
    const noJag = computeColumnY(makeSamples(0.5, 0.9, 0.5, 0), 0, 0)
    const fullJag = computeColumnY(makeSamples(0.5, 0.9, 0.5, 1), 0, 0)
    expect(fullJag).toBe(noJag)
  })

  it('jagged mountain (E=-0.8) amplifies jaggedness — J=1 noticeably > J=0 (diff >= 10)', () => {
    const noJag = computeColumnY(makeSamples(0.8, -0.8, 0.5, 0), 0, 0)
    const fullJag = computeColumnY(makeSamples(0.8, -0.8, 0.5, 1), 0, 0)
    expect(fullJag - noJag).toBeGreaterThanOrEqual(10)
  })

  it('clamps Y to [1, 250] for extreme inputs', () => {
    const tooHigh = computeColumnY(makeSamples(1, -1, 1, 1), 0, 0)
    expect(tooHigh).toBeGreaterThanOrEqual(1)
    expect(tooHigh).toBeLessThanOrEqual(250)

    const tooLow = computeColumnY(makeSamples(-1, -1, -1, 1), 0, 0)
    expect(tooLow).toBeGreaterThanOrEqual(1)
    expect(tooLow).toBeLessThanOrEqual(250)
  })

  it('reads the correct index i = z * 16 + x from the Float64Array channels', () => {
    const continentalness = new Float64Array(256)
    const erosion = new Float64Array(256)
    const pv = new Float64Array(256)
    const jaggedness = new Float64Array(256)
    const targetX = 5
    const targetZ = 7
    const i = targetZ * 16 + targetX
    continentalness[i] = 0.8
    erosion[i] = -0.5
    pv[i] = 0.9
    jaggedness[i] = 0
    const samples: ChannelSamples = { continentalness, erosion, pv, jaggedness }
    const y = computeColumnY(samples, targetX, targetZ)
    expect(y).toBeGreaterThanOrEqual(130)
    expect(y).toBeLessThanOrEqual(170)
    const yZero = computeColumnY(samples, 0, 0)
    expect(yZero).toBeLessThan(y)
  })
})
