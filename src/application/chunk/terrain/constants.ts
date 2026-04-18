import { Array as Arr } from 'effect'
import { blockTypeToIndex } from '@/domain/chunk'

/** Noise frequency for lake basin generation (lower = larger, rounder lakes) */
export const LAKE_NOISE_SCALE = 0.02
/** Noise threshold above which a column becomes a lake basin */
export const LAKE_THRESHOLD = 0.70
/** Maximum depth of lake depression in blocks */
export const LAKE_MAX_DEPTH = 18
/** Minimum water depth — prevents single-block shallow patches */
export const LAKE_MIN_DEPTH = 10
/** Noise range below LAKE_THRESHOLD that becomes sandy shoreline */
export const LAKE_SHORE_WIDTH = 0.04

/**
 * Bedrock / Deepslate constants (Phase 1.2)
 *
 * Bedrock occupies y=0..4 as an irregular layer:
 *   y=0: always BEDROCK
 *   y=1..4: probabilistic BEDROCK, decreasing with altitude;
 *           the remainder is filled with DEEPSLATE.
 *
 * Below y=DEEPSLATE_CEILING (16), STONE is replaced by DEEPSLATE.
 */
export const BEDROCK_LAYER_TOP = 4
export const DEEPSLATE_CEILING = 16

/** Probabilistic BEDROCK chance per altitude (index by y, y=0..4). y=0 = always. */
export const BEDROCK_PROBABILITY: readonly number[] = [1.0, 0.75, 0.5, 0.25, 0.0]

/**
 * Noise frequencies for stone-variant blob sampling (lower = larger blobs).
 * Three independent offsets keep GRANITE/DIORITE/ANDESITE patches uncorrelated.
 */
export const VARIANT_NOISE_SCALE = 0.06
export const GRANITE_OFFSET_X = 1000
export const GRANITE_OFFSET_Z = 1000
export const DIORITE_OFFSET_X = 3000
export const DIORITE_OFFSET_Z = 7000
export const ANDESITE_OFFSET_X = 9000
export const ANDESITE_OFFSET_Z = 2000

/**
 * Threshold above which a variant noise sample becomes a variant patch.
 * With noise2D in [0,1], threshold=0.90 yields ~10% occurrence per variant band.
 */
export const VARIANT_THRESHOLD = 0.90

/**
 * Cave carving constants (Phase 1.3)
 *
 * Caves are carved by sampling 3D Perlin noise on a coarse grid and
 * trilinearly-interpolating to each voxel. The interpolated value is compared
 * against a height-biased threshold — |noise| below threshold is carved to AIR.
 *
 * Performance: sampling every voxel (16×16×256 = 65,536 calls) is too slow.
 * Instead we sample on a CAVE_SAMPLE_STRIDE cube grid (every 4 blocks) and
 * interpolate, reducing the call count ~64×.
 */
/** Noise frequency — lower means larger, more gallery-like caves */
export const CAVE_NOISE_SCALE = 0.06
/** Voxel stride between 3D noise samples (must divide CHUNK_SIZE; 4 is a good balance) */
export const CAVE_SAMPLE_STRIDE = 4
/** |noise| threshold at which a voxel is carved — lower = rarer caves */
export const CAVE_BASE_THRESHOLD = 0.18
/** Extra threshold bias at the sweet spot (y=10..40) for more connected caves */
export const CAVE_DEPTH_BIAS = 0.03
/** Minimum y at which caves start to bias deeper */
export const CAVE_DEPTH_MIN = 10
/** Maximum y below which caves are biased */
export const CAVE_DEPTH_MAX = 40
/** Top of the cave carving region — avoids surface holes (Phase 2.1 MC 1.18-aligned) */
export const CAVE_CEILING = 80
/** Bottom protection — never carve bedrock layer */
export const CAVE_FLOOR = BEDROCK_LAYER_TOP + 1 // y=5 (y<=4 is bedrock)

/**
 * Ore vein generation constants (Phase 1.4)
 *
 * Each ore has a vanilla-inspired (depth range, average veins per chunk,
 * min/max vein size). Veins are placed AFTER caves carve but BEFORE trees —
 * this lets cave-exposed ore walls appear. Veins replace STONE or DEEPSLATE
 * only; AIR/WATER/BEDROCK/DIRT/existing-ores are never overwritten.
 *
 * Below DEEPSLATE_CEILING (y<16) the DEEPSLATE_*_ORE variants are used;
 * at or above y=16 the regular ore variants are used.
 */
export type OreConfig = {
  readonly name: 'COAL' | 'IRON' | 'GOLD' | 'DIAMOND' | 'REDSTONE' | 'LAPIS' | 'EMERALD'
  readonly minY: number
  readonly maxY: number
  readonly avgVeins: number
  readonly minSize: number
  readonly maxSize: number
  readonly saltX: number
  readonly saltZ: number
}

export const ORE_CONFIGS: ReadonlyArray<OreConfig> = [
  { name: 'COAL',     minY: 1, maxY: 128, avgVeins: 20, minSize: 5, maxSize: 12, saltX: 10007, saltZ: 20011 },
  { name: 'IRON',     minY: 1, maxY: 64,  avgVeins: 15, minSize: 4, maxSize: 9,  saltX: 30013, saltZ: 40013 },
  { name: 'GOLD',     minY: 1, maxY: 32,  avgVeins: 4,  minSize: 3, maxSize: 7,  saltX: 50021, saltZ: 60029 },
  { name: 'DIAMOND',  minY: 1, maxY: 16,  avgVeins: 2,  minSize: 2, maxSize: 6,  saltX: 70037, saltZ: 80039 },
  { name: 'REDSTONE', minY: 1, maxY: 16,  avgVeins: 5,  minSize: 3, maxSize: 7,  saltX: 90043, saltZ: 100049 },
  { name: 'LAPIS',    minY: 1, maxY: 32,  avgVeins: 2,  minSize: 3, maxSize: 6,  saltX: 110059, saltZ: 120071 },
  { name: 'EMERALD',  minY: 1, maxY: 32,  avgVeins: 1,  minSize: 1, maxSize: 3,  saltX: 130081, saltZ: 140089 },
]

/**
 * Minimum y below which ore placement is forbidden — protects the bedrock
 * layer (y=0..4) even if an ore's minY is permissive.
 */
export const ORE_MIN_Y_FLOOR = BEDROCK_LAYER_TOP + 1 // y=5

/**
 * Overhang generation constants
 *
 * Overhangs are placed in the band [surfaceY, surfaceY + OVERHANG_BAND_HEIGHT].
 * 3D Perlin noise sampled at OVERHANG_NOISE_SCALE frequency; voxels with noise
 * above a height-weighted threshold (OVERHANG_THRESHOLD) become stone overhangs.
 * MOUNTAINS biome lowers the threshold by 0.08 for denser overhangs.
 */
export const OVERHANG_NOISE_SCALE = 0.09
export const OVERHANG_BAND_HEIGHT = 14
export const OVERHANG_THRESHOLD = 0.62

/**
 * Pre-resolved ore block indices — parallel arrays to ORE_CONFIGS.
 * Computed once at module load; reused across every chunk generation.
 */
export const ORE_REGULAR_INDICES: ReadonlyArray<number> = Arr.map(ORE_CONFIGS, (cfg) => blockTypeToIndex(`${cfg.name}_ORE`))
export const ORE_DEEPSLATE_INDICES: ReadonlyArray<number> = Arr.map(ORE_CONFIGS, (cfg) => blockTypeToIndex(`DEEPSLATE_${cfg.name}_ORE`))
