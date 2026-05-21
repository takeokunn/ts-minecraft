import { Array as Arr } from 'effect';
import { blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel';
import { LAKE_NOISE_SCALE, VARIANT_NOISE_SCALE, GRANITE_OFFSET_X, GRANITE_OFFSET_Z, DIORITE_OFFSET_X, DIORITE_OFFSET_Z, ANDESITE_OFFSET_X, ANDESITE_OFFSET_Z, CAVE_NOISE_SCALE, CAVE_SAMPLE_STRIDE, } from './constants';
import { AIR_BLOCK_INDEX } from './surface-resolver';
const createNumberArray = (length) => {
    const values = [];
    values.length = length;
    return values;
};
export const createTreeColumnKey = (wx, wz) => `${wx},${wz}`;
export const createColumnNoiseCoordinates = (baseWorldX, baseWorldZ) => Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) => Arr.makeBy(CHUNK_SIZE, (lz) => {
    const x = baseWorldX + lx;
    const z = baseWorldZ + lz;
    return {
        lakeX: x * LAKE_NOISE_SCALE + 5000,
        lakeZ: z * LAKE_NOISE_SCALE + 5000,
        graniteX: x * VARIANT_NOISE_SCALE + GRANITE_OFFSET_X,
        graniteZ: z * VARIANT_NOISE_SCALE + GRANITE_OFFSET_Z,
        dioriteX: x * VARIANT_NOISE_SCALE + DIORITE_OFFSET_X,
        dioriteZ: z * VARIANT_NOISE_SCALE + DIORITE_OFFSET_Z,
        andesiteX: x * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_X,
        andesiteZ: z * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_Z,
    };
}));
export const createColumnNoiseCoordinateArrays = (baseWorldX, baseWorldZ) => {
    const columnCount = CHUNK_SIZE * CHUNK_SIZE;
    const lakeXs = createNumberArray(columnCount);
    const lakeZs = createNumberArray(columnCount);
    const graniteXs = createNumberArray(columnCount);
    const graniteZs = createNumberArray(columnCount);
    const dioriteXs = createNumberArray(columnCount);
    const dioriteZs = createNumberArray(columnCount);
    const andesiteXs = createNumberArray(columnCount);
    const andesiteZs = createNumberArray(columnCount);
    let index = 0;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = baseWorldX + lx;
        const lakeX = x * LAKE_NOISE_SCALE + 5000;
        const graniteX = x * VARIANT_NOISE_SCALE + GRANITE_OFFSET_X;
        const dioriteX = x * VARIANT_NOISE_SCALE + DIORITE_OFFSET_X;
        const andesiteX = x * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_X;
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const z = baseWorldZ + lz;
            lakeXs[index] = lakeX;
            lakeZs[index] = z * LAKE_NOISE_SCALE + 5000;
            graniteXs[index] = graniteX;
            graniteZs[index] = z * VARIANT_NOISE_SCALE + GRANITE_OFFSET_Z;
            dioriteXs[index] = dioriteX;
            dioriteZs[index] = z * VARIANT_NOISE_SCALE + DIORITE_OFFSET_Z;
            andesiteXs[index] = andesiteX;
            andesiteZs[index] = z * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_Z;
            index++;
        }
    }
    return { lakeXs, lakeZs, graniteXs, graniteZs, dioriteXs, dioriteZs, andesiteXs, andesiteZs };
};
export const createCaveGridPoints = (baseWorldX, baseWorldZ) => {
    const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1;
    const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1;
    const caveSY = Math.floor(CHUNK_HEIGHT / CAVE_SAMPLE_STRIDE) + 1;
    return Arr.flatMap(Arr.makeBy(caveSY, (sy) => sy), (sy) => Arr.flatMap(Arr.makeBy(caveSZ, (sz) => sz), (sz) => Arr.makeBy(caveSX, (sx) => ({
        x: (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
        y: sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE,
        z: (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
    }))));
};
export const createCaveGridCoordinateArrays = (baseWorldX, baseWorldZ) => {
    const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1;
    const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1;
    const caveSY = Math.floor(CHUNK_HEIGHT / CAVE_SAMPLE_STRIDE) + 1;
    const pointCount = caveSX * caveSZ * caveSY;
    const caveXs = createNumberArray(pointCount);
    const caveYs = createNumberArray(pointCount);
    const caveZs = createNumberArray(pointCount);
    let index = 0;
    for (let sy = 0; sy < caveSY; sy++) {
        const y = sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE;
        for (let sz = 0; sz < caveSZ; sz++) {
            const z = (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE;
            for (let sx = 0; sx < caveSX; sx++) {
                caveXs[index] = (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE;
                caveYs[index] = y;
                caveZs[index] = z;
                index++;
            }
        }
    }
    return { caveXs, caveYs, caveZs };
};
export const createBlockIndices = () => ({
    stoneBlockIndex: blockTypeToIndex('STONE'),
    waterBlockIndex: blockTypeToIndex('WATER'),
    lavaBlockIndex: blockTypeToIndex('LAVA'),
    sandBlockIndex: blockTypeToIndex('SAND'),
    gravelBlockIndex: blockTypeToIndex('GRAVEL'),
    bedrockBlockIndex: blockTypeToIndex('BEDROCK'),
    deepslateBlockIndex: blockTypeToIndex('DEEPSLATE'),
    graniteBlockIndex: blockTypeToIndex('GRANITE'),
    dioriteBlockIndex: blockTypeToIndex('DIORITE'),
    andesiteBlockIndex: blockTypeToIndex('ANDESITE'),
    airBlockIndex: AIR_BLOCK_INDEX,
});
export const supportsTreeAtSurface = (surfaceBlock, biome, blockIndices) => surfaceBlock !== blockIndices.airBlockIndex
    && surfaceBlock !== blockIndices.waterBlockIndex
    && surfaceBlock !== blockIndices.sandBlockIndex
    && surfaceBlock !== blockIndices.gravelBlockIndex
    && (surfaceBlock !== blockIndices.stoneBlockIndex || biome === 'MOUNTAINS' || biome === 'SNOW');
//# sourceMappingURL=../../../../dist/packages/terrain/domain/terrain/generator-coordinates.js.map