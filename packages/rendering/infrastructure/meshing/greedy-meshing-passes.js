import { addQuad } from './greedy-meshing-accumulator';
// ─── Mask packing helpers ────────────────────────────────────────────────────
//
// 32-bit mask cell layout:
//   bits  0-7   blockId (8 bits, max 255)
//   bits  8-9   ao quantized [0..3]
//   bits 10-11  sky corner 0 (2 bits)
//   bits 12-13  sky corner 1
//   bits 14-15  sky corner 2
//   bits 16-17  sky corner 3
//   bits 18-19  block corner 0
//   bits 20-21  block corner 1
//   bits 22-23  block corner 2
//   bits 24-25  block corner 3
//
// All four corner lights participate in mask-value equality, so greedy expansion
// only merges quads with identical lighting+ao+blockId — the expected vanilla
// trade-off (mostly merges interior of uniformly-lit slabs).
export const packMask = (blockId, ao, sk0, sk1, sk2, sk3, bl0, bl1, bl2, bl3) => (blockId & 0xff)
    | ((ao & 0x3) << 8)
    | ((sk0 & 0x3) << 10)
    | ((sk1 & 0x3) << 12)
    | ((sk2 & 0x3) << 14)
    | ((sk3 & 0x3) << 16)
    | ((bl0 & 0x3) << 18)
    | ((bl1 & 0x3) << 20)
    | ((bl2 & 0x3) << 22)
    | ((bl3 & 0x3) << 24);
// Dequantize 2-bit corner light to a 4-bit value (0..15). Spread evenly:
// 0 → 0, 1 → 5, 2 → 10, 3 → 15.
export const dequantLight = (q) => q * 5;
export const runGreedyExpansion = (mask, uSize, vSize, emitQuad) => {
    for (let u = 0; u < uSize; u++) {
        for (let v = 0; v < vSize; v++) {
            const mi = u * vSize + v;
            const maskValue = mask[mi];
            if (!maskValue)
                continue;
            let dv = 1;
            while (v + dv < vSize && mask[mi + dv] === maskValue) {
                dv++;
            }
            let du = 1;
            outer: while (u + du < uSize) {
                const rowStart = (u + du) * vSize + v;
                for (let k = 0; k < dv; k++) {
                    if (mask[rowStart + k] !== maskValue) {
                        break outer;
                    }
                }
                du++;
            }
            for (let a = u; a < u + du; a++) {
                const rowStart = a * vSize + v;
                mask.fill(0, rowStart, rowStart + dv);
            }
            emitQuad(u, v, du, dv, maskValue);
        }
    }
};
export const makeEmitQuad = (normal, faceDir, buildVertices, opaqueAcc, getWaterAcc, transparentLookup) => {
    const v0 = [0, 0, 0];
    const v1 = [0, 0, 0];
    const v2 = [0, 0, 0];
    const v3 = [0, 0, 0];
    const aoQuad = [0, 0, 0, 0];
    const skyQuad = [0, 0, 0, 0];
    const blockQuad = [0, 0, 0, 0];
    const verts = [v0, v1, v2, v3];
    return (u0, vCoord0, du, dv, maskValue, depth) => {
        const blockId = maskValue & 0xff;
        const ao = (maskValue >> 8) & 0x3;
        const targetAcc = transparentLookup[blockId] !== 0 ? getWaterAcc() : opaqueAcc;
        buildVertices(u0, vCoord0, du, dv, depth, verts);
        aoQuad[0] = ao;
        aoQuad[1] = ao;
        aoQuad[2] = ao;
        aoQuad[3] = ao;
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3);
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3);
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3);
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3);
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3);
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3);
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3);
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3);
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, faceDir, du, dv);
    };
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/meshing/greedy-meshing-passes.js.map