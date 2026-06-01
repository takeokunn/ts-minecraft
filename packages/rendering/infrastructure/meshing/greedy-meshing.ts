import { Option, Schema } from 'effect'
import { Chunk } from '@ts-minecraft/world'
import {
  type LightGrids,
} from '@ts-minecraft/block'

// Re-export all public API so meshing/index.ts and meshing-worker-pool.ts imports still work.
export * from './greedy-meshing-types'
export * from './greedy-meshing-quads'

import {
  EMPTY_MESHED_CHUNK,
  RawMeshDataSchema,
  MeshedChunk,
  RawMeshData,
  ChunkWorldOffset,
  GreedyMeshScratch,
  GreedyMeshResult,
  createGreedyMeshScratch,
} from './greedy-meshing-types'

import {
  MeshAccumulator,
  createAccumulator,
} from './greedy-meshing-quads'

import type { FacePassState } from './greedy-meshing-passes'

import { meshFluidFaces } from './greedy-meshing-fluids'
import {
  meshXPosFace,
  meshXNegFace,
  meshYPosFace,
  meshYNegFace,
  meshZPosFace,
  meshZNegFace,
} from './greedy-meshing-algorithms'

// ─── Main meshing function ───────────────────────────────────────────────────

export const greedyMeshChunk = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  transparentBlockIds: ReadonlySet<number> = new Set(),
  scratch: GreedyMeshScratch = createGreedyMeshScratch(),
  lightGrids?: LightGrids,
  transparentSolidBlockIds: ReadonlySet<number> = new Set(),
): GreedyMeshResult => {
  const opaqueAcc = createAccumulator()
  let waterAccStorage: MeshAccumulator | null = null
  let transparentSolidAccStorage: MeshAccumulator | null = null
  const transparentLookup = new Uint8Array(256)
  for (const blockId of transparentBlockIds) transparentLookup[blockId] = 1
  const transparentSolidLookup = new Uint8Array(256)
  for (const blockId of transparentSolidBlockIds) transparentSolidLookup[blockId] = 1

  const { maskCH, maskSS } = scratch
  const blocks: Readonly<Uint8Array> = chunk.blocks
  const getWaterAcc = (): MeshAccumulator => (waterAccStorage ??= createAccumulator())
  const getTransparentSolidAcc = (): MeshAccumulator => (transparentSolidAccStorage ??= createAccumulator())

  const state: FacePassState = {
    blocks,
    lightGrids,
    maskCH,
    maskSS,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    getTransparentSolidAcc,
    transparentSolidLookup,
    offset,
  }

  meshXPosFace(state)
  meshXNegFace(state)
  meshYPosFace(state)
  meshYNegFace(state)
  meshZPosFace(state)
  meshZNegFace(state)
  meshFluidFaces(
    blocks,
    Option.getOrUndefined(chunk.fluid),
    lightGrids,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    transparentSolidLookup,
    offset,
  )

  const toRawMeshData = (a: MeshAccumulator): RawMeshData =>
    Schema.decodeUnknownSync(RawMeshDataSchema)({
      positions: a.positions.subarray(0, a.vertexCount * 3),
      normals: a.normals.subarray(0, a.vertexCount * 3),
      colors: a.colors.subarray(0, a.vertexCount * 3),
      uvs: a.uvs.subarray(0, a.vertexCount * 2),
      tileIndexes: a.tileIndexes.subarray(0, a.vertexCount),
      indices: a.indices.subarray(0, a.indexCount),
      vertexCount: a.vertexCount,
      indexCount: a.indexCount,
    })

  const toMeshedChunk = (raw: RawMeshData): MeshedChunk => ({
    positions: raw.positions.slice(),
    normals: raw.normals.slice(),
    colors: raw.colors.slice(),
    uvs: raw.uvs.slice(),
    tileIndexes: raw.tileIndexes.slice(),
    indices: raw.indices.slice(),
  })

  const opaqueRaw = toRawMeshData(opaqueAcc)
  const waterRaw = waterAccStorage !== null ? toRawMeshData(waterAccStorage) : null
  const transparentSolidRaw = transparentSolidAccStorage !== null ? toRawMeshData(transparentSolidAccStorage) : null

  // Lazy cache: toMeshed() allocates sliced copies on first call, then returns the cached result.
  let _meshedCache: { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } | null = null
  const toMeshed = (): { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } => {
    if (_meshedCache === null) {
      _meshedCache = {
        opaque: toMeshedChunk(opaqueRaw),
        water: waterRaw !== null ? toMeshedChunk(waterRaw) : EMPTY_MESHED_CHUNK,
        transparentSolid: transparentSolidRaw !== null ? toMeshedChunk(transparentSolidRaw) : EMPTY_MESHED_CHUNK,
      }
    }
    return _meshedCache
  }

  return {
    opaqueRaw,
    waterRaw,
    transparentSolidRaw,
    toMeshed,
  }
}
