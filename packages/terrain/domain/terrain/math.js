import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel';
// t*t*(3-2*t) smoothstep — classic Perlin smooth curve
export const smoothstep = (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};
// Mulberry32 PRNG step — cheap 32-bit PRNG; returns {nextState, value∈[0,1)}.
export const mulberry32 = (state) => {
    let s = (state + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return { state: s, value };
};
// Seed Mulberry32 from chunk world coords + per-ore salt; identical inputs → identical sequences.
export const seedFromChunk = (wx, wz, saltX, saltZ) => {
    // Combine with Math.imul for uniform bit mixing; |0 keeps everything 32-bit.
    let h = Math.imul(wx | 0, 0x27d4eb2d) ^ Math.imul(wz | 0, 0x85ebca6b);
    h ^= Math.imul(saltX | 0, 0xc2b2ae35);
    h ^= Math.imul(saltZ | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
};
// Sine-based fractional hash of 3 coords → [0,1). Used for bedrock probability.
export const hash3 = (wx, y, wz) => {
    const v = Math.sin(wx * 127.1 + y * 311.7 + wz * 74.7) * 43758.5453;
    return v - Math.floor(v);
};
export const chunkBlockIndexUnchecked = (x, y, z) => y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE;
export const fract = (value) => value - Math.floor(value);
export const clamp01 = (value) => Math.max(0, Math.min(1, value));
export const computeRuggedness = (erosion, jaggedness) => {
    const normalizedErosion = clamp01((erosion + 1) * 0.5);
    return clamp01((1 - normalizedErosion) * 0.6 + Math.abs(jaggedness) * 0.4);
};
//# sourceMappingURL=../../../../dist/packages/terrain/domain/terrain/math.js.map