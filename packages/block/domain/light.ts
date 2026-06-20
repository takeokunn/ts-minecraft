import { BLOCK_COUNT, BlockType, CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import { initialBlocks } from './blocks.config'

// 4-bit-per-voxel light grids. Storage: Uint8Array of LIGHT_BYTE_LENGTH bytes; 2 voxels per byte (low/high nibbles).
export const LIGHT_LEVEL_MAX = 15
export const LIGHT_LEVEL_MIN = 0
export const LIGHT_BYTE_LENGTH = (CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) / 2

export type LightGrids = Readonly<{
  readonly skyLight: Uint8Array
  readonly blockLight: Uint8Array
}>

const TRANSPARENCY_TABLE: Record<BlockType, boolean> = (() => {
  const table = {} as Record<BlockType, boolean>
  for (const block of initialBlocks) table[block.type] = block.properties.transparency
  return table
})()

// LAVA=15, FIRE=15, REDSTONE_BLOCK=15, REDSTONE_ORE=9, DEEPSLATE_REDSTONE_ORE=9.
// TORCH=14: vanilla torch emits light level 14, not the default 15.
// REDSTONE_TORCH=7, NETHER_PORTAL=11, END_PORTAL_FRAME=1: each emits a dimmer vanilla level
// rather than the default 15, so a redstone torch no longer floods a room like lava.
const EMISSIVE_LEVEL_OVERRIDES: Partial<Record<BlockType, number>> = {
  LAVA: 15,
  FIRE: 15,
  REDSTONE_BLOCK: 15,
  REDSTONE_ORE: 9,
  DEEPSLATE_REDSTONE_ORE: 9,
  TORCH: 14,
  REDSTONE_TORCH: 7,
  NETHER_PORTAL: 11,
  END_PORTAL_FRAME: 1,
}

const EMISSIVE_TABLE: Record<BlockType, number> = (() => {
  const table = {} as Record<BlockType, number>
  for (const block of initialBlocks) {
    table[block.type] = block.properties.emissive
      ? (EMISSIVE_LEVEL_OVERRIDES[block.type] ?? LIGHT_LEVEL_MAX)
      : LIGHT_LEVEL_MIN
  }
  return table
})()

// Uint8Array for tight BFS inner-loop access (avoid object property lookup overhead).
const TRANSPARENCY_BY_INDEX: Uint8Array = (() => {
  const arr = new Uint8Array(BLOCK_COUNT)
  for (const block of initialBlocks) arr[blockTypeToIndex(block.type)] = block.properties.transparency ? 1 : 0
  return arr
})()

const EMISSIVE_BY_INDEX: Uint8Array = (() => {
  const arr = new Uint8Array(BLOCK_COUNT)
  for (const block of initialBlocks) arr[blockTypeToIndex(block.type)] = EMISSIVE_TABLE[block.type]
  return arr
})()

export const isTransparent = (blockType: BlockType): boolean => TRANSPARENCY_TABLE[blockType]

export const emissiveLightLevel = (blockType: BlockType): number => EMISSIVE_TABLE[blockType]

const isBlockIndexInTable = (blockIdx: number): boolean =>
  Number.isInteger(blockIdx) && blockIdx >= 0 && blockIdx < BLOCK_COUNT

const transparencyByIndex = (blockIdx: number): 0 | 1 => {
  if (!isBlockIndexInTable(blockIdx)) return 0
  return TRANSPARENCY_BY_INDEX[blockIdx] === 1 ? 1 : 0
}

const emissiveByIndex = (blockIdx: number): number => {
  if (!isBlockIndexInTable(blockIdx)) return LIGHT_LEVEL_MIN
  return EMISSIVE_BY_INDEX[blockIdx] ?? LIGHT_LEVEL_MIN
}

export const isTransparentIndex = (blockIdx: number): boolean =>
  transparencyByIndex(blockIdx) === 1

export const emissiveLevelByIndex = (blockIdx: number): number =>
  emissiveByIndex(blockIdx)

export const createLightBuffer = (): Uint8Array<ArrayBufferLike> => new Uint8Array(LIGHT_BYTE_LENGTH)

const voxelIndex = (lx: number, y: number, lz: number): number => blockIndexUnsafe(lx, y, lz)

const lightByteAt = (grid: Uint8Array, byteIdx: number): number => grid[byteIdx] ?? 0

const blockIndexAt = (blocks: Uint8Array, voxelIdx: number): number => blocks[voxelIdx] ?? 0

// Caller must ensure 0 ≤ lx < CHUNK_SIZE, 0 ≤ y < CHUNK_HEIGHT, 0 ≤ lz < CHUNK_SIZE.
export const getLightAt = (grid: Uint8Array, lx: number, y: number, lz: number): number => {
  const vi = voxelIndex(lx, y, lz)
  const byteIdx = vi >> 1
  const byte = lightByteAt(grid, byteIdx)
  return (vi & 1) === 0 ? byte & 0x0f : (byte >> 4) & 0x0f
}

export const setLightAt = (grid: Uint8Array, lx: number, y: number, lz: number, value: number): void => {
  const v = value < 0 ? 0 : value > 15 ? 15 : value
  const vi = voxelIndex(lx, y, lz)
  const byteIdx = vi >> 1
  const byte = lightByteAt(grid, byteIdx)
  grid[byteIdx] = (vi & 1) === 0
    ? (byte & 0xf0) | v
    : (byte & 0x0f) | (v << 4)
}

export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
]

// Encode (x,y,z) packed into one 32-bit int: x:4 | z:4 | y:9 (bits suffice for 16/16/256).
const packCoord = (x: number, y: number, z: number): number => (x << 13) | (z << 9) | y

// plain number[] queue with head pointer — avoids shift() O(n) on hot BFS loop.
const propagateLightBFS = (blocks: Uint8Array, lightGrid: Uint8Array, queue: number[]): void => {
  let head = 0
  while (head < queue.length) {
    const packed = queue[head] ?? 0
    head += 1
    const x = (packed >> 13) & 0x0f
    const z = (packed >> 9) & 0x0f
    const y = packed & 0x1ff
    const currentLevel = getLightAt(lightGrid, x, y, z)
    if (currentLevel <= 1) continue
    const nextLevel = currentLevel - 1
    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      const nz = z + dz
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) continue
      const nvi = voxelIndex(nx, ny, nz)
      const nBlock = blockIndexAt(blocks, nvi)
      if (transparencyByIndex(nBlock) === 0) continue
      const existing = getLightAt(lightGrid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(lightGrid, nx, ny, nz, nextLevel)
      queue.push(packCoord(nx, ny, nz))
    }
  }
}

export const computeBlockLight = (blocks: Uint8Array, lightGrid: Uint8Array): void => {
  lightGrid.fill(0)
  const queue: number[] = []

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const vi = voxelIndex(x, y, z)
        const blockIdx = blockIndexAt(blocks, vi)
        const emit = emissiveByIndex(blockIdx)
        if (emit > 0) {
          setLightAt(lightGrid, x, y, z, emit)
          queue.push(packCoord(x, y, z))
        }
      }
    }
  }

  propagateLightBFS(blocks, lightGrid, queue)
}

// Highest opaque block anywhere in the chunk (-1 if none). CHUNK_HEIGHT is a power of
// two so `i & (CHUNK_HEIGHT - 1)` extracts the y of flat index i for free.
const highestOpaqueY = (blocks: Uint8Array): number => {
  let maxY = -1
  for (let i = 0; i < blocks.length; i++) {
    const blockIdx = blockIndexAt(blocks, i)
    if (blockIdx !== 0 && transparencyByIndex(blockIdx) === 0) {
      const y = i & (CHUNK_HEIGHT - 1)
      if (y > maxY) maxY = y
    }
  }
  return maxY
}

export const computeSkyLight = (blocks: Uint8Array, lightGrid: Uint8Array): void => {
  lightGrid.fill(0)
  const queue: number[] = []

  // Cells above the highest opaque block are open sky (15) and uniformly surrounded by
  // 15 — they can never lower a neighbour, so they are NEVER useful BFS sources. Seeding
  // them just makes the BFS churn ~50k no-op cells (the dominant cost; for flat terrain
  // with no overhangs the entire BFS was wasted). Set them lit but skip the queue; only
  // cells at/below the terrain line (possible shadow boundaries) seed the BFS.
  const maxOpaqueY = highestOpaqueY(blocks)

  // Column-wise sky seeding: each column receives level 15 from top down until hitting opaque.
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      let y = CHUNK_HEIGHT - 1
      // Open sky above all terrain: lit, but not a BFS source.
      for (; y > maxOpaqueY; y--) setLightAt(lightGrid, x, y, z, LIGHT_LEVEL_MAX)
      // From the terrain line down: lit + enqueued (shadow boundary) until opaque.
      for (; y >= 0; y--) {
        const vi = voxelIndex(x, y, z)
        const blockIdx = blockIndexAt(blocks, vi)
        if (transparencyByIndex(blockIdx) === 0) break
        setLightAt(lightGrid, x, y, z, LIGHT_LEVEL_MAX)
        queue.push(packCoord(x, y, z))
      }
    }
  }

  propagateLightBFS(blocks, lightGrid, queue)
}
