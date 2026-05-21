import { Schema } from 'effect';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel';
import { RawMeshDataSchema, EMPTY_MESHED_CHUNK, createGreedyMeshScratch, } from './greedy-meshing-types';
import { greedyMeshChunk } from './greedy-meshing';
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
});
// Compute the per-axis slice ranges that may be affected by a block change
// inside the AABB. AO and lighting both sample neighbours within ±1 in the
// tangent directions, AND face exposure for slice d reads voxels at slice d±1
// — so we expand the AABB by 1 voxel on each side to preserve face merging
// correctness across the boundary.
//
// Slices entirely outside the expanded range have ZERO input voxels inside
// the AABB and therefore yield byte-identical mask cells (and quads) before
// and after the edit. This is the splice invariant.
const expandedRange = (lo, hi, axisMax) => ({
    start: Math.max(0, lo - 1),
    end: Math.min(axisMax - 1, hi + 1),
});
export const computeAffectedSlices = (aabb) => ({
    xRange: expandedRange(aabb.minX, aabb.maxX, CHUNK_SIZE),
    yRange: expandedRange(aabb.minY, aabb.maxY, CHUNK_HEIGHT),
    zRange: expandedRange(aabb.minZ, aabb.maxZ, CHUNK_SIZE),
});
// Classify a quad by its face direction and depth slice from its first vertex
// position and normal. Returns null when the normal is non-axis-aligned (i.e.
// flat fluid top quads with the same normal-to-axis mapping as Y+ are still
// classified by Y depth — this only fails for diagonal normals which the
// pipeline never emits).
//
//   normal (1,0,0)  → X+ face, depth lx = round(vertex.x − offset.wx − 1)
//   normal (-1,0,0) → X- face, depth lx = round(vertex.x − offset.wx)
//   normal (0,1,0)  → Y+ face, depth y  = floor(vertex.y − 1)   (top fluid: fractional y)
//   normal (0,-1,0) → Y- face, depth y  = floor(vertex.y)
//   normal (0,0,1)  → Z+ face, depth lz = round(vertex.z − offset.wz − 1)
//   normal (0,0,-1) → Z- face, depth lz = round(vertex.z − offset.wz)
const quadAxisDepth = (positions, normals, quadIndex, offset) => {
    const v = quadIndex * 4;
    const ni = v * 3;
    const nx = normals[ni] ?? 0;
    const ny = normals[ni + 1] ?? 0;
    const nz = normals[ni + 2] ?? 0;
    const px = positions[ni] ?? 0;
    const py = positions[ni + 1] ?? 0;
    const pz = positions[ni + 2] ?? 0;
    if (nx === 1)
        return { axis: 'x', depth: Math.round(px - offset.wx) - 1 };
    if (nx === -1)
        return { axis: 'x', depth: Math.round(px - offset.wx) };
    if (ny === 1)
        return { axis: 'y', depth: Math.floor(py - 1 + 1e-6) };
    if (ny === -1)
        return { axis: 'y', depth: Math.floor(py + 1e-6) };
    if (nz === 1)
        return { axis: 'z', depth: Math.round(pz - offset.wz) - 1 };
    if (nz === -1)
        return { axis: 'z', depth: Math.round(pz - offset.wz) };
    return null;
};
const quadIsAffected = (axis, depth, ranges) => {
    const r = axis === 'x' ? ranges.xRange : axis === 'y' ? ranges.yRange : ranges.zRange;
    return depth >= r.start && depth <= r.end;
};
// Conservative test for fluid-side quads whose face normal does not pin them
// to a single slice (e.g. fluid mesh emits top quads with fractional y). The
// quad is "affected" if any of its 4 vertices lies inside the expanded AABB.
const fluidQuadIsAffected = (positions, quadIndex, offset, aabb) => {
    const pi = quadIndex * 4 * 3;
    const exMin = { x: aabb.minX - 1, y: aabb.minY - 1, z: aabb.minZ - 1 };
    const exMax = { x: aabb.maxX + 2, y: aabb.maxY + 2, z: aabb.maxZ + 2 };
    for (let v = 0; v < 4; v++) {
        const lx = (positions[pi + v * 3] ?? 0) - offset.wx;
        const ly = positions[pi + v * 3 + 1] ?? 0;
        const lz = (positions[pi + v * 3 + 2] ?? 0) - offset.wz;
        if (lx >= exMin.x && lx <= exMax.x &&
            ly >= exMin.y && ly <= exMax.y &&
            lz >= exMin.z && lz <= exMax.z)
            return true;
    }
    return false;
};
const splitQuads = (raw, keep) => {
    const total = raw.indexCount / 6;
    const kept = [];
    for (let q = 0; q < total; q++) {
        if (keep(q))
            kept.push(q);
    }
    return kept;
};
const concatQuads = (source, quadIndices, outPos, outNormal, outColor, outUv, outTile, outIdx, startVertex, startIndex) => {
    let vCount = 0;
    let iCount = 0;
    for (let n = 0; n < quadIndices.length; n++) {
        const q = quadIndices[n];
        const srcVBase = q * 4;
        const srcPi = srcVBase * 3;
        const srcUi = srcVBase * 2;
        const dstVBase = startVertex + vCount;
        const dstPi = dstVBase * 3;
        const dstUi = dstVBase * 2;
        for (let k = 0; k < 12; k++) {
            outPos[dstPi + k] = source.positions[srcPi + k] ?? 0;
            outNormal[dstPi + k] = source.normals[srcPi + k] ?? 0;
            outColor[dstPi + k] = source.colors[srcPi + k] ?? 0;
        }
        for (let k = 0; k < 8; k++) {
            outUv[dstUi + k] = source.uvs[srcUi + k] ?? 0;
        }
        for (let k = 0; k < 4; k++) {
            outTile[dstVBase + k] = source.tileIndexes[srcVBase + k] ?? 0;
        }
        const srcIi = q * 6;
        const dstIi = startIndex + iCount;
        outIdx[dstIi] = source.indices[srcIi] - srcVBase + dstVBase;
        outIdx[dstIi + 1] = source.indices[srcIi + 1] - srcVBase + dstVBase;
        outIdx[dstIi + 2] = source.indices[srcIi + 2] - srcVBase + dstVBase;
        outIdx[dstIi + 3] = source.indices[srcIi + 3] - srcVBase + dstVBase;
        outIdx[dstIi + 4] = source.indices[srcIi + 4] - srcVBase + dstVBase;
        outIdx[dstIi + 5] = source.indices[srcIi + 5] - srcVBase + dstVBase;
        vCount += 4;
        iCount += 6;
    }
    return { vertexCount: vCount, indexCount: iCount };
};
const spliceMesh = (prevRaw, freshRaw, isPrevQuadKept, isFreshQuadKept) => {
    const prevKept = splitQuads(prevRaw, isPrevQuadKept);
    const freshKept = splitQuads(freshRaw, isFreshQuadKept);
    const totalQuads = prevKept.length + freshKept.length;
    const totalVerts = totalQuads * 4;
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Int8Array(totalVerts * 3);
    const colors = new Uint8Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const tileIndexes = new Float32Array(totalVerts);
    const indices = new Uint32Array(totalQuads * 6);
    const a = concatQuads(prevRaw, prevKept, positions, normals, colors, uvs, tileIndexes, indices, 0, 0);
    concatQuads(freshRaw, freshKept, positions, normals, colors, uvs, tileIndexes, indices, a.vertexCount, a.indexCount);
    return { positions, normals, colors, uvs, tileIndexes, indices };
};
const decodeRaw = (m) => Schema.decodeUnknownSync(RawMeshDataSchema)({
    positions: m.positions,
    normals: m.normals,
    colors: m.colors,
    uvs: m.uvs,
    tileIndexes: m.tileIndexes,
    indices: m.indices,
    vertexCount: m.positions.length / 3,
    indexCount: m.indices.length,
});
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
export const greedyMeshChunkSubregion = (chunk, offset, options, transparentBlockIds = new Set(), scratch = createGreedyMeshScratch(), lightGrids) => {
    const ranges = computeAffectedSlices(options.dirtyAABB);
    const fresh = greedyMeshChunk(chunk, offset, transparentBlockIds, scratch, lightGrids);
    const prevOpaque = options.prev.opaqueRaw;
    const prevWater = options.prev.waterRaw;
    const opaqueIsAffected = (q) => {
        const fd = quadAxisDepth(fresh.opaqueRaw.positions, fresh.opaqueRaw.normals, q, offset);
        return fd === null
            ? fluidQuadIsAffected(fresh.opaqueRaw.positions, q, offset, options.dirtyAABB)
            : quadIsAffected(fd.axis, fd.depth, ranges);
    };
    const opaquePrevKept = (q) => {
        const fd = quadAxisDepth(prevOpaque.positions, prevOpaque.normals, q, offset);
        return fd === null
            ? !fluidQuadIsAffected(prevOpaque.positions, q, offset, options.dirtyAABB)
            : !quadIsAffected(fd.axis, fd.depth, ranges);
    };
    const opaqueMeshed = spliceMesh(prevOpaque, fresh.opaqueRaw, opaquePrevKept, opaqueIsAffected);
    const opaqueRaw = decodeRaw(opaqueMeshed);
    const freshWater = fresh.waterRaw;
    const waterMeshed = freshWater === null
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
            : spliceMesh(prevWater, freshWater, (q) => {
                const fd = quadAxisDepth(prevWater.positions, prevWater.normals, q, offset);
                return fd === null
                    ? !fluidQuadIsAffected(prevWater.positions, q, offset, options.dirtyAABB)
                    : !quadIsAffected(fd.axis, fd.depth, ranges);
            }, (q) => {
                const fd = quadAxisDepth(freshWater.positions, freshWater.normals, q, offset);
                return fd === null
                    ? fluidQuadIsAffected(freshWater.positions, q, offset, options.dirtyAABB)
                    : quadIsAffected(fd.axis, fd.depth, ranges);
            });
    const waterRaw = waterMeshed === null ? null : decodeRaw(waterMeshed);
    let _meshedCache = null;
    const toMeshed = () => {
        if (_meshedCache === null) {
            _meshedCache = {
                opaque: opaqueMeshed,
                water: waterMeshed ?? EMPTY_MESHED_CHUNK,
            };
        }
        return _meshedCache;
    };
    return { opaqueRaw, waterRaw, toMeshed };
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/meshing/subregion-greedy.js.map