// Re-exports from the domain source of truth. Infrastructure consumers keep
// importing from the same path without knowledge of the domain move.
export {
  createPerlinNoise2D,
  createPerlinNoise3D,
} from '../domain/perlin'

export type { RandFn, NoiseFn2D, NoiseFn3D } from '../domain/noise-primitives'
