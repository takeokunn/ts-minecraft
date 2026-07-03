// Classification thresholds and noise-sampling constants shared by biome domain logic.
export const BIOME_SCALE = 0.005
export const HUMIDITY_WORLD_OFFSET = 10_000

// Multi-octave fBm climate noise (4 octaves, amplitude-sum normalized)
// concentrates hard around 0.5 — measured std ≈ 0.1, so the classifier's
// outer bands (cold<0.3, hot>0.7, very-dry<0.15, very-wet>0.85) almost never
// fired: a 40km sample was 64% PLAINS with 0.0% DESERT and 0.2% SNOW.
// Stretching the values around 0.5 restores a uniform-like spread the
// thresholds were designed for.
export const CLIMATE_VARIANCE_STRETCH = 2.2

export const TEMP_COLD = 0.3
export const TEMP_HOT = 0.7

export const HUM_DRY = 0.3
export const HUM_WET = 0.6
export const HUM_VERY_DRY = 0.15
export const HUM_VERY_WET = 0.85

export const HUM_JUNGLE = 0.72
export const TEMP_JUNGLE = 0.78

export const HUM_TAIGA = 0.55
export const HUM_MOUNTAINS = 0.4

export const HUM_SAVANNA_MIN = 0.22

export const RIVER_NOISE_SCALE = 0.0035
export const RIVER_WORLD_OFFSET = 20_000
export const RIVER_CENTER = 0.5
// Single-octave river noise also clusters near 0.5, so the old 0.055 band
// classified ~16% of the world as RIVER (vanilla ~3-6%).
export const RIVER_HALF_WIDTH = 0.02
