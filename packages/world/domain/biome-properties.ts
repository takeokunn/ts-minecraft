import type { BiomeProperties, BiomeType } from './biome'

// treeDensity is the EFFECTIVE per-column tree probability (trees per surface column).
// Jittered-grid placement caps it at 1/TREE_GRID_AREA = 0.0625; vanilla forest ≈ 0.04.
// The old values (FOREST 0.30, JUNGLE 0.50) were per-column Bernoulli rates that fused
// every crown into a solid walkable leaf slab.
export const BIOME_PROPERTIES: Readonly<Record<BiomeType, BiomeProperties>> = {
  PLAINS: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.003, temperature: 0.50, humidity: 0.30 },
  DESERT: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.90, humidity: 0.10 },
  FOREST: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.045, temperature: 0.50, humidity: 0.60 },
  // Rare FOREST variant: sparse trees, dense flower carpet (vanilla Flower Forest).
  FLOWER_FOREST: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.022, temperature: 0.55, humidity: 0.62 },
  OCEAN: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.50, humidity: 0.90 },
  MOUNTAINS: { surfaceBlock: 'STONE', subSurfaceBlock: 'STONE', treeDensity: 0.006, temperature: 0.30, humidity: 0.40 },
  SNOW: { surfaceBlock: 'SNOW', subSurfaceBlock: 'DIRT', treeDensity: 0.012, temperature: 0.10, humidity: 0.50 },
  SWAMP: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.028, temperature: 0.60, humidity: 0.80 },
  JUNGLE: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.0625, temperature: 0.90, humidity: 0.80 },
  BEACH: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.70, humidity: 0.55 },
  RIVER: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity: 0.00, temperature: 0.50, humidity: 0.65 },
  TAIGA: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.04, temperature: 0.25, humidity: 0.55 },
  SAVANNA: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.008, temperature: 0.78, humidity: 0.28 },
} as const
