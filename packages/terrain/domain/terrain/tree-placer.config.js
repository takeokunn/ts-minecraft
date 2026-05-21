export const ROUND_OAK_TRUNK = { baseHeight: 4, heightRange: 3, rngScale: 1.91 };
export const TALL_BIRCH_TRUNK = { baseHeight: 6, heightRange: 3, rngScale: 2.73 };
export const SPRUCE_TRUNK = { baseHeight: 7, heightRange: 4, rngScale: 3.41 };
export const TALL_CANOPY_TRUNK = { baseHeight: 8, heightRange: 3, rngScale: 4.11 };
// ROUND_OAK: fract(treeRng * scale) > threshold → place single-block tip
export const ROUND_OAK_TIP_RNG_SCALE = 4.37;
export const ROUND_OAK_TIP_THRESHOLD = 0.3;
// SPRUCE: lower canopy radius is 2 when fract(treeRng * scale) > threshold, else 1
export const SPRUCE_LOWER_RADIUS_RNG_SCALE = 6.17;
export const SPRUCE_LOWER_RADIUS_THRESHOLD = 0.5;
// TALL_CANOPY: fract(treeRng * scale) > threshold → place single-block tip
export const TALL_CANOPY_TIP_RNG_SCALE = 7.03;
export const TALL_CANOPY_TIP_THRESHOLD = 0.2;
// Sin-hash constants for deterministic treeRng derivation
export const TREE_RNG_X_SCALE = 127.1;
export const TREE_RNG_Z_SCALE = 311.7;
export const TREE_RNG_AMPLITUDE = 43758.5453;
// RNG scale for archetype-selection roll (all biomes)
export const ARCHETYPE_ROLL_RNG_SCALE = 1.324717957244746;
// Minimum surface Y allowed for tree spawning (below = bedrock zone)
export const TREE_MIN_SURFACE_Y = 5;
// Headroom guard — keeps leaves from overflowing chunk top
export const TREE_SURFACE_Y_HEADROOM = 15;
//# sourceMappingURL=../../../../dist/packages/terrain/domain/terrain/tree-placer.config.js.map