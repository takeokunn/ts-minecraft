import type { BlockType } from '@ts-minecraft/core'

// Liquid / environment hazard constants and frame-rate-independent timing.
// Pure data only; logic lives in environment-hazard-resolution.ts.

// Lava deals 4 damage every half-second while the player stands in it (vanilla).
export const LAVA_DAMAGE = 4
export const LAVA_DAMAGE_INTERVAL_SECS = 0.5

// After leaving lava, the player keeps burning briefly and takes fire damage.
export const LAVA_BURN_DURATION_SECS = 8
export const FIRE_DAMAGE = 1
export const FIRE_DAMAGE_INTERVAL_SECS = 1

// Air supply: ~15s of breath, then 2 damage per second until you surface (vanilla).
export const MAX_AIR_SECS = 15
export const DROWN_DAMAGE = 2
export const DROWN_DAMAGE_INTERVAL_SECS = 1

// Suffocation: while the player's head is inside a suffocating full block, vanilla
// applies 1 damage every half-second.
export const SUFFOCATION_DAMAGE = 1
export const SUFFOCATION_DAMAGE_INTERVAL_SECS = 0.5

// Cactus deals contact damage when the player's body intersects its block space.
export const CACTUS_DAMAGE = 1

// Lightning deals 5 damage on exposed thunder ticks.
export const LIGHTNING_DAMAGE = 5
export const LIGHTNING_DAMAGE_INTERVAL_SECS = 1

// Void: below the vanilla Java Edition world floor the player takes 4 damage every
// half-second. This browser world still stores chunks from y=0, but the damage
// threshold follows the official y=-64 boundary.
export const VOID_DAMAGE_Y = -64
export const VOID_DAMAGE = 4
export const VOID_DAMAGE_INTERVAL_SECS = 0.5

export const NON_SUFFOCATING_BLOCKS = new Set<BlockType>([
  'AIR',
  'WATER',
  'LAVA',
  'LEAVES',
  'GLASS',
  'TORCH',
  'NETHER_PORTAL',
  'FARMLAND',
  'WHEAT_CROP',
  'REDSTONE_WIRE',
  'REDSTONE_TORCH',
  'LEVER',
  'STONE_BUTTON',
  'PRESSURE_PLATE',
  'STONE_SLAB',
  'OAK_STAIRS',
  'REPEATER',
  'BED',
  'ENCHANTING_TABLE',
  'DOOR',
  'DOOR_OPEN',
  'LADDER',
  'COBWEB',
  'CACTUS',
  'SAPLING',
  'DANDELION',
  'POPPY',
  'BROWN_MUSHROOM',
  'RED_MUSHROOM',
  'TALL_GRASS',
  'FERN',
  'END_PORTAL_FRAME',
  'END_PORTAL',
  'CHORUS_FLOWER',
  'CHORUS_PLANT',
  'DRAGON_EGG',
  'END_CRYSTAL',
  'END_GATEWAY',
  'END_ROD',
  'ENDER_CHEST',
  'PURPUR_SLAB',
  'PURPUR_STAIRS',
  'SHULKER_BOX',
])
