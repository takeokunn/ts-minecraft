import { CHUNK_SIZE } from '@ts-minecraft/core'
import { evaluateSpline } from './spline'
import {
  OFFSET_SPLINE,
  FACTOR_SPLINE,
  PV_OFFSET,
  JAGGED_AMP,
} from './terrain-splines'

export type ChannelSamples = Readonly<{
  readonly continentalness: Float64Array
  readonly erosion: Float64Array
  readonly pv: Float64Array
  readonly jaggedness: Float64Array
}>

const MIN_Y = 1
const MAX_Y = 250

type ChannelValues = Readonly<{
  readonly continentalness: number
  readonly erosion: number
  readonly pv: number
  readonly jaggedness: number
}>

const columnSampleIndex = (x: number, z: number): number => z * CHUNK_SIZE + x

const sampleChannel = (samples: Float64Array, index: number): number => samples[index] as number

const readChannelValues = (noises: ChannelSamples, x: number, z: number): ChannelValues => {
  const index = columnSampleIndex(x, z)

  return {
    continentalness: sampleChannel(noises.continentalness, index),
    erosion: sampleChannel(noises.erosion, index),
    pv: sampleChannel(noises.pv, index),
    jaggedness: sampleChannel(noises.jaggedness, index),
  }
}

export const computeColumnYFromValues = (
  continentalness: number,
  erosion: number,
  pv: number,
  jaggedness: number,
): number => {
  const offset = evaluateSpline(OFFSET_SPLINE, continentalness)
  const factor = evaluateSpline(FACTOR_SPLINE, erosion)
  const pvOffset = evaluateSpline(PV_OFFSET, pv)
  const jaggedAmp = evaluateSpline(JAGGED_AMP, erosion)

  const y = offset + factor * (pvOffset + jaggedness * jaggedAmp)
  const clamped = Math.max(MIN_Y, Math.min(MAX_Y, Math.round(y)))
  return clamped
}

export const computeColumnY = (
  noises: ChannelSamples,
  x: number,
  z: number,
): number => {
  const values = readChannelValues(noises, x, z)

  return computeColumnYFromValues(
    values.continentalness,
    values.erosion,
    values.pv,
    values.jaggedness,
  )
}
