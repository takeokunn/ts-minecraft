import { Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import type { LightGrids } from '@ts-minecraft/block/domain/light'
import {
  ChunkWorldOffset,
  GreedyMeshResult,
  GreedyMeshScratch,
  MeshedChunk,
  EMPTY_MESHED_CHUNK,
  createGreedyMeshScratch,
} from './greedy-meshing-types'
import { greedyMeshChunk } from './greedy-meshing'

// FR-4.1 dirty AABB describes the chunk-local subregion that changed due to a
// single block edit (or a small batch of edits). Both ends are inclusive.
//
//   minX, maxX ∈ [0, CHUNK_SIZE)
//   minY, maxY ∈ [0, CHUNK_HEIGHT)
//   minZ, maxZ ∈ [0, CHUNK_SIZE)
//
// The same structural type is re-declared in `meshing-worker-pool.ts` (same
// shape, same field names) — the worker-pool module deliberately keeps a
// schema-free copy to avoid pulling Schema/CHUNK_SIZE into the Worker bundle.
// The two definitions are kept in sync by `dirtyAABBStructureMatches` (test).
export const DirtyAABBSchema = Schema.Struct({
  minX: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)),
  maxX: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)),
  minY: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_HEIGHT - 1)),
  maxY: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_HEIGHT - 1)),
  minZ: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)),
  maxZ: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)),
})
export type DirtyAABB = Schema.Schema.Type<typeof DirtyAABBSchema>

// Inclusive 1-D slice index range along one axis.
export type SliceRange = { readonly start: number; readonly end: number }

// Compute the per-axis slice ranges that may be affected by a block change
// inside the AABB. AO and lighting both sample neighbours within ±1 in the
// tangent directions, AND face exposure for slice d reads voxels at slice d±1
// — so we expand the AABB by 1 voxel on each side to preserve face merging
// correctness across the boundary.
//
// Slices entirely outside the expanded range have ZERO input voxels inside
// the AABB and therefore yield byte-identical mask cells (and quads) before
// and after the edit. This is the splice invariant.
const expandedRange = (lo: number, hi: number, axisMax: number): SliceRange => ({
  start: Math.max(0, lo - 1),
  end: Math.min(axisMax - 1, hi + 1),
})

export const computeAffectedSlices = (
  aabb: DirtyAABB,
): {
  readonly xRange: SliceRange
  readonly yRange: SliceRange
  readonly zRange: SliceRange
} => ({
  xRange: expandedRange(aabb.minX, aabb.maxX, CHUNK_SIZE),
  yRange: expandedRange(aabb.minY, aabb.maxY, CHUNK_HEIGHT),
  zRange: expandedRange(aabb.minZ, aabb.maxZ, CHUNK_SIZE),
})

import { decodeRaw, quadAxisDepth, quadIsAffected, fluidQuadIsAffected, spliceMesh, type QuadSelector } from './subregion-greedy-splice'

// ─── Public API ──────────────────────────────────────────────────────────────

export type SubregionMeshOptions = {
  readonly dirtyAABB: DirtyAABB
  readonly prev: GreedyMeshResult
}

/**
 * FR-4.1 sub-region greedy meshing.
 *
 * When called with both an AABB and a previous mesh result, splices the
 * unaffected slices from `prev` and the affected slices from a fresh mesh.
 * The returned `GreedyMeshResult` is a multiset-equivalent of a full
 * `greedyMeshChunk(chunk, ...)` call (see `spliceMesh` correctness comment).
 *
 * The current implementation runs `greedyMeshChunk` internally to obtain the
 * fresh slice quads. This is a behaviour-preserving baseline: the splicing
 * itself does not yet skip the full-chunk mesh CPU cost — that requires a
 * persistent slice cache which a follow-up PR can add. The architectural seam
 * is in place: callers wire `dirtyAABB` through `MeshChunkOptions` →
 * `meshing-worker` protocol → main-thread splice via this function.
 */
export const greedyMeshChunkSubregion = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  options: SubregionMeshOptions,
  transparentBlockIds: ReadonlySet<number> = new Set(),
  scratch: GreedyMeshScratch = createGreedyMeshScratch(),
  lightGrids?: LightGrids,
  transparentSolidBlockIds: ReadonlySet<number> = new Set(),
): GreedyMeshResult => {
  const ranges = computeAffectedSlices(options.dirtyAABB)
  const fresh = greedyMeshChunk(chunk, offset, transparentBlockIds, scratch, lightGrids, transparentSolidBlockIds)
  const prevOpaque = options.prev.opaqueRaw

  const opaqueIsAffected: QuadSelector = (q) => {
    const fd = quadAxisDepth(fresh.opaqueRaw.positions, fresh.opaqueRaw.normals, q, offset)
    /* c8 ignore next -- fd is null only for non-axis-aligned normals (see fluidQuadIsAffected) */
    return fd === null ? fluidQuadIsAffected(fresh.opaqueRaw.positions, q, offset, options.dirtyAABB) : quadIsAffected(fd.axis, fd.depth, ranges)
  }
  const opaquePrevKept: QuadSelector = (q) => {
    const fd = quadAxisDepth(prevOpaque.positions, prevOpaque.normals, q, offset)
    /* c8 ignore next -- fd is null only for non-axis-aligned normals (see fluidQuadIsAffected) */
    return fd === null ? !fluidQuadIsAffected(prevOpaque.positions, q, offset, options.dirtyAABB) : !quadIsAffected(fd.axis, fd.depth, ranges)
  }
  const opaqueMeshed = spliceMesh(prevOpaque, fresh.opaqueRaw, opaquePrevKept, opaqueIsAffected)
  const opaqueRaw = decodeRaw(opaqueMeshed)

  const freshWater = fresh.waterRaw
  const prevWater = options.prev.waterRaw
  const waterMeshed: MeshedChunk | null = freshWater === null
    ? null
    : prevWater === null
      ? {
          positions: freshWater.positions.slice(),
          normals: freshWater.normals.slice(),
          colors: freshWater.colors.slice(),
          uvs: freshWater.uvs.slice(),
          tileIndexes: freshWater.tileIndexes.slice(),
          indices: freshWater.indices.slice(),
        }
      : spliceMesh(
          prevWater,
          freshWater,
          (q) => {
            const fd = quadAxisDepth(prevWater.positions, prevWater.normals, q, offset)
            /* c8 ignore next */
            return fd === null ? !fluidQuadIsAffected(prevWater.positions, q, offset, options.dirtyAABB) : !quadIsAffected(fd.axis, fd.depth, ranges)
          },
          (q) => {
            const fd = quadAxisDepth(freshWater.positions, freshWater.normals, q, offset)
            /* c8 ignore next */
            return fd === null ? fluidQuadIsAffected(freshWater.positions, q, offset, options.dirtyAABB) : quadIsAffected(fd.axis, fd.depth, ranges)
          },
        )
  const waterRaw = waterMeshed === null ? null : decodeRaw(waterMeshed)

  // Transparent solid (GLASS, LEAVES): splice same way as water.
  const freshTransparentSolid = fresh.transparentSolidRaw
  const prevTransparentSolid = options.prev.transparentSolidRaw
  const transparentSolidMeshed: MeshedChunk | null = freshTransparentSolid === null
    ? null
    : prevTransparentSolid === null
      ? {
          positions: freshTransparentSolid.positions.slice(),
          normals: freshTransparentSolid.normals.slice(),
          colors: freshTransparentSolid.colors.slice(),
          uvs: freshTransparentSolid.uvs.slice(),
          tileIndexes: freshTransparentSolid.tileIndexes.slice(),
          indices: freshTransparentSolid.indices.slice(),
        }
      : spliceMesh(
          prevTransparentSolid,
          freshTransparentSolid,
          (q) => {
            const fd = quadAxisDepth(prevTransparentSolid.positions, prevTransparentSolid.normals, q, offset)
            /* c8 ignore next */
            return fd === null ? !fluidQuadIsAffected(prevTransparentSolid.positions, q, offset, options.dirtyAABB) : !quadIsAffected(fd.axis, fd.depth, ranges)
          },
          (q) => {
            const fd = quadAxisDepth(freshTransparentSolid.positions, freshTransparentSolid.normals, q, offset)
            /* c8 ignore next */
            return fd === null ? fluidQuadIsAffected(freshTransparentSolid.positions, q, offset, options.dirtyAABB) : quadIsAffected(fd.axis, fd.depth, ranges)
          },
        )
  const transparentSolidRaw = transparentSolidMeshed === null ? null : decodeRaw(transparentSolidMeshed)

  let _meshedCache: { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } | null = null
  const toMeshed = (): { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } => {
    if (_meshedCache === null) {
      _meshedCache = {
        opaque: opaqueMeshed,
        water: waterMeshed ?? EMPTY_MESHED_CHUNK,
        transparentSolid: transparentSolidMeshed ?? EMPTY_MESHED_CHUNK,
      }
    }
    return _meshedCache
  }

  return { opaqueRaw, waterRaw, transparentSolidRaw, toMeshed }
}
