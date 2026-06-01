import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { computeColumnY, computeColumnYFromValues, type ChannelSamples } from '@ts-minecraft/world'

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

// ---------------------------------------------------------------------------
// computeColumnYFromValues — direct unit tests
// ---------------------------------------------------------------------------

describe('application/terrain/density-function — computeColumnYFromValues', () => {
  it('extreme inputs produce high but bounded Y (within 200–250)', () => {
    // max raw: OFFSET(1)=140 + FACTOR(-1)=1.3 * (PV_OFFSET(1)=40 + JAGGED_AMP(-1)=15) = 211.5
    // stays below the MAX_Y=250 clamp; verify it is high and within valid range
    const y = computeColumnYFromValues(1, -1, 1, 1)
    expect(y).toBeGreaterThanOrEqual(200)
    expect(y).toBeLessThanOrEqual(250)
  })

  it('clamps extreme low values to MIN_Y (1)', () => {
    // Low C, low erosion factor, deep valley PV → raw Y very low, clamps to 1
    const y = computeColumnYFromValues(-1, -1, -1, 1)
    expect(y).toBeGreaterThanOrEqual(1)
  })

  it('matches computeColumnY at the same channel values', () => {
    // Both functions should produce identical output for the same (C, E, PV, J) values.
    // computeColumnY reads from a Float64Array at index z*16+x; computeColumnYFromValues
    // takes values directly — should be byte-identical.
    const c = 0.3, e = 0.5, p = 0.2, j = 0.0
    const direct = computeColumnYFromValues(c, e, p, j)
    const channelSamples: ChannelSamples = {
      continentalness: new Float64Array(256).fill(0),
      erosion: new Float64Array(256).fill(0),
      pv: new Float64Array(256).fill(0),
      jaggedness: new Float64Array(256).fill(0),
    }
    channelSamples.continentalness[0] = c
    channelSamples.erosion[0] = e
    channelSamples.pv[0] = p
    channelSamples.jaggedness[0] = j
    const viaArray = computeColumnY(channelSamples, 0, 0)
    expect(direct).toBe(viaArray)
  })

  it('returns an integer (rounded Y)', () => {
    const y = computeColumnYFromValues(0.5, 0, 0.3, 0.1)
    expect(Number.isInteger(y)).toBe(true)
  })

  it('higher PV produces higher Y (peaks-and-valleys effect)', () => {
    const valley = computeColumnYFromValues(0.5, -0.5, -1, 0)
    const peak = computeColumnYFromValues(0.5, -0.5, 1, 0)
    expect(peak).toBeGreaterThan(valley)
  })

  it('higher continentalness raises the base Y', () => {
    const ocean = computeColumnYFromValues(-0.5, 0, 0, 0)
    const inland = computeColumnYFromValues(0.5, 0, 0, 0)
    expect(inland).toBeGreaterThan(ocean)
  })
})
