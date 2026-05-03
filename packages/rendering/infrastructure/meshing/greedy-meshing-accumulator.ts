import { Schema } from 'effect'
import { getTileIndex, getTileUVs, FaceDir } from '../textures/block-texture-map'

// Performance boundary: pre-sized typed arrays for ~95% of chunks without reallocation.
// Previous pattern used number[].push() which triggers backing-store reallocation + copy as JS arrays grow.
// ensureCapacity() doubles buffers if a chunk exceeds this capacity (amortized O(1)).
export const INITIAL_QUAD_CAPACITY = 8192
export const INITIAL_VERTEX_CAPACITY = INITIAL_QUAD_CAPACITY * 4  // 4 verts per quad
export const INITIAL_INDEX_CAPACITY = INITIAL_QUAD_CAPACITY * 6   // 6 indices per quad (2 triangles)

export const MeshAccumulatorSchema = Schema.mutable(Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Int8Array),
  colors: Schema.instanceOf(Uint8Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  indexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}))
export type MeshAccumulator = Schema.Schema.Type<typeof MeshAccumulatorSchema>

export const createAccumulator = (): MeshAccumulator => ({
  positions: new Float32Array(INITIAL_VERTEX_CAPACITY * 3),
  normals: new Int8Array(INITIAL_VERTEX_CAPACITY * 3),
  colors: new Uint8Array(INITIAL_VERTEX_CAPACITY * 3),
  uvs: new Float32Array(INITIAL_VERTEX_CAPACITY * 2),
  indices: new Uint32Array(INITIAL_INDEX_CAPACITY),
  vertexCount: 0,
  indexCount: 0,
})

export const ensureCapacity = (acc: MeshAccumulator, additionalQuads: number): void => {
  const neededVerts = acc.vertexCount + additionalQuads * 4
  const neededIndices = acc.indexCount + additionalQuads * 6
  if (neededVerts * 3 > acc.positions.length) {
    const newCap = Math.max(acc.positions.length * 2, neededVerts * 3)
    const newPos = new Float32Array(newCap)
    newPos.set(acc.positions)
    acc.positions = newPos
    const newNorm = new Int8Array(newCap)
    newNorm.set(acc.normals)
    acc.normals = newNorm
    const newCol = new Uint8Array(newCap)
    newCol.set(acc.colors)
    acc.colors = newCol
    const newUvCap = Math.max(acc.uvs.length * 2, neededVerts * 2)
    const newUv = new Float32Array(newUvCap)
    newUv.set(acc.uvs)
    acc.uvs = newUv
  }
  if (neededIndices > acc.indices.length) {
    const newCap = Math.max(acc.indices.length * 2, neededIndices)
    const newIdx = new Uint32Array(newCap)
    newIdx.set(acc.indices)
    acc.indices = newIdx
  }
}

export const addQuad = (
  acc: MeshAccumulator,
  v0: readonly [number, number, number],
  v1: readonly [number, number, number],
  v2: readonly [number, number, number],
  v3: readonly [number, number, number],
  normal: readonly [number, number, number],
  blockId: number,
  ao: readonly [number, number, number, number],
  skyLight: readonly [number, number, number, number],
  blockLight: readonly [number, number, number, number],
  faceDir: FaceDir
): void => {
  ensureCapacity(acc, 1)

  const base = acc.vertexCount
  const pi = base * 3

  // Positions — 4 vertices × 3 components
  acc.positions[pi]     = v0[0]; acc.positions[pi + 1]  = v0[1]; acc.positions[pi + 2]  = v0[2]
  acc.positions[pi + 3] = v1[0]; acc.positions[pi + 4]  = v1[1]; acc.positions[pi + 5]  = v1[2]
  acc.positions[pi + 6] = v2[0]; acc.positions[pi + 7]  = v2[1]; acc.positions[pi + 8]  = v2[2]
  acc.positions[pi + 9] = v3[0]; acc.positions[pi + 10] = v3[1]; acc.positions[pi + 11] = v3[2]

  // Normals — same normal for all 4 vertices
  acc.normals[pi]     = normal[0]; acc.normals[pi + 1]  = normal[1]; acc.normals[pi + 2]  = normal[2]
  acc.normals[pi + 3] = normal[0]; acc.normals[pi + 4]  = normal[1]; acc.normals[pi + 5]  = normal[2]
  acc.normals[pi + 6] = normal[0]; acc.normals[pi + 7]  = normal[1]; acc.normals[pi + 8]  = normal[2]
  acc.normals[pi + 9] = normal[0]; acc.normals[pi + 10] = normal[1]; acc.normals[pi + 11] = normal[2]

  // Vertex colors encode three per-vertex factors normalized to [0,1] in the shader:
  //   R = AO factor (1.0 = no darkening)
  //   G = sky-light factor (skyLight / 15)
  //   B = block-light factor (blockLight / 15)
  // The fragment shader combines: light = max(G * sunIntensity, B); diffuse *= (0.15 + 0.85*light) * (0.7 + 0.3*R).
  const aoR0 = Math.round((1.0 - ao[0] * 0.2) * 255)
  const aoR1 = Math.round((1.0 - ao[1] * 0.2) * 255)
  const aoR2 = Math.round((1.0 - ao[2] * 0.2) * 255)
  const aoR3 = Math.round((1.0 - ao[3] * 0.2) * 255)
  const skG0 = Math.round((skyLight[0] / 15) * 255)
  const skG1 = Math.round((skyLight[1] / 15) * 255)
  const skG2 = Math.round((skyLight[2] / 15) * 255)
  const skG3 = Math.round((skyLight[3] / 15) * 255)
  const blB0 = Math.round((blockLight[0] / 15) * 255)
  const blB1 = Math.round((blockLight[1] / 15) * 255)
  const blB2 = Math.round((blockLight[2] / 15) * 255)
  const blB3 = Math.round((blockLight[3] / 15) * 255)
  acc.colors[pi]     = aoR0; acc.colors[pi + 1]  = skG0; acc.colors[pi + 2]  = blB0
  acc.colors[pi + 3] = aoR1; acc.colors[pi + 4]  = skG1; acc.colors[pi + 5]  = blB1
  acc.colors[pi + 6] = aoR2; acc.colors[pi + 7]  = skG2; acc.colors[pi + 8]  = blB2
  acc.colors[pi + 9] = aoR3; acc.colors[pi + 10] = skG3; acc.colors[pi + 11] = blB3

  // UV coordinates from atlas tile lookup
  // NOTE: mask packs blockId in bits 0-7 (supports 0-255); current max is 11 (COBBLESTONE)
  const { u0, v0: tv0, u1, v1: tv1 } = getTileUVs(getTileIndex(blockId, faceDir))
  const ui = base * 2
  acc.uvs[ui]     = u0; acc.uvs[ui + 1] = tv0
  acc.uvs[ui + 2] = u0; acc.uvs[ui + 3] = tv1
  acc.uvs[ui + 4] = u1; acc.uvs[ui + 5] = tv1
  acc.uvs[ui + 6] = u1; acc.uvs[ui + 7] = tv0

  // Indices — 2 triangles per quad
  const ii = acc.indexCount
  acc.indices[ii]     = base;     acc.indices[ii + 1] = base + 1; acc.indices[ii + 2] = base + 2
  acc.indices[ii + 3] = base;     acc.indices[ii + 4] = base + 2; acc.indices[ii + 5] = base + 3

  acc.vertexCount += 4
  acc.indexCount += 6
}
