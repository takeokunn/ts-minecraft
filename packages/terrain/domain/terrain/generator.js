import { Array as Arr, Effect, MutableHashMap } from 'effect';
import { CHUNK_SIZE } from '@ts-minecraft/kernel';
import { computeColumnY } from '../density-function';
import { carveCaves } from './cave-carver';
import { ORE_REGULAR_INDICES, ORE_DEEPSLATE_INDICES, placeOres } from './ore-generator';
import { createColumnNoiseCoordinates, createCaveGridPoints, createBlockIndices, } from './generator-coordinates';
import { buildColumnStates, collectOverhangTargets, applyOverhangNoise, createTreeColumnContextResolver, placeChunkTrees, } from './generator-pipeline';
export const generateTerrain = (chunkService, biomeService, noiseService, coord) => Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord);
    const blocks = new Uint8Array(chunk.blocks);
    const baseWorldX = coord.x * CHUNK_SIZE;
    const baseWorldZ = coord.z * CHUNK_SIZE;
    const columnCoords = createColumnNoiseCoordinates(baseWorldX, baseWorldZ);
    const caveGridPoints = createCaveGridPoints(baseWorldX, baseWorldZ);
    const blockIndices = createBlockIndices();
    const treeColumnContextCache = MutableHashMap.empty();
    const biomeColumns = yield* biomeService.getBiomesAndPropertiesForChunk(coord.x, coord.z);
    const terrainChannels = yield* noiseService.sampleTerrainChannels(baseWorldX, baseWorldZ);
    const lakeNoiseVals = yield* noiseService.noise2DBatchXY(Arr.map(columnCoords, (column) => column.lakeX), Arr.map(columnCoords, (column) => column.lakeZ));
    const graniteNoiseVals = yield* noiseService.noise2DBatchXY(Arr.map(columnCoords, (column) => column.graniteX), Arr.map(columnCoords, (column) => column.graniteZ));
    const dioriteNoiseVals = yield* noiseService.noise2DBatchXY(Arr.map(columnCoords, (column) => column.dioriteX), Arr.map(columnCoords, (column) => column.dioriteZ));
    const andesiteNoiseVals = yield* noiseService.noise2DBatchXY(Arr.map(columnCoords, (column) => column.andesiteX), Arr.map(columnCoords, (column) => column.andesiteZ));
    const initialSurfaceYs = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) => Arr.makeBy(CHUNK_SIZE, (lz) => computeColumnY(terrainChannels, lx, lz)));
    const caveSampleVals = yield* noiseService.noise3DBatchXYZ(Arr.map(caveGridPoints, (point) => point.x), Arr.map(caveGridPoints, (point) => point.y), Arr.map(caveGridPoints, (point) => point.z));
    const columnStates = buildColumnStates({
        blocks,
        baseWorldX,
        baseWorldZ,
        biomeColumns,
        terrainChannels,
        initialSurfaceYs,
        lakeNoiseVals,
        graniteNoiseVals,
        dioriteNoiseVals,
        andesiteNoiseVals,
        treeColumnContextCache,
        blockIndices,
    });
    const { overhangXs, overhangYs, overhangZs, overhangTargets } = collectOverhangTargets(blocks, baseWorldX, baseWorldZ, columnStates, blockIndices.airBlockIndex);
    carveCaves(blocks, caveSampleVals, blockIndices.airBlockIndex, blockIndices.waterBlockIndex, blockIndices.bedrockBlockIndex, blockIndices.lavaBlockIndex);
    if (overhangTargets.length > 0) {
        const overhangNoiseVals = yield* noiseService.noise3DBatchXYZ(overhangXs, overhangYs, overhangZs);
        applyOverhangNoise(blocks, overhangTargets, overhangNoiseVals, columnStates, blockIndices.stoneBlockIndex, blockIndices.airBlockIndex);
    }
    placeOres(blocks, baseWorldX, baseWorldZ, {
        stoneBlockIndex: blockIndices.stoneBlockIndex,
        deepslateBlockIndex: blockIndices.deepslateBlockIndex,
        regular: ORE_REGULAR_INDICES,
        deepslate: ORE_DEEPSLATE_INDICES,
    });
    const resolveTreeColumnContext = createTreeColumnContextResolver({
        biomeService,
        noiseService,
        treeColumnContextCache,
        blockIndices,
    });
    yield* placeChunkTrees(blocks, baseWorldX, baseWorldZ, resolveTreeColumnContext);
    return { ...chunk, blocks };
});
//# sourceMappingURL=generator.js.map