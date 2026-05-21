import { Effect, Data, Option, Schema } from 'effect';
export class BlockIndexError extends Data.TaggedError('BlockIndexError') {
}
export const CHUNK_SIZE = 16; // x and z dimensions (0-15)
export const CHUNK_HEIGHT = 256; // y dimension (0-255)
export const ChunkCoordSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
});
// Index = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE). Returns none() for out-of-bounds coords.
export const blockIndex = (x, y, z) => {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
        return Option.none();
    }
    return Option.some(y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE);
};
// Performance boundary: no Option allocation — caller must ensure 0 ≤ x < CHUNK_SIZE, 0 ≤ y < CHUNK_HEIGHT, 0 ≤ z < CHUNK_SIZE
export const blockIndexUnsafe = (x, y, z) => y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE;
// Effect version for user-facing APIs — fails with BlockIndexError for out-of-bounds coords.
export const toBlockIndex = (x, y, z) => Option.match(blockIndex(x, y, z), {
    onNone: () => Effect.fail(new BlockIndexError({ x, y, z })),
    onSome: (idx) => Effect.succeed(idx),
});
//# sourceMappingURL=../../../dist/packages/kernel/domain/chunk-coords.js.map