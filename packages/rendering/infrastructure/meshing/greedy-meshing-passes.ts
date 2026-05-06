import { FaceDir } from '../textures/block-texture-map'
import type { LightGrids } from '@ts-minecraft/world-state'
import { ChunkWorldOffset } from './greedy-meshing-types'
import { MeshAccumulator, addQuad } from './greedy-meshing-accumulator'

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

export const packMask = (
  blockId: number,
  ao: number,
  sk0: number,
  sk1: number,
  sk2: number,
  sk3: number,
  bl0: number,
  bl1: number,
  bl2: number,
  bl3: number
): number =>
  (blockId & 0xff)
  | ((ao & 0x3) << 8)
  | ((sk0 & 0x3) << 10)
  | ((sk1 & 0x3) << 12)
  | ((sk2 & 0x3) << 14)
  | ((sk3 & 0x3) << 16)
  | ((bl0 & 0x3) << 18)
  | ((bl1 & 0x3) << 20)
  | ((bl2 & 0x3) << 22)
  | ((bl3 & 0x3) << 24)

// Dequantize 2-bit corner light to a 4-bit value (0..15). Spread evenly:
// 0 → 0, 1 → 5, 2 → 10, 3 → 15.
export const dequantLight = (q: number): number => q * 5

// ─── Shared greedy expansion ────────────────────────────────────────────────
//
// Runs the 2-D greedy-merge loop over a pre-built face mask.
// The mask is a flat Uint32Array of size (uSize × vSize) where each cell encodes
// `packMask(blockId, ao, sky0..3, block0..3)`, or 0 for "no face here".
//
// For each maximal rectangle the callback `emitQuad` is invoked with
// (u0, v0, du, dv, maskValue) so the caller can unpack all face attributes.

type EmitQuad = (
  u0: number,
  v0: number,
  du: number,
  dv: number,
  maskValue: number
) => void

export const runGreedyExpansion = (
  mask: Uint32Array,
  uSize: number,
  vSize: number,
  emitQuad: EmitQuad
): void => {
  for (let u = 0; u < uSize; u++) {
    for (let v = 0; v < vSize; v++) {
      const mi = u * vSize + v
      const maskValue = mask[mi]!
      if (!maskValue) continue
      let dv = 1
      while (v + dv < vSize && mask[mi + dv] === maskValue) {
        dv++
      }
      let du = 1
      outer: while (u + du < uSize) {
        const rowStart = (u + du) * vSize + v
        for (let k = 0; k < dv; k++) {
          if (mask[rowStart + k] !== maskValue) {
            break outer
          }
        }
        du++
      }
      for (let a = u; a < u + du; a++) {
        const rowStart = a * vSize + v
        mask.fill(0, rowStart, rowStart + dv)
      }
      emitQuad(u, v, du, dv, maskValue)
    }
  }
}

// ─── Pass factory ────────────────────────────────────────────────────────────
//
// emitQuadFromMask unpacks the common maskValue fields and calls addQuad.
// The vertex positions are provided by the caller via a `buildVertices` callback
// that mutates the pre-allocated v0..v3 tuples in-place — zero allocation per quad.
//
// The inner mask-building loop (hot path, ~400k calls/chunk) is NOT factored through
// this helper; it stays inlined inside each pass call-site in greedyMeshChunk.

type BuildVertices = (
  u0: number,
  v0: number,
  du: number,
  dv: number,
  depth: number,
  verts: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
) => void

// 6-arg form of EmitQuad that includes the depth-slice (outer loop variable).
// Each pass creates one via makeEmitQuad and wraps it in a 5-arg lambda for runGreedyExpansion.
export type EmitQuadWithDepth = (u0: number, v0: number, du: number, dv: number, maskValue: number, depth: number) => void

export const makeEmitQuad = (
  normal: readonly [number, number, number],
  faceDir: FaceDir,
  buildVertices: BuildVertices,
  opaqueAcc: MeshAccumulator,
  getWaterAcc: () => MeshAccumulator,
  transparentLookup: Uint8Array,
): EmitQuadWithDepth => {
  const v0 = [0, 0, 0] as [number, number, number]
  const v1 = [0, 0, 0] as [number, number, number]
  const v2 = [0, 0, 0] as [number, number, number]
  const v3 = [0, 0, 0] as [number, number, number]
  const aoQuad    = [0, 0, 0, 0] as [number, number, number, number]
  const skyQuad   = [0, 0, 0, 0] as [number, number, number, number]
  const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
  const verts: [[number,number,number],[number,number,number],[number,number,number],[number,number,number]] = [v0, v1, v2, v3]
  return (u0: number, vCoord0: number, du: number, dv: number, maskValue: number, depth: number): void => {
    const blockId = maskValue & 0xff
    const ao = (maskValue >> 8) & 0x3
    const targetAcc = transparentLookup[blockId] !== 0 ? getWaterAcc() : opaqueAcc
    buildVertices(u0, vCoord0, du, dv, depth, verts)
    aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
    skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
    skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
    skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
    skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
    blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
    blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
    blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
    blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
    addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, faceDir, du, dv)
  }
}

// ─── Face-pass state bundle ──────────────────────────────────────────────────

export type FacePassState = {
  readonly blocks: Readonly<Uint8Array>
  readonly lightGrids: LightGrids | undefined
  readonly maskCH: Uint32Array
  readonly maskSS: Uint32Array
  readonly opaqueAcc: MeshAccumulator
  readonly getWaterAcc: () => MeshAccumulator
  readonly transparentLookup: Uint8Array
  readonly offset: ChunkWorldOffset
}
