import { Array as Arr } from 'effect'
import { BlockType } from './block'
import { initialBlocks } from './block-registry'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from './chunk'

/**
 * Block light engine (Phase 1.6)
 *
 * Each chunk may store two 4-bit-per-voxel light grids:
 *   - skyLight:   propagates from y=CHUNK_HEIGHT-1 downward through transparent blocks
 *   - blockLight: emitted by emissive blocks (LAVA=15, REDSTONE_ORE=9, etc.)
 *
 * Storage: Uint8Array of length (CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT / 2).
 * Each byte packs 2 adjacent voxels (voxelIndex 2k → low nibble, 2k+1 → high nibble).
 */

export const LIGHT_LEVEL_MAX = 15
export const LIGHT_LEVEL_MIN = 0
export const LIGHT_BYTE_LENGTH = (CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) / 2

/**
 * A pair of computed per-voxel light grids for a chunk: sky and block (emissive) light.
 * Each Uint8Array is LIGHT_BYTE_LENGTH bytes, packing 2 voxels per byte (low/high nibbles).
 */
export type LightGrids = Readonly<{
  readonly skyLight: Uint8Array
  readonly blockLight: Uint8Array
}>

/**
 * Static transparency table: derived from block-registry's `transparency` flag.
 * A transparent block allows light to propagate through it.
 */
const TRANSPARENCY_TABLE: Record<BlockType, boolean> = (() => {
  const table = {} as Record<BlockType, boolean>
  Arr.forEach(initialBlocks, (b) => {
    table[b.type] = b.properties.transparency
  })
  return table
})()

/**
 * Emissive light level per block type.
 * Phase 1.6: LAVA=15, REDSTONE_BLOCK=15, REDSTONE_ORE=9, DEEPSLATE_REDSTONE_ORE=9.
 * Non-emissive blocks are 0. Derived from block-registry's `emissive` flag combined
 * with a hardcoded level map (registry stores only a boolean, not a numeric level).
 */
const EMISSIVE_LEVEL_OVERRIDES: Partial<Record<BlockType, number>> = {
  LAVA: 15,
  REDSTONE_BLOCK: 15,
  REDSTONE_ORE: 9,
  DEEPSLATE_REDSTONE_ORE: 9,
}

const EMISSIVE_TABLE: Record<BlockType, number> = (() => {
  const table = {} as Record<BlockType, number>
  Arr.forEach(initialBlocks, (b) => {
    table[b.type] = b.properties.emissive ? (EMISSIVE_LEVEL_OVERRIDES[b.type] ?? LIGHT_LEVEL_MAX) : 0
  })
  return table
})()

/**
 * Same-length lookup table indexed by BlockType numeric index (0=AIR, ...).
 * Built as Uint8Array for tight BFS inner-loop access.
 */
const TRANSPARENCY_BY_INDEX: Uint8Array = (() => {
  const arr = new Uint8Array(64)
  Arr.forEach(initialBlocks, (b) => {
    arr[blockTypeToIndex(b.type)] = b.properties.transparency ? 1 : 0
  })
  return arr
})()

const EMISSIVE_BY_INDEX: Uint8Array = (() => {
  const arr = new Uint8Array(64)
  Arr.forEach(initialBlocks, (b) => {
    arr[blockTypeToIndex(b.type)] = EMISSIVE_TABLE[b.type]
  })
  return arr
})()

export const isTransparent = (blockType: BlockType): boolean => TRANSPARENCY_TABLE[blockType]

export const emissiveLightLevel = (blockType: BlockType): number => EMISSIVE_TABLE[blockType]

export const isTransparentIndex = (blockIdx: number): boolean =>
  (TRANSPARENCY_BY_INDEX[blockIdx] ?? 0) === 1

export const emissiveLevelByIndex = (blockIdx: number): number =>
  EMISSIVE_BY_INDEX[blockIdx] ?? 0

/**
 * Allocate a zero-filled light grid sized for one chunk.
 */
export const createLightBuffer = (): Uint8Array<ArrayBufferLike> => new Uint8Array(LIGHT_BYTE_LENGTH)

/**
 * Map (lx, y, lz) → voxel index matching the block layout convention.
 */
const voxelIndex = (lx: number, y: number, lz: number): number => blockIndexUnsafe(lx, y, lz)

/**
 * Read a 4-bit light value (0..15) at the given local coordinates.
 * Caller must ensure 0 ≤ lx < CHUNK_SIZE, 0 ≤ y < CHUNK_HEIGHT, 0 ≤ lz < CHUNK_SIZE.
 */
export const getLightAt = (grid: Uint8Array, lx: number, y: number, lz: number): number => {
  const vi = voxelIndex(lx, y, lz)
  const byteIdx = vi >> 1
  const byte = grid[byteIdx] ?? 0
  return (vi & 1) === 0 ? byte & 0x0f : (byte >> 4) & 0x0f
}

/**
 * Write a 4-bit light value at the given local coordinates (in-place mutation).
 * Value is clamped to [0, 15].
 */
export const setLightAt = (grid: Uint8Array, lx: number, y: number, lz: number, value: number): void => {
  const v = value < 0 ? 0 : value > 15 ? 15 : value
  const vi = voxelIndex(lx, y, lz)
  const byteIdx = vi >> 1
  const byte = grid[byteIdx] ?? 0
  grid[byteIdx] = (vi & 1) === 0
    ? (byte & 0xf0) | v
    : (byte & 0x0f) | (v << 4)
}

/**
 * Neighbor offsets for 6-direction BFS (±x, ±y, ±z).
 */
export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
]

/**
 * Compute block-light BFS flood-fill into `lightGrid` from emissive sources in `blocks`.
 * Uses a plain `number[]` queue with a head pointer for hot-loop performance.
 * Pure sync compute — no Effect wrapper.
 */
export const computeBlockLight = (blocks: Uint8Array, lightGrid: Uint8Array): void => {
  // Zero the grid — caller may pass a stale buffer.
  lightGrid.fill(0)
  // BFS queue: each entry is a packed position (vi) with its light level tracked via grid lookup.
  // We push vi for each seeded/propagated cell; level is always grid[vi].
  const queue: number[] = []
  // Seed: iterate every voxel, enqueue emissive ones.
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const vi = voxelIndex(x, y, z)
        const blockIdx = blocks[vi] ?? 0
        const emit = EMISSIVE_BY_INDEX[blockIdx] ?? 0
        if (emit > 0) {
          setLightAt(lightGrid, x, y, z, emit)
          // Encode (x,y,z) packed into one 32-bit int: x:4 | z:4 | y:9 (bits suffice for 16/16/256)
          queue.push((x << 13) | (z << 9) | y)
        }
      }
    }
  }
  let head = 0
  while (head < queue.length) {
    const packed = queue[head++] ?? 0
    const x = (packed >> 13) & 0x0f
    const z = (packed >> 9) & 0x0f
    const y = packed & 0x1ff
    const currentLevel = getLightAt(lightGrid, x, y, z)
    if (currentLevel <= 1) continue
    const nextLevel = currentLevel - 1
    for (let i = 0; i < NEIGHBOR_OFFSETS.length; i++) {
      const offset = NEIGHBOR_OFFSETS[i]!
      const nx = x + offset[0]
      const ny = y + offset[1]
      const nz = z + offset[2]
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) continue
      const nvi = voxelIndex(nx, ny, nz)
      const nBlock = blocks[nvi] ?? 0
      if ((TRANSPARENCY_BY_INDEX[nBlock] ?? 0) === 0) continue
      const existing = getLightAt(lightGrid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(lightGrid, nx, ny, nz, nextLevel)
      queue.push((nx << 13) | (nz << 9) | ny)
    }
  }
}

/**
 * Compute sky-light BFS. Starts at y = CHUNK_HEIGHT - 1 for every (x,z) column,
 * seeds all consecutive transparent voxels from top down with level 15 until the
 * first opaque block, then runs standard BFS from all seeded cells.
 */
export const computeSkyLight = (blocks: Uint8Array, lightGrid: Uint8Array): void => {
  lightGrid.fill(0)
  const queue: number[] = []
  // Column-wise sky seeding: each column receives level 15 from top down until hitting opaque.
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const vi = voxelIndex(x, y, z)
        const blockIdx = blocks[vi] ?? 0
        if ((TRANSPARENCY_BY_INDEX[blockIdx] ?? 0) === 0) break
        setLightAt(lightGrid, x, y, z, LIGHT_LEVEL_MAX)
        queue.push((x << 13) | (z << 9) | y)
      }
    }
  }
  let head = 0
  while (head < queue.length) {
    const packed = queue[head++] ?? 0
    const x = (packed >> 13) & 0x0f
    const z = (packed >> 9) & 0x0f
    const y = packed & 0x1ff
    const currentLevel = getLightAt(lightGrid, x, y, z)
    if (currentLevel <= 1) continue
    const nextLevel = currentLevel - 1
    for (let i = 0; i < NEIGHBOR_OFFSETS.length; i++) {
      const offset = NEIGHBOR_OFFSETS[i]!
      const nx = x + offset[0]
      const ny = y + offset[1]
      const nz = z + offset[2]
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) continue
      const nvi = voxelIndex(nx, ny, nz)
      const nBlock = blocks[nvi] ?? 0
      if ((TRANSPARENCY_BY_INDEX[nBlock] ?? 0) === 0) continue
      const existing = getLightAt(lightGrid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(lightGrid, nx, ny, nz, nextLevel)
      queue.push((nx << 13) | (nz << 9) | ny)
    }
  }
}
