// 2D Perlin Noise — Ken Perlin "Improved Noise" (2002)
// Output range: approximately [-1, 1] (after AMPLITUDE_SCALE)

export type RandFn = () => number

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

// Quintic fade: 6t^5 - 15t^4 + 10t^3
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

// Gradient dot product for 8 unit vectors at 45-degree intervals.
// h is always in [0, 7] due to the & 7 mask applied by the caller.
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
    default: return -INV_SQRT2 * dx - INV_SQRT2 * dy  // case 7
  }
}

// Scale factor: max raw amplitude ≈ 1/√2 for the diagonal-gradient worst case,
// so ×√2 normalises the range to approximately [-1, 1].
const AMPLITUDE_SCALE = Math.SQRT2

export type NoiseFn2D = (x: number, y: number) => number

export function createPerlinNoise2D(rand?: RandFn): NoiseFn2D {
  const perm = buildPerm(rand ?? Math.random)
  return (x: number, y: number): number => {
    // Offset by 0.5 to avoid the trivial zero at integer lattice points
    // (Perlin noise evaluates to 0 at all lattice vertices)
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
