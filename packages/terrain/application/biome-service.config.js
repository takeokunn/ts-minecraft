export { BIOME_SCALE, HUMIDITY_WORLD_OFFSET, TEMP_COLD, TEMP_HOT, HUM_DRY, HUM_WET, HUM_VERY_DRY, HUM_VERY_WET, HUM_JUNGLE, TEMP_JUNGLE, HUM_TAIGA, HUM_MOUNTAINS, HUM_SAVANNA_MIN, RIVER_NOISE_SCALE, RIVER_WORLD_OFFSET, RIVER_CENTER, RIVER_HALF_WIDTH, } from '../domain/biome-classifier.config';
// ─── Biome properties ────────────────────────────────────────────────────────
export const BIOME_PROPERTIES = {
    PLAINS: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.01, temperature: 0.50, humidity: 0.30 },
    DESERT: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.90, humidity: 0.10 },
    FOREST: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.30, temperature: 0.50, humidity: 0.60 },
    OCEAN: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.50, humidity: 0.90 },
    MOUNTAINS: { surfaceBlock: 'STONE', subSurfaceBlock: 'STONE', treeDensity: 0.02, temperature: 0.30, humidity: 0.40 },
    SNOW: { surfaceBlock: 'SNOW', subSurfaceBlock: 'DIRT', treeDensity: 0.05, temperature: 0.10, humidity: 0.50 },
    SWAMP: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.20, temperature: 0.60, humidity: 0.80 },
    JUNGLE: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.50, temperature: 0.90, humidity: 0.80 },
    BEACH: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.70, humidity: 0.55 },
    RIVER: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.50, humidity: 0.65 },
    TAIGA: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.24, temperature: 0.25, humidity: 0.55 },
    SAVANNA: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.08, temperature: 0.78, humidity: 0.28 },
};
//# sourceMappingURL=biome-service.config.js.map