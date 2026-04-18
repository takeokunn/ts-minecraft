import { CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'

/** Smoothstep between edge0 and edge1 — classic Perlin smoothstep */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Mulberry32 PRNG step — deterministic, cheap, good enough for ore placement.
 * Input/output state is a 32-bit unsigned integer. Returns [nextState, uniform01].
 */
export const mulberry32 = (state: number): { state: number; value: number } => {
  let s = (state + 0x6d2b79f5) | 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { state: s, value }
}

/**
 * Seed a Mulberry32 RNG from chunk world coords + a per-ore salt.
 * Produces a 32-bit starting state; identical inputs → identical sequences.
 */
export const seedFromChunk = (wx: number, wz: number, saltX: number, saltZ: number): number => {
  // Combine with Math.imul for uniform bit mixing; |0 keeps everything 32-bit.
  let h = Math.imul(wx | 0, 0x27d4eb2d) ^ Math.imul(wz | 0, 0x85ebca6b)
  h ^= Math.imul(saltX | 0, 0xc2b2ae35)
  h ^= Math.imul(saltZ | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Deterministic fractional hash of 3 integer coordinates.
 * Returns a value in [0, 1). Used for bedrock probability at (wx, y, wz).
 */
export const hash3 = (wx: number, y: number, wz: number): number => {
  const v = Math.sin(wx * 127.1 + y * 311.7 + wz * 74.7) * 43758.5453
  return v - Math.floor(v)
}

export const chunkBlockIndexUnchecked = (x: number, y: number, z: number): number => y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE

export const fract = (value: number): number => value - Math.floor(value)

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export const computeRuggedness = (erosion: number, jaggedness: number): number => {
  const normalizedErosion = clamp01((erosion + 1) * 0.5)
  return clamp01((1 - normalizedErosion) * 0.6 + Math.abs(jaggedness) * 0.4)
}
