import type { BiomeType, BiomeProperties } from './biome-service'

// ─── Noise sampling ──────────────────────────────────────────────────────────

export const BIOME_SCALE = 0.005
/** Offset added to X/Z before sampling humidity — separates it from temperature noise domain. */
export const HUMIDITY_WORLD_OFFSET = 10_000

// ─── Classification thresholds ──────────────────────────────────────────────

/** temperature < TEMP_COLD → "cold" zone */
export const TEMP_COLD = 0.3
/** temperature > TEMP_HOT → "hot" zone */
export const TEMP_HOT = 0.7

/** humidity < HUM_DRY → "dry" zone */
export const HUM_DRY = 0.3
/** humidity > HUM_WET → "wet" zone */
export const HUM_WET = 0.6

/** humidity < HUM_VERY_DRY → desert/snow override regardless of temperature */
export const HUM_VERY_DRY = 0.15
/** humidity > HUM_VERY_WET → ocean/swamp override regardless of temperature */
export const HUM_VERY_WET = 0.85

/** humidity > HUM_JUNGLE && temperature > TEMP_JUNGLE → jungle override in temperate band */
export const HUM_JUNGLE = 0.72
export const TEMP_JUNGLE = 0.78

/** humidity > HUM_TAIGA (within cold band) → taiga instead of mountains */
export const HUM_TAIGA = 0.55
/** humidity > HUM_MOUNTAINS (within cold band) → mountains instead of snow */
export const HUM_MOUNTAINS = 0.4

/** humidity > HUM_SAVANNA_MIN (within hot band) → savanna instead of desert */
export const HUM_SAVANNA_MIN = 0.22

// ─── Biome properties ────────────────────────────────────────────────────────

export const BIOME_PROPERTIES: Readonly<Record<BiomeType, BiomeProperties>> = {
  PLAINS:    { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  treeDensity: 0.01, temperature: 0.50, humidity: 0.30 },
  DESERT:    { surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  treeDensity: 0.00, temperature: 0.90, humidity: 0.10 },
  FOREST:    { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  treeDensity: 0.30, temperature: 0.50, humidity: 0.60 },
  OCEAN:     { surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  treeDensity: 0.00, temperature: 0.50, humidity: 0.90 },
  MOUNTAINS: { surfaceBlock: 'STONE', subSurfaceBlock: 'STONE', treeDensity: 0.02, temperature: 0.30, humidity: 0.40 },
  SNOW:      { surfaceBlock: 'SNOW',  subSurfaceBlock: 'DIRT',  treeDensity: 0.05, temperature: 0.10, humidity: 0.50 },
  SWAMP:     { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  treeDensity: 0.20, temperature: 0.60, humidity: 0.80 },
  JUNGLE:    { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  treeDensity: 0.50, temperature: 0.90, humidity: 0.80 },
  BEACH:     { surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  treeDensity: 0.00, temperature: 0.70, humidity: 0.55 },
  TAIGA:     { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  treeDensity: 0.24, temperature: 0.25, humidity: 0.55 },
  SAVANNA:   { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  treeDensity: 0.08, temperature: 0.78, humidity: 0.28 },
} as const
