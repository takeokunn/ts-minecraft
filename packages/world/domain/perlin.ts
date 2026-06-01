// 2D/3D Perlin Noise — Ken Perlin "Improved Noise" (2002)
// Mirrors infrastructure/perlin.ts exactly. Domain source of truth for noise math.

import { Option } from 'effect'
import type { RandFn, NoiseFn2D, NoiseFn3D } from './noise-primitives'

// Fisher-Yates shuffle using the provided PRNG
function buildPerm(rand: RandFn): Uint8Array {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = p[i]!
    p[i] = p[j]!
    p[j] = tmp
  }
  return p
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

// 2D Perlin — switch-based dot product with 8 gradients at 45-degree intervals
const INV_SQRT2 = 1 / Math.SQRT2
function dotGrad(perm: Uint8Array, ix: number, iy: number, dx: number, dy: number): number {
  const inner = perm[ix & 255]!
  const h = perm[(inner + iy) & 255]! & 7
  switch (h) {
    case 0: return dx
    case 1: return -dx
    case 2: return dy
    case 3: return -dy
    case 4: return INV_SQRT2 * dx + INV_SQRT2 * dy
    case 5: return -INV_SQRT2 * dx + INV_SQRT2 * dy
    case 6: return INV_SQRT2 * dx - INV_SQRT2 * dy
    default: return -INV_SQRT2 * dx - INV_SQRT2 * dy
  }
}

const AMPLITUDE_SCALE = Math.SQRT2

export const createPerlinNoise2D = (rand?: RandFn): NoiseFn2D => {
  const perm = buildPerm(Option.getOrElse(Option.fromNullable(rand), () => Math.random))
  return (x: number, y: number): number => {
    x = x + 0.5
    y = y + 0.5
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const u = fade(fx)
    const v = fade(fy)
    const n00 = dotGrad(perm, ix, iy, fx, fy)
    const n10 = dotGrad(perm, ix + 1, iy, fx - 1, fy)
    const n01 = dotGrad(perm, ix, iy + 1, fx, fy - 1)
    const n11 = dotGrad(perm, ix + 1, iy + 1, fx - 1, fy - 1)
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * AMPLITUDE_SCALE
  }
}

// 3D Perlin — 12 canonical gradient vectors

const GRAD3_X: ReadonlyArray<number> = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, -1, 0, 0]
const GRAD3_Y: ReadonlyArray<number> = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, 1, -1, -1]
const GRAD3_Z: ReadonlyArray<number> = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 0, 1, -1]

const AMPLITUDE_SCALE_3D = Math.sqrt(3)

function dotGrad3(perm: Uint8Array, ix: number, iy: number, iz: number, dx: number, dy: number, dz: number): number {
  const a = perm[ix & 255]!
  const b = perm[(a + iy) & 255]!
  const h = perm[(b + iz) & 255]! & 15
  return GRAD3_X[h]! * dx + GRAD3_Y[h]! * dy + GRAD3_Z[h]! * dz
}

export const createPerlinNoise3D = (rand?: RandFn): NoiseFn3D => {
  const perm = buildPerm(Option.getOrElse(Option.fromNullable(rand), () => Math.random))
  return (x: number, y: number, z: number): number => {
    x = x + 0.5
    y = y + 0.5
    z = z + 0.5
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const iz = Math.floor(z)
    const fx = x - ix
    const fy = y - iy
    const fz = z - iz
    const u = fade(fx)
    const v = fade(fy)
    const w = fade(fz)

    const n000 = dotGrad3(perm, ix,     iy,     iz,     fx,     fy,     fz)
    const n100 = dotGrad3(perm, ix + 1, iy,     iz,     fx - 1, fy,     fz)
    const n010 = dotGrad3(perm, ix,     iy + 1, iz,     fx,     fy - 1, fz)
    const n110 = dotGrad3(perm, ix + 1, iy + 1, iz,     fx - 1, fy - 1, fz)
    const n001 = dotGrad3(perm, ix,     iy,     iz + 1, fx,     fy,     fz - 1)
    const n101 = dotGrad3(perm, ix + 1, iy,     iz + 1, fx - 1, fy,     fz - 1)
    const n011 = dotGrad3(perm, ix,     iy + 1, iz + 1, fx,     fy - 1, fz - 1)
    const n111 = dotGrad3(perm, ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1)

    const nx00 = lerp(n000, n100, u)
    const nx10 = lerp(n010, n110, u)
    const nx01 = lerp(n001, n101, u)
    const nx11 = lerp(n011, n111, u)
    const nxy0 = lerp(nx00, nx10, v)
    const nxy1 = lerp(nx01, nx11, v)
    return lerp(nxy0, nxy1, w) * AMPLITUDE_SCALE_3D
  }
}
