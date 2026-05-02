
// Lake noise frequency — lower = larger, rounder lakes
export const LAKE_NOISE_SCALE = 0.02
// Noise threshold above which a column becomes a lake basin
export const LAKE_THRESHOLD = 0.70
export const LAKE_MAX_DEPTH = 18
// Minimum water depth — prevents single-block shallow patches
export const LAKE_MIN_DEPTH = 10
// Noise range below LAKE_THRESHOLD that becomes sandy shoreline
export const LAKE_SHORE_WIDTH = 0.04
export const RIVER_WATER_LEVEL = 62
export const RIVER_MIN_CUT = 4
export const RIVER_MAX_CUT = 10

// Bedrock: y=0 always; y=1..4 probabilistic (see BEDROCK_PROBABILITY). Below y=DEEPSLATE_CEILING: DEEPSLATE.
export const BEDROCK_LAYER_TOP = 4
export const DEEPSLATE_CEILING = 16

// Index by y (y=0..4). y=0 = always bedrock.
export const BEDROCK_PROBABILITY: readonly number[] = [1.0, 0.75, 0.5, 0.25, 0.0]

// Three independent offsets keep GRANITE/DIORITE/ANDESITE patches uncorrelated.
export const VARIANT_NOISE_SCALE = 0.06
export const GRANITE_OFFSET_X = 1000
export const GRANITE_OFFSET_Z = 1000
export const DIORITE_OFFSET_X = 3000
export const DIORITE_OFFSET_Z = 7000
export const ANDESITE_OFFSET_X = 9000
export const ANDESITE_OFFSET_Z = 2000

// threshold=0.90 → ~10% occurrence per variant band
export const VARIANT_THRESHOLD = 0.90

// Cave carving: coarse 3D-noise grid (every CAVE_SAMPLE_STRIDE blocks) trilinearly interpolated per voxel.
export const CAVE_NOISE_SCALE = 0.06
// Must divide CHUNK_SIZE; 4 reduces noise samples ~64× vs per-voxel.
export const CAVE_SAMPLE_STRIDE = 4
export const CAVE_BASE_THRESHOLD = 0.18
// Extra threshold bias at y=10..40 for more connected deep caves.
export const CAVE_DEPTH_BIAS = 0.03
export const CAVE_DEPTH_MIN = 10
export const CAVE_DEPTH_MAX = 40
// Avoids surface holes (MC 1.18-aligned)
export const CAVE_CEILING = 80
export const CAVE_FLOOR = BEDROCK_LAYER_TOP + 1 // y=5 (y<=4 is bedrock)

// Ore veins placed AFTER cave carving — cave-exposed ore walls appear. Only replaces STONE/DEEPSLATE.
export type OreConfig = {
  readonly name: 'COAL' | 'IRON' | 'GOLD' | 'DIAMOND' | 'REDSTONE' | 'LAPIS' | 'EMERALD'
  readonly minY: number
  readonly maxY: number
  readonly peakY: number
  readonly distribution: 'uniform' | 'triangle'
  readonly avgVeins: number
  readonly minSize: number
  readonly maxSize: number
  readonly saltX: number
  readonly saltZ: number
}

export const ORE_CONFIGS: ReadonlyArray<OreConfig> = [
  { name: 'COAL',     minY: 12, maxY: 180, peakY: 96, distribution: 'triangle', avgVeins: 18, minSize: 6, maxSize: 14, saltX: 10007, saltZ: 20011 },
  { name: 'IRON',     minY: 8,  maxY: 128, peakY: 48, distribution: 'triangle', avgVeins: 12, minSize: 4, maxSize: 9,  saltX: 30013, saltZ: 40013 },
  { name: 'GOLD',     minY: 5,  maxY: 48,  peakY: 24, distribution: 'triangle', avgVeins: 4,  minSize: 3, maxSize: 7,  saltX: 50021, saltZ: 60029 },
  { name: 'DIAMOND',  minY: 5,  maxY: 16,  peakY: 8,  distribution: 'triangle', avgVeins: 2,  minSize: 2, maxSize: 6,  saltX: 70037, saltZ: 80039 },
  { name: 'REDSTONE', minY: 5,  maxY: 20,  peakY: 8,  distribution: 'triangle', avgVeins: 5,  minSize: 3, maxSize: 7,  saltX: 90043, saltZ: 100049 },
  { name: 'LAPIS',    minY: 8,  maxY: 72,  peakY: 28, distribution: 'triangle', avgVeins: 3,  minSize: 3, maxSize: 6,  saltX: 110059, saltZ: 120071 },
  { name: 'EMERALD',  minY: 24, maxY: 160, peakY: 96, distribution: 'triangle', avgVeins: 2,  minSize: 1, maxSize: 3,  saltX: 130081, saltZ: 140089 },
]

// Protects bedrock (y=0..4) even if an ore's minY is permissive.
export const ORE_MIN_Y_FLOOR = BEDROCK_LAYER_TOP + 1 // y=5

export const CAVE_LAVA_MAX_Y = 10

// Overhangs: band [surfaceY, surfaceY+BAND_HEIGHT]; MOUNTAINS biome lowers threshold by 0.08 for denser overhangs.
export const OVERHANG_NOISE_SCALE = 0.09
export const OVERHANG_BAND_HEIGHT = 14
export const OVERHANG_THRESHOLD = 0.62
