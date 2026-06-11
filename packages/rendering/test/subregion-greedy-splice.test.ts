import { describe, it, expect } from 'vitest'
import {
  quadAxisDepth,
  quadIsAffected,
  splitQuads,
  decodeRaw,
  concatQuads,
  spliceMesh,
} from '../infrastructure/meshing/subregion-greedy-splice'
import type { RawMeshData } from '../infrastructure/meshing/greedy-meshing-types'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeQuad = (
  pos: readonly [number, number, number],
  normal: readonly [number, number, number],
): { positions: Float32Array; normals: Int8Array } => {
  const positions = new Float32Array(4 * 3)
  const normals = new Int8Array(4 * 3)
  for (let v = 0; v < 4; v++) {
    positions[v * 3]     = pos[0]
    positions[v * 3 + 1] = pos[1]
    positions[v * 3 + 2] = pos[2]
    normals[v * 3]     = normal[0]
    normals[v * 3 + 1] = normal[1]
    normals[v * 3 + 2] = normal[2]
  }
  return { positions, normals }
}

const makeRawMesh = (quadCount: number): RawMeshData => {
  const verts = quadCount * 4
  const positions = new Float32Array(verts * 3)
  const normals = new Int8Array(verts * 3)
  const colors = new Uint8Array(verts * 3)
  const uvs = new Float32Array(verts * 2)
  const tileIndexes = new Float32Array(verts)
  const indices = new Uint32Array(quadCount * 6)
  for (let q = 0; q < quadCount; q++) {
    const vBase = q * 4
    indices[q * 6]     = vBase
    indices[q * 6 + 1] = vBase + 1
    indices[q * 6 + 2] = vBase + 2
    indices[q * 6 + 3] = vBase
    indices[q * 6 + 4] = vBase + 2
    indices[q * 6 + 5] = vBase + 3
  }
  return { positions, normals, colors, uvs, tileIndexes, indices, vertexCount: verts, indexCount: quadCount * 6 }
}

// ─── quadAxisDepth ────────────────────────────────────────────────────────────

describe('quadAxisDepth', () => {
  const offset = { wx: 0, wz: 0 }

  it('X+ normal: classifies as x axis, depth = round(px) - 1', () => {
    const { positions, normals } = makeQuad([5, 10, 3], [1, 0, 0])
    const result = quadAxisDepth(positions, normals, 0, offset)
    expect(result).not.toBeNull()
    expect(result!.axis).toBe('x')
    expect(result!.depth).toBe(Math.round(5) - 1)
  })

  it('X- normal: classifies as x axis, depth = round(px)', () => {
    const { positions, normals } = makeQuad([3, 10, 3], [-1, 0, 0])
    const result = quadAxisDepth(positions, normals, 0, offset)
    expect(result).not.toBeNull()
    expect(result!.axis).toBe('x')
    expect(result!.depth).toBe(Math.round(3))
  })

  it('Y+ normal: classifies as y axis, depth = floor(py - 1)', () => {
    const { positions, normals } = makeQuad([2, 8, 2], [0, 1, 0])
    const result = quadAxisDepth(positions, normals, 0, offset)
    expect(result).not.toBeNull()
    expect(result!.axis).toBe('y')
    expect(result!.depth).toBe(Math.floor(8 - 1 + 1e-6))
  })

  it('Y- normal: classifies as y axis, depth = floor(py)', () => {
    const { positions, normals } = makeQuad([2, 8, 2], [0, -1, 0])
    const result = quadAxisDepth(positions, normals, 0, offset)
    expect(result).not.toBeNull()
    expect(result!.axis).toBe('y')
    expect(result!.depth).toBe(Math.floor(8 + 1e-6))
  })

  it('Z+ normal: classifies as z axis, depth = round(pz) - 1', () => {
    const { positions, normals } = makeQuad([2, 8, 10], [0, 0, 1])
    const result = quadAxisDepth(positions, normals, 0, offset)
    expect(result).not.toBeNull()
    expect(result!.axis).toBe('z')
    expect(result!.depth).toBe(Math.round(10) - 1)
  })

  it('Z- normal: classifies as z axis, depth = round(pz)', () => {
    const { positions, normals } = makeQuad([2, 8, 7], [0, 0, -1])
    const result = quadAxisDepth(positions, normals, 0, offset)
    expect(result).not.toBeNull()
    expect(result!.axis).toBe('z')
    expect(result!.depth).toBe(Math.round(7))
  })

  it('respects world offset for X+', () => {
    const { positions, normals } = makeQuad([16 + 5, 0, 0], [1, 0, 0])
    const result = quadAxisDepth(positions, normals, 0, { wx: 16, wz: 0 })
    expect(result!.depth).toBe(Math.round(5) - 1)
  })
})

// ─── quadIsAffected ───────────────────────────────────────────────────────────

describe('quadIsAffected', () => {
  const ranges = {
    xRange: { start: 2, end: 5 },
    yRange: { start: 10, end: 15 },
    zRange: { start: 0, end: 3 },
  }

  it('returns true when depth is inside the axis range', () => {
    expect(quadIsAffected('x', 3, ranges)).toBe(true)
    expect(quadIsAffected('y', 10, ranges)).toBe(true)
    expect(quadIsAffected('z', 0, ranges)).toBe(true)
  })

  it('returns true at range boundaries (inclusive)', () => {
    expect(quadIsAffected('x', 2, ranges)).toBe(true)
    expect(quadIsAffected('x', 5, ranges)).toBe(true)
    expect(quadIsAffected('y', 15, ranges)).toBe(true)
  })

  it('returns false when depth is outside the axis range', () => {
    expect(quadIsAffected('x', 1, ranges)).toBe(false)
    expect(quadIsAffected('x', 6, ranges)).toBe(false)
    expect(quadIsAffected('y', 9, ranges)).toBe(false)
    expect(quadIsAffected('z', 4, ranges)).toBe(false)
  })
})

// ─── splitQuads ──────────────────────────────────────────────────────────────

describe('splitQuads', () => {
  it('returns all quad indices when selector always returns true', () => {
    const raw = makeRawMesh(3)
    const kept = splitQuads(raw, () => true)
    expect(kept).toEqual([0, 1, 2])
  })

  it('returns empty array when selector always returns false', () => {
    const raw = makeRawMesh(3)
    const kept = splitQuads(raw, () => false)
    expect(kept).toEqual([])
  })

  it('filters quads correctly by index', () => {
    const raw = makeRawMesh(4)
    const kept = splitQuads(raw, (q) => q % 2 === 0)
    expect(kept).toEqual([0, 2])
  })

  it('returns empty array for a mesh with 0 quads', () => {
    const raw = makeRawMesh(0)
    const kept = splitQuads(raw, () => true)
    expect(kept).toEqual([])
  })
})

// ─── decodeRaw ───────────────────────────────────────────────────────────────

describe('decodeRaw', () => {
  it('returns the same typed array references from the MeshedChunk', () => {
    const positions = new Float32Array([1, 2, 3])
    const normals = new Int8Array([0, 1, 0])
    const colors = new Uint8Array([255, 255, 255])
    const uvs = new Float32Array([0, 0, 1, 1])
    const tileIndexes = new Float32Array([5])
    const indices = new Uint32Array([0, 1, 2])
    const chunk = { positions, normals, colors, uvs, tileIndexes, indices }
    const raw = decodeRaw(chunk)
    expect(raw.positions).toBe(positions)
    expect(raw.normals).toBe(normals)
    expect(raw.colors).toBe(colors)
    expect(raw.uvs).toBe(uvs)
    expect(raw.tileIndexes).toBe(tileIndexes)
    expect(raw.indices).toBe(indices)
  })

  it('sets vertexCount = positions.length / 3', () => {
    const positions = new Float32Array(12) // 4 verts
    const chunk = {
      positions,
      normals: new Int8Array(12),
      colors: new Uint8Array(12),
      uvs: new Float32Array(8),
      tileIndexes: new Float32Array(4),
      indices: new Uint32Array(6),
    }
    const raw = decodeRaw(chunk)
    expect(raw.vertexCount).toBe(4)
  })

  it('sets indexCount = indices.length', () => {
    const positions = new Float32Array(12)
    const indices = new Uint32Array(6)
    const chunk = {
      positions,
      normals: new Int8Array(12),
      colors: new Uint8Array(12),
      uvs: new Float32Array(8),
      tileIndexes: new Float32Array(4),
      indices,
    }
    const raw = decodeRaw(chunk)
    expect(raw.indexCount).toBe(6)
  })
})

// ─── concatQuads ─────────────────────────────────────────────────────────────

describe('concatQuads', () => {
  it('copies a single quad into output buffers at offset 0', () => {
    const src = makeRawMesh(1)
    src.positions[0] = 5
    src.positions[1] = 10
    src.positions[2] = 15

    const totalVerts = 1 * 4
    const outPos = new Float32Array(totalVerts * 3)
    const outNormal = new Int8Array(totalVerts * 3)
    const outColor = new Uint8Array(totalVerts * 3)
    const outUv = new Float32Array(totalVerts * 2)
    const outTile = new Float32Array(totalVerts)
    const outIdx = new Uint32Array(1 * 6)

    const result = concatQuads(src, [0], outPos, outNormal, outColor, outUv, outTile, outIdx, 0, 0)
    expect(result.vertexCount).toBe(4)
    expect(result.indexCount).toBe(6)
    expect(outPos[0]).toBe(5)
    expect(outPos[1]).toBe(10)
    expect(outPos[2]).toBe(15)
  })

  it('remaps indices to the destination vertex offset', () => {
    const src = makeRawMesh(1) // indices: [0,1,2, 0,2,3]

    const outPos = new Float32Array(8 * 3)
    const outNormal = new Int8Array(8 * 3)
    const outColor = new Uint8Array(8 * 3)
    const outUv = new Float32Array(8 * 2)
    const outTile = new Float32Array(8)
    const outIdx = new Uint32Array(2 * 6)

    // write at vertex offset 4 (second quad slot)
    concatQuads(src, [0], outPos, outNormal, outColor, outUv, outTile, outIdx, 4, 6)
    expect([...outIdx.slice(6, 12)]).toEqual([4, 5, 6, 4, 6, 7])
  })
})

// ─── spliceMesh ──────────────────────────────────────────────────────────────

describe('spliceMesh', () => {
  it('produces a mesh with quads from both prev-kept and fresh-kept', () => {
    const prev = makeRawMesh(3)
    const fresh = makeRawMesh(2)
    const result = spliceMesh(prev, fresh, (q) => q < 2, () => true)
    // 2 from prev + 2 from fresh
    const quadCount = result.positions.length / (4 * 3)
    expect(quadCount).toBe(4)
    expect(result.indices.length).toBe(4 * 6)
  })

  it('returns empty mesh when no quads are selected from either side', () => {
    const prev = makeRawMesh(2)
    const fresh = makeRawMesh(2)
    const result = spliceMesh(prev, fresh, () => false, () => false)
    expect(result.positions.length).toBe(0)
    expect(result.indices.length).toBe(0)
  })

  it('result has no vertex/index aliasing with source buffers', () => {
    const prev = makeRawMesh(1)
    const fresh = makeRawMesh(1)
    const result = spliceMesh(prev, fresh, () => true, () => true)
    expect(result.positions).not.toBe(prev.positions)
    expect(result.positions).not.toBe(fresh.positions)
  })
})
