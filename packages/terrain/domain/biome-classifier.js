import { Array as Arr } from 'effect';
import { CHUNK_SIZE } from '@ts-minecraft/kernel';
import { BIOME_SCALE, HUMIDITY_WORLD_OFFSET, RIVER_CENTER, RIVER_HALF_WIDTH, HUM_DRY, HUM_WET, HUM_VERY_DRY, HUM_VERY_WET, HUM_JUNGLE, TEMP_JUNGLE, HUM_TAIGA, HUM_MOUNTAINS, HUM_SAVANNA_MIN, TEMP_COLD, TEMP_HOT, } from './biome-classifier.config';
export const peaksAndValleysFromWeirdness = (weirdness) => 1 - Math.abs(3 * Math.abs(weirdness) - 2);
// temperature: cold < TEMP_COLD < temperate < TEMP_HOT < hot; humidity: dry < HUM_DRY < moderate < HUM_WET < wet < HUM_VERY_WET < very-wet
export const classifyBiome = (temperature, humidity) => {
    const isCold = temperature < TEMP_COLD;
    const isHot = temperature > TEMP_HOT;
    const isDry = humidity < HUM_DRY;
    const isWet = humidity > HUM_WET;
    if (humidity < HUM_VERY_DRY)
        return isCold ? 'SNOW' : 'DESERT';
    if (humidity > HUM_VERY_WET)
        return temperature > HUM_WET ? 'SWAMP' : 'OCEAN';
    if (humidity > HUM_JUNGLE && temperature > TEMP_JUNGLE)
        return 'JUNGLE';
    if (isCold)
        return humidity > HUM_TAIGA ? 'TAIGA' : humidity > HUM_MOUNTAINS ? 'MOUNTAINS' : 'SNOW';
    if (isHot)
        return isWet ? 'JUNGLE' : humidity > HUM_SAVANNA_MIN ? 'SAVANNA' : 'DESERT';
    if (isDry)
        return 'PLAINS';
    if (isWet)
        return 'FOREST';
    return 'PLAINS';
};
export const classifyBiomeFromClimate = ({ temperature, humidity, continentalness, erosion, pv, riverNoise, }) => {
    const riverDistance = Math.abs(riverNoise - RIVER_CENTER);
    if (continentalness > -0.22 && continentalness < 0.42 && riverDistance < RIVER_HALF_WIDTH) {
        return 'RIVER';
    }
    const baseBiome = classifyBiome(temperature, humidity);
    if (continentalness < -0.42) {
        return 'OCEAN';
    }
    const mountaininess = Math.max(0, pv) * 0.65 + Math.max(0, 0.45 - erosion) * 0.35;
    if (continentalness > 0.5 && mountaininess > 0.42) {
        return temperature < TEMP_COLD ? 'SNOW' : 'MOUNTAINS';
    }
    if (baseBiome === 'OCEAN') {
        // temperature > TEMP_HOT is unreachable here: classifyBiome returns 'OCEAN' only when
        // humidity > HUM_VERY_WET && temperature <= HUM_WET (0.6), but TEMP_HOT = 0.7 > 0.6.
        /* c8 ignore next -- 'SWAMP' branch: logically unreachable (OCEAN base requires temp ≤ 0.6 < TEMP_HOT) */
        return temperature > TEMP_HOT ? 'SWAMP' : 'FOREST';
    }
    if (baseBiome === 'SWAMP' && (continentalness > 0.15 || erosion < 0.35)) {
        return 'FOREST';
    }
    /* c8 ignore next */
    if (baseBiome === 'MOUNTAINS' && (continentalness < 0.32 || mountaininess < 0.28)) {
        // 'FOREST' branch is unreachable: classifyBiome returns 'MOUNTAINS' only when isCold (temp < TEMP_COLD),
        // so temperature < TEMP_COLD is always true here; the ternary false-arm never executes.
        /* c8 ignore next -- 'FOREST' branch: logically unreachable (MOUNTAINS base requires temp < TEMP_COLD) */
        return temperature < TEMP_COLD ? 'TAIGA' : 'FOREST';
    }
    return baseBiome;
};
export const refineBeachBiome = (biome, neighboringBiomes, continentalness) => {
    if (biome === 'OCEAN' || biome === 'DESERT' || biome === 'SWAMP')
        return biome;
    const adjacentOcean = Arr.some(neighboringBiomes, (neighborBiome) => neighborBiome === 'OCEAN');
    return adjacentOcean && continentalness < 0.12 ? 'BEACH' : biome;
};
// Index layout: outer=lx (i/CHUNK_SIZE), inner=lz (i%CHUNK_SIZE) — matches generateTerrain iteration order.
export const buildChunkNoiseInputs = (chunkX, chunkZ) => Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => {
    const lx = Math.floor(i / CHUNK_SIZE);
    const lz = i % CHUNK_SIZE;
    const x = chunkX * CHUNK_SIZE + lx;
    const z = chunkZ * CHUNK_SIZE + lz;
    return {
        tempX: x * BIOME_SCALE,
        tempZ: z * BIOME_SCALE,
        humX: (x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
        humZ: (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
    };
});
// Translates biome-batch index i (outer=lx, inner=lz) to terrain-channel index (outer=lz, inner=lx),
// matching TerrainChannelSamples z*CHUNK_SIZE+x layout from primitives.ts computeTerrainChannels.
export const batchTerrainIndexFor = (i) => {
    const lx = Math.floor(i / CHUNK_SIZE);
    const lz = i % CHUNK_SIZE;
    return lz * CHUNK_SIZE + lx;
};
//# sourceMappingURL=biome-classifier.js.map