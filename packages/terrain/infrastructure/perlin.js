// 2D Perlin Noise — Ken Perlin "Improved Noise" (2002)
// Output range: approximately [-1, 1] (after AMPLITUDE_SCALE)
import { Option } from 'effect';
// Fisher-Yates shuffle using the provided PRNG
function buildPerm(rand) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++)
        p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
    }
    return p;
}
// Quintic fade: 6t^5 - 15t^4 + 10t^3
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + t * (b - a);
// Gradient dot product for 8 unit vectors at 45-degree intervals.
// h is always in [0, 7] due to the & 7 mask applied by the caller.
const INV_SQRT2 = 1 / Math.SQRT2;
function dotGrad(perm, ix, iy, dx, dy) {
    const inner = perm[ix & 255];
    const h = perm[(inner + iy) & 255] & 7;
    switch (h) {
        case 0: return dx;
        case 1: return -dx;
        case 2: return dy;
        case 3: return -dy;
        case 4: return INV_SQRT2 * dx + INV_SQRT2 * dy;
        case 5: return -INV_SQRT2 * dx + INV_SQRT2 * dy;
        case 6: return INV_SQRT2 * dx - INV_SQRT2 * dy;
        default: return -INV_SQRT2 * dx - INV_SQRT2 * dy; // case 7
    }
}
// Scale factor: max raw amplitude ≈ 1/√2 for the diagonal-gradient worst case,
// so ×√2 normalises the range to approximately [-1, 1].
const AMPLITUDE_SCALE = Math.SQRT2;
export function createPerlinNoise2D(rand) {
    const perm = buildPerm(Option.getOrElse(Option.fromNullable(rand), () => Math.random));
    return (x, y) => {
        // Offset by 0.5 to avoid the trivial zero at integer lattice points
        // (Perlin noise evaluates to 0 at all lattice vertices)
        x = x + 0.5;
        y = y + 0.5;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const u = fade(fx);
        const v = fade(fy);
        const n00 = dotGrad(perm, ix, iy, fx, fy);
        const n10 = dotGrad(perm, ix + 1, iy, fx - 1, fy);
        const n01 = dotGrad(perm, ix, iy + 1, fx, fy - 1);
        const n11 = dotGrad(perm, ix + 1, iy + 1, fx - 1, fy - 1);
        return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * AMPLITUDE_SCALE;
    };
}
// ---------------------------------------------------------------------------
// 3D Perlin noise — classic Ken Perlin "Improved Noise" (2002) extended to 3D
// Output range: approximately [-1, 1]
// Used by cave carving in chunk-manager-service.ts.
// ---------------------------------------------------------------------------
// 12 canonical 3D gradient vectors — edges of a cube centred at origin.
// Selecting via h & 15 with 4 redundant entries (index 12..15) preserves
// uniform distribution while avoiding the expensive modulo-12.
// Reference: https://mrl.cs.nyu.edu/~perlin/noise/
const GRAD3_X = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, -1, 0, 0];
const GRAD3_Y = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, 1, -1, -1];
const GRAD3_Z = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 0, 1, -1];
// Max raw amplitude for 3D Perlin ≈ 1/√3; scaling by √3 normalises to ~[-1, 1].
// (Strict bound is ≤ 1 even after scaling, since worst-case gradient+fade combo
// is bounded by 1/√3.)
const AMPLITUDE_SCALE_3D = Math.sqrt(3);
function dotGrad3(perm, ix, iy, iz, dx, dy, dz) {
    const a = perm[ix & 255];
    const b = perm[(a + iy) & 255];
    const h = perm[(b + iz) & 255] & 15;
    return GRAD3_X[h] * dx + GRAD3_Y[h] * dy + GRAD3_Z[h] * dz;
}
export function createPerlinNoise3D(rand) {
    const perm = buildPerm(Option.getOrElse(Option.fromNullable(rand), () => Math.random));
    return (x, y, z) => {
        // Offset by 0.5 to avoid trivial zeros at integer lattice points
        x = x + 0.5;
        y = y + 0.5;
        z = z + 0.5;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;
        const u = fade(fx);
        const v = fade(fy);
        const w = fade(fz);
        // 8 corner gradient dot products
        const n000 = dotGrad3(perm, ix, iy, iz, fx, fy, fz);
        const n100 = dotGrad3(perm, ix + 1, iy, iz, fx - 1, fy, fz);
        const n010 = dotGrad3(perm, ix, iy + 1, iz, fx, fy - 1, fz);
        const n110 = dotGrad3(perm, ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
        const n001 = dotGrad3(perm, ix, iy, iz + 1, fx, fy, fz - 1);
        const n101 = dotGrad3(perm, ix + 1, iy, iz + 1, fx - 1, fy, fz - 1);
        const n011 = dotGrad3(perm, ix, iy + 1, iz + 1, fx, fy - 1, fz - 1);
        const n111 = dotGrad3(perm, ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
        // Tri-linear interpolation
        const nx00 = lerp(n000, n100, u);
        const nx10 = lerp(n010, n110, u);
        const nx01 = lerp(n001, n101, u);
        const nx11 = lerp(n011, n111, u);
        const nxy0 = lerp(nx00, nx10, v);
        const nxy1 = lerp(nx01, nx11, v);
        return lerp(nxy0, nxy1, w) * AMPLITUDE_SCALE_3D;
    };
}
//# sourceMappingURL=../../../dist/packages/terrain/infrastructure/perlin.js.map