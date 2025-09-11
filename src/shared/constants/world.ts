/**
 * World generation and management constants
 */

// World Generation Constants
export const CHUNK_SIZE = 10
export const CHUNK_HEIGHT = 256
export const WATER_LEVEL = 0
export const WORLD_DEPTH = 5
export const MIN_WORLD_Y = -250

// Internal Constants
// Y_OFFSET is used to map world Y coordinates (which can be negative)
// to array indices (which must be positive).
export const Y_OFFSET = 128

// Chunk Loading Constants
export const RENDER_DISTANCE = 2

// Block Generation Constants
export const NOISE_SCALE = 0.1
export const TERRAIN_HEIGHT_MULTIPLIER = 50
export const CAVE_THRESHOLD = 0.6