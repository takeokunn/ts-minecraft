import { Array as Arr, HashSet, Option } from 'effect';
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from '@ts-minecraft/kernel';
import { BIAS, FluidKey, LAVA_INDEX, LAVA_MAX_LEVEL, NOTIFY_OFFSETS, WATER_INDEX, WATER_MAX_LEVEL, XZ_STRIDE, Y_STRIDE, } from './fluid-model';
export const blockKey = (position) => FluidKey((Math.floor(position.x) + BIAS) * XZ_STRIDE + Math.floor(position.y) * Y_STRIDE + (Math.floor(position.z) + BIAS));
export const parseKey = (key) => {
    const biasedX = Math.floor(key / XZ_STRIDE);
    const remainder = key - biasedX * XZ_STRIDE;
    const y = Math.floor(remainder / Y_STRIDE);
    const biasedZ = remainder - y * Y_STRIDE;
    return {
        x: biasedX - BIAS,
        y,
        z: biasedZ - BIAS,
    };
};
export const floorMod = (value, modulo) => ((value % modulo) + modulo) % modulo;
export const localX = (position) => floorMod(Math.floor(position.x), CHUNK_SIZE);
export const localY = (position) => Math.floor(position.y);
export const localZ = (position) => floorMod(Math.floor(position.z), CHUNK_SIZE);
export const enqueue = (frontier, position) => Arr.reduce(NOTIFY_OFFSETS, HashSet.add(frontier, blockKey(position)), (acc, offset) => HashSet.add(acc, blockKey({
    x: position.x + offset.x,
    y: position.y + offset.y,
    z: position.z + offset.z,
})));
export const chunkCoordsForPosition = (position) => ({
    x: Math.floor(position.x / CHUNK_SIZE),
    z: Math.floor(position.z / CHUNK_SIZE),
});
export const positionFromChunk = (chunkCoord, idx) => {
    const y = idx % CHUNK_HEIGHT;
    const column = Math.floor(idx / CHUNK_HEIGHT);
    const z = column % CHUNK_SIZE;
    const x = Math.floor(column / CHUNK_SIZE);
    return {
        x: chunkCoord.x * CHUNK_SIZE + x,
        y,
        z: chunkCoord.z * CHUNK_SIZE + z,
    };
};
export const getBlockIndex = (position) => {
    const idxOpt = blockIndex(localX(position), localY(position), localZ(position));
    return Option.getOrElse(idxOpt, () => -1);
};
export const maxLevelFor = (type) => (type === 'lava' ? LAVA_MAX_LEVEL : WATER_MAX_LEVEL);
export const blockTypeFor = (type) => (type === 'lava' ? 'LAVA' : 'WATER');
export const blockIndexFor = (type) => (type === 'lava' ? LAVA_INDEX : WATER_INDEX);
//# sourceMappingURL=../../../dist/packages/world-state/domain/fluid-position-utils.js.map