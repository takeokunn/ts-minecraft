// Infrastructure re-exports + Effect-wrapped port builder for NoiseServicePort.
// Pure domain types and math live in ../domain/noise-primitives.
export type {
  RandFn,
  NoiseFn2D,
  NoiseFn3D,
  TerrainChannelSamples,
  NoisePrimitives,
} from '../domain/noise-primitives'

export {
  mulberry32,
  normalizeNoise,
  WEYL_C,
  WEYL_E,
  WEYL_W,
  WEYL_J,
  WEYL_3D,
  SCALE_C,
  SCALE_E,
  SCALE_W,
  SCALE_J,
  toPV,
  computeOctaveNoise,
  computeTerrainChannels,
  createNoisePrimitives,
  noise2DBatchXY,
  noise3DBatchXYZ,
  octaveNoise2DBatchXY,
  noise2DBatch,
  octaveNoise2DBatch,
} from '../domain/noise-primitives'

export { createPerlinNoise2D, createPerlinNoise3D } from './perlin'
