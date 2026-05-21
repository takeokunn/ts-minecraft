import { Schema } from 'effect';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel';
// Zero-copy view into accumulator buffers — subarrays (NOT sliced copies).
// Used by the update path (tryReuseGeometry) to avoid an intermediate ~200-400KB allocation
// per chunk that would immediately become garbage after being copied into GPU buffers.
//
// ⚠ These subarrays alias the accumulator's backing store. They are only valid
// until the next call to greedyMeshChunk (which resets the accumulators).
// The update path consumes them synchronously within the same frame-handler tick,
// so this is safe under the current single-fiber meshing model.
export const RawMeshDataSchema = Schema.Struct({
    positions: Schema.instanceOf(Float32Array),
    normals: Schema.instanceOf(Int8Array),
    colors: Schema.instanceOf(Uint8Array),
    uvs: Schema.instanceOf(Float32Array),
    tileIndexes: Schema.instanceOf(Float32Array),
    indices: Schema.instanceOf(Uint32Array),
    vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    indexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});
export const MeshedChunkSchema = Schema.Struct({
    positions: Schema.instanceOf(Float32Array),
    normals: Schema.instanceOf(Int8Array),
    colors: Schema.instanceOf(Uint8Array),
    uvs: Schema.instanceOf(Float32Array),
    tileIndexes: Schema.instanceOf(Float32Array),
    indices: Schema.instanceOf(Uint32Array),
});
export const ChunkWorldOffsetSchema = Schema.Struct({
    wx: Schema.Number.pipe(Schema.int()),
    wz: Schema.Number.pipe(Schema.int()),
});
export const AIR = 0;
// Greedy meshing scratch buffers.
// Reusing these per worker/service instance avoids reallocating the two mask buffers
// on every chunk rebuild.
export const EMPTY_MESHED_CHUNK = {
    positions: new Float32Array(0),
    normals: new Int8Array(0),
    colors: new Uint8Array(0),
    uvs: new Float32Array(0),
    tileIndexes: new Float32Array(0),
    indices: new Uint32Array(0),
};
export const createGreedyMeshScratch = () => ({
    maskCH: new Uint32Array(CHUNK_SIZE * CHUNK_HEIGHT),
    maskSS: new Uint32Array(CHUNK_SIZE * CHUNK_SIZE),
});
export const GreedyMeshResultSchema = Schema.Struct({
    opaqueRaw: RawMeshDataSchema,
    waterRaw: Schema.NullOr(RawMeshDataSchema),
    toMeshed: Schema.declare((u) => typeof u === 'function'),
});
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/meshing/greedy-meshing-types.js.map