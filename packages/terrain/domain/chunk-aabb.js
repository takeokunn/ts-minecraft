import { Array as Arr, Option } from 'effect';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel';
const clampX = (n) => Math.max(0, Math.min(CHUNK_SIZE - 1, n | 0));
const clampY = (n) => Math.max(0, Math.min(CHUNK_HEIGHT - 1, n | 0));
export const aabbFromVoxel = (v) => ({
    minX: clampX(v.lx), maxX: clampX(v.lx),
    minY: clampY(v.y), maxY: clampY(v.y),
    minZ: clampX(v.lz), maxZ: clampX(v.lz),
});
// Bounding box of a non-empty voxel array. Returns Option.none() for [].
export const aabbFromVoxels = (voxels) => Arr.match(voxels, {
    onEmpty: () => Option.none(),
    onNonEmpty: (vs) => {
        const head = aabbFromVoxel(vs[0]);
        return Option.some(Arr.reduce(Arr.drop(vs, 1), head, (acc, v) => unionAABB(acc, aabbFromVoxel(v))));
    },
});
export const unionAABB = (a, b) => ({
    minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY),
    minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ),
});
// Grow by `pad` voxels on each axis, clamped to chunk bounds. Light propagation
// reaches up to LIGHT_LEVEL_MAX (=15) voxels; passing pad=15 yields the safe
// re-mesh halo in case lighting changes affect nearby surface visibility.
export const expandAABB = (aabb, pad) => ({
    minX: clampX(aabb.minX - pad), maxX: clampX(aabb.maxX + pad),
    minY: clampY(aabb.minY - pad), maxY: clampY(aabb.maxY + pad),
    minZ: clampX(aabb.minZ - pad), maxZ: clampX(aabb.maxZ + pad),
});
export const aabbCoversChunk = (aabb) => aabb.minX === 0 && aabb.maxX === CHUNK_SIZE - 1 &&
    aabb.minY === 0 && aabb.maxY === CHUNK_HEIGHT - 1 &&
    aabb.minZ === 0 && aabb.maxZ === CHUNK_SIZE - 1;
export const aabbContainsVoxel = (aabb, lx, y, lz) => lx >= aabb.minX && lx <= aabb.maxX &&
    y >= aabb.minY && y <= aabb.maxY &&
    lz >= aabb.minZ && lz <= aabb.maxZ;
export const fullChunkAABB = {
    minX: 0, maxX: CHUNK_SIZE - 1,
    minY: 0, maxY: CHUNK_HEIGHT - 1,
    minZ: 0, maxZ: CHUNK_SIZE - 1,
};
//# sourceMappingURL=../../../dist/packages/terrain/domain/chunk-aabb.js.map