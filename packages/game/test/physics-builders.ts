/**
 * Test builders for physics-related tests.
 * Centralizes repeated setup patterns so individual test files stay concise.
 */

import { Effect, Layer } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import type { WorldConfig } from '@ts-minecraft/game'
import {
  PhysicsService,
  PhysicsWorldPortLayer,
  RigidBodyPortLayer,
  ShapePortLayer,
} from '@ts-minecraft/game'
import type { AddBodyConfig } from '@ts-minecraft/game'

// ---------------------------------------------------------------------------
// Constants — single source of truth for magic numbers used in physics tests
// ---------------------------------------------------------------------------

/** Default Minecraft-like gravity vector (m/s²). */
export const DEFAULT_GRAVITY: WorldConfig['gravity'] = { x: 0, y: -9.82, z: 0 }

/** Zero gravity — useful for isolating non-gravity behaviour. */
export const ZERO_GRAVITY: WorldConfig['gravity'] = { x: 0, y: 0, z: 0 }

/** Standard player half-width for AABB collision tests. */
export const PLAYER_HALF_W = 0.3

/** Standard player half-height for AABB collision tests. */
export const PLAYER_HALF_H = 0.9

/** One simulation frame at 60 Hz. */
export const ONE_FRAME_DT = DeltaTimeSecs.make(1 / 60)

/** Maximum capped delta-time (from game-loop.ts). */
export const MAX_FRAME_DT = DeltaTimeSecs.make(0.05)

// ---------------------------------------------------------------------------
// Layer helpers
// ---------------------------------------------------------------------------

/** Layer that wires all physics port implementations into PhysicsService. */
export const PhysicsTestLayer = PhysicsService.Default.pipe(
  Layer.provide(PhysicsWorldPortLayer),
  Layer.provide(RigidBodyPortLayer),
  Layer.provide(ShapePortLayer),
)

// ---------------------------------------------------------------------------
// Effect builders
// ---------------------------------------------------------------------------

/**
 * Returns a PhysicsService that is already initialized with the supplied
 * gravity config (defaults to DEFAULT_GRAVITY).
 * Re-use this whenever a test needs to call addBody / step / getPosition etc.
 */
export const makeInitializedService = (config: WorldConfig = { gravity: DEFAULT_GRAVITY }) =>
  Effect.gen(function* () {
    const service = yield* PhysicsService
    yield* service.initialize(config)
    return service
  })

/**
 * A ready-to-use dynamic box body config with sensible defaults.
 * Supply overrides to customise individual fields.
 */
export const makeBoxBodyConfig = (overrides: Partial<AddBodyConfig> = {}): AddBodyConfig => ({
  mass: 70,
  position: { x: 0, y: 10, z: 0 },
  shape: 'box',
  shapeParams: { halfExtents: { x: PLAYER_HALF_W, y: PLAYER_HALF_H, z: PLAYER_HALF_W } },
  ...overrides,
})

/**
 * A ready-to-use sphere body config.
 * Supply overrides to customise individual fields.
 */
export const makeSphereBodyConfig = (overrides: Partial<AddBodyConfig> = {}): AddBodyConfig => ({
  mass: 5,
  position: { x: 0, y: 10, z: 0 },
  shape: 'sphere',
  shapeParams: { radius: 0.5 },
  ...overrides,
})

/**
 * A ready-to-use static plane body config (ground).
 * Supply overrides to customise individual fields.
 */
export const makePlaneBodyConfig = (overrides: Partial<AddBodyConfig> = {}): AddBodyConfig => ({
  mass: 0,
  position: { x: 0, y: 0, z: 0 },
  shape: 'plane',
  type: 'static',
  ...overrides,
})

// ---------------------------------------------------------------------------
// ChunkCache builder for block-collision-predicate tests
// ---------------------------------------------------------------------------

/** Total number of blocks per chunk (CHUNK_SIZE=16, CHUNK_HEIGHT=256). */
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 256
export const BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

/**
 * Compute the storage index for a block at local chunk coordinates (x, y, z).
 * Mirrors `chunkBlockIndexUnchecked` from @ts-minecraft/world.
 */
export const chunkBlockIndex = (x: number, y: number, z: number): number =>
  y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE

/**
 * Block type indices (mirrors `blockTypeToIndex` from @ts-minecraft/core).
 * Listed here so tests do not depend on block-codec internals.
 */
export const BLOCK_IDS = {
  AIR: 0,
  DIRT: 1,
  STONE: 2,
  WATER: 6,
  LEAVES: 7,
  LAVA: 17,
  TORCH: 43,
  LADDER: 76,
  COBWEB: 77,
  SAPLING: 78,
  DANDELION: 79,
  POPPY: 80,
  BROWN_MUSHROOM: 81,
  RED_MUSHROOM: 82,
  TALL_GRASS: 83,
  FERN: 84,
  SUGAR_CANE: 85,
  CACTUS: 86,
  LILY_PAD: 87,
  ICE: 88,
} as const

/**
 * Build a flat 9-element chunk cache for the 3×3 neighbourhood around a
 * player standing at chunk (playerCx, playerCz).
 *
 * `slotBlocks` maps relative chunk offset [dx+1][dz+1] → a function that
 * populates the Uint8Array, or `null` for an unloaded chunk.
 *
 * The default is all-air chunks.
 */
export const makeChunkCache = (
  populate?: (blocks: Uint8Array, relDx: number, relDz: number) => void,
): Array<{ blocks: Uint8Array } | null> => {
  const cache: Array<{ blocks: Uint8Array } | null> = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const blocks = new Uint8Array(BLOCKS_PER_CHUNK)
      if (populate) populate(blocks, dx, dz)
      cache.push({ blocks })
    }
  }
  return cache
}

/**
 * Build an all-air 9-slot chunk cache (player at chunk 0,0).
 */
export const makeAirChunkCache = (): Array<{ blocks: Uint8Array } | null> =>
  makeChunkCache()

/**
 * Build a chunk cache where the center chunk (dx=0,dz=0) has a single
 * solid block at world coordinates (wx, wy, wz) within chunk (playerCx, playerCz).
 */
export const makeSingleBlockCache = (
  blockId: number,
  localX: number,
  localY: number,
  localZ: number,
): Array<{ blocks: Uint8Array } | null> =>
  makeChunkCache((blocks, relDx, relDz) => {
    if (relDx === 0 && relDz === 0) {
      blocks[chunkBlockIndex(localX, localY, localZ)] = blockId
    }
  })

/**
 * Build a 9-slot cache where every slot is null (all chunks unloaded).
 */
export const makeNullChunkCache = (): Array<{ blocks: Uint8Array } | null> =>
  Array.from({ length: 9 }, () => null)
