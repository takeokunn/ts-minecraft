import { Data, Option } from 'effect'
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  PLAYER_HALF_HEIGHT,
  SEA_LEVEL,
  blockIndex,
  blockTypeToIndex,
  isValidBlockIndex,
} from '@ts-minecraft/core'
import type { BlockTypeIndex } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'

const FALLBACK_SURFACE_Y = 64
const FALLBACK_HEADROOM = 3
const SPAWN_HEADROOM_BLOCKS = 2
const OPEN_VIEW_DISTANCE_BLOCKS = 5
const MAX_SURFACE_Y = FALLBACK_SURFACE_Y + 32
const SPAWN_OPENNESS_WEIGHT = 1000
const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const AIR = blockTypeToIndex('AIR')
const WATER = blockTypeToIndex('WATER')
const LAVA = blockTypeToIndex('LAVA')

// Block types that should NOT be used as spawn surfaces.
// Non-solid / semi-solid / transparent / interactive-only blocks.
// All uncategorized blocks (STONE, DIRT, GRASS, SAND, GRAVEL, etc.) default to valid.
const NON_SPAWN_SURFACE_BLOCK_IDS: ReadonlySet<BlockTypeIndex> = new Set([
  AIR,
  WATER,
  LAVA,
  blockTypeToIndex('WOOD'), // log — semi-solid / tree
  blockTypeToIndex('LEAVES'), // foliage — non-solid
  blockTypeToIndex('TORCH'), // non-solid
  blockTypeToIndex('LADDER'), // non-solid climbable
  blockTypeToIndex('COBWEB'), // non-solid slowing block
  blockTypeToIndex('SAPLING'), // non-solid plant
  blockTypeToIndex('DANDELION'), // non-solid plant
  blockTypeToIndex('POPPY'), // non-solid plant
  blockTypeToIndex('BROWN_MUSHROOM'), // non-solid plant
  blockTypeToIndex('RED_MUSHROOM'), // non-solid plant
  blockTypeToIndex('TALL_GRASS'), // non-solid plant
  blockTypeToIndex('FERN'), // non-solid plant
  blockTypeToIndex('SUGAR_CANE'), // non-solid plant
  blockTypeToIndex('CACTUS'), // hazardous plant
  blockTypeToIndex('LILY_PAD'), // water plant
  blockTypeToIndex('GLASS'), // transparent
  // Redstone / interactive — non-solid blocks
  blockTypeToIndex('REDSTONE_WIRE'),
  blockTypeToIndex('REDSTONE_TORCH'),
  blockTypeToIndex('LEVER'),
  blockTypeToIndex('STONE_BUTTON'),
  blockTypeToIndex('PRESSURE_PLATE'),
  blockTypeToIndex('REPEATER'),
  blockTypeToIndex('DOOR'),
  blockTypeToIndex('DOOR_OPEN'),
  // Portal blocks
  blockTypeToIndex('NETHER_PORTAL'),
  blockTypeToIndex('END_PORTAL'),
  blockTypeToIndex('END_GATEWAY'),
  // Crops & decor
  blockTypeToIndex('WHEAT_CROP'),
  // End dimension blocks that are non-solid
  blockTypeToIndex('END_ROD'),
  blockTypeToIndex('CHORUS_FLOWER'),
  blockTypeToIndex('CHORUS_PLANT'),
  blockTypeToIndex('END_CRYSTAL'),
  // Functional
  blockTypeToIndex('BED'),
])

const DIRECTIONS: ReadonlyArray<{ readonly dx: number; readonly dz: number; readonly yaw: number }> = [
  { dx: 0, dz: -1, yaw: 0 },
  { dx: 1, dz: 0, yaw: -Math.PI / 2 },
  { dx: 0, dz: 1, yaw: Math.PI },
  { dx: -1, dz: 0, yaw: Math.PI / 2 },
]

type SpawnSelectionLike = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly yaw: number
}

export type SpawnSelection = SpawnSelectionLike

export type SpawnCandidate = SpawnSelectionLike & {
  readonly surfaceY: number
  readonly distanceSq: number
  readonly openness: number
}

export class SpawnSelectionChunkError extends Data.TaggedError('SpawnSelectionChunkError')<{
  readonly message: string
}> {}

export const keyOf = (cx: number, cz: number) => `${cx},${cz}`

const chunkCoordFromWorld = (coord: number): number => Math.floor(coord / CHUNK_SIZE)

const localCoordFromWorld = (coord: number): number => ((coord % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

const localBlockIndex = (lx: number, y: number, lz: number): number | null =>
  Option.getOrNull(blockIndex(lx, y, lz))

const readLoadedChunkBlock = (chunk: Chunk, idx: number): BlockTypeIndex => {
  if (chunk.blocks.length !== CHUNK_BLOCK_COUNT) {
    throw new SpawnSelectionChunkError({
      message: `chunk ${keyOf(chunk.coord.x, chunk.coord.z)} has ${chunk.blocks.length} block ids; expected ${CHUNK_BLOCK_COUNT}`,
    })
  }
  if (idx < 0 || idx >= CHUNK_BLOCK_COUNT) {
    throw new SpawnSelectionChunkError({ message: `block index ${idx} is outside chunk storage` })
  }
  const blockId = chunk.blocks[idx]
  if (!isValidBlockIndex(blockId)) {
    throw new SpawnSelectionChunkError({
      message: `chunk ${keyOf(chunk.coord.x, chunk.coord.z)} has invalid block id at index ${idx}: ${String(blockId)}`,
    })
  }
  return blockId
}

const blockAt = (chunks: ReadonlyMap<string, Chunk>, wx: number, y: number, wz: number): BlockTypeIndex => {
  if (y < 0 || y >= CHUNK_HEIGHT) return AIR
  const chunk = chunks.get(keyOf(chunkCoordFromWorld(wx), chunkCoordFromWorld(wz)))
  if (chunk === undefined) return AIR
  const idx = localBlockIndex(localCoordFromWorld(wx), y, localCoordFromWorld(wz))
  if (idx === null) {
    throw new SpawnSelectionChunkError({ message: `world block position ${wx},${y},${wz} produced no chunk-local index` })
  }
  return readLoadedChunkBlock(chunk, idx)
}

const hasSkyVisibleHeadroom = (chunks: ReadonlyMap<string, Chunk>, wx: number, surfaceY: number, wz: number): boolean => {
  if (surfaceY + SPAWN_HEADROOM_BLOCKS >= CHUNK_HEIGHT) return false
  for (let y = surfaceY + 1; y < CHUNK_HEIGHT; y++) {
    if (blockAt(chunks, wx, y, wz) !== AIR) return false
  }
  return true
}

// Returns the total openness across all 4 cardinal directions (max 20 = 4 × 5)
// and the yaw of the single most-open direction. A wide-open plains column
// scores ~20 while a cave-adjacent surface with walls on 3 sides scores ~5.
const openDirection = (chunks: ReadonlyMap<string, Chunk>, wx: number, surfaceY: number, wz: number) => {
  let totalOpenness = 0
  let bestYaw = 0
  let bestOpenness = -1
  for (const dir of DIRECTIONS) {
    let openness = 0
    for (let step = 1; step <= OPEN_VIEW_DISTANCE_BLOCKS; step++) {
      const x = wx + dir.dx * step
      const z = wz + dir.dz * step
      const feetAir = blockAt(chunks, x, surfaceY + 1, z) === AIR
      const headAir = blockAt(chunks, x, surfaceY + 2, z) === AIR
      if (feetAir && headAir) openness++
      else break
    }
    totalOpenness += openness
    if (openness > bestOpenness) {
      bestOpenness = openness
      bestYaw = dir.yaw
    }
  }
  return { yaw: bestYaw, openness: totalOpenness }
}

export const scoreSpawnCandidate = (candidate: Pick<SpawnCandidate, 'openness' | 'distanceSq'>): number =>
  candidate.openness * SPAWN_OPENNESS_WEIGHT - candidate.distanceSq

export const candidateAt = (
  chunks: ReadonlyMap<string, Chunk>,
  base: { readonly x: number; readonly z: number },
  wx: number,
  wz: number,
): Option.Option<SpawnCandidate> => {
  const surfaceLimit = Math.min(CHUNK_HEIGHT - SPAWN_HEADROOM_BLOCKS, MAX_SURFACE_Y)
  for (let surfaceY = surfaceLimit - 1; surfaceY >= 0; surfaceY--) {
    if (NON_SPAWN_SURFACE_BLOCK_IDS.has(blockAt(chunks, wx, surfaceY, wz))) continue
    if (!hasSkyVisibleHeadroom(chunks, wx, surfaceY, wz)) continue

    const facing = openDirection(chunks, wx, surfaceY, wz)
    return Option.some({
      position: { x: wx + 0.5, y: surfaceY + 1 + PLAYER_HALF_HEIGHT, z: wz + 0.5 },
      yaw: facing.yaw,
      surfaceY,
      openness: facing.openness,
      distanceSq: (wx + 0.5 - base.x) ** 2 + (wz + 0.5 - base.z) ** 2,
    })
  }
  return Option.none()
}

// Any column whose surface dips below SEA_LEVEL is water-filled, so a spawn body Y below the
// water surface means the player spawns SUBMERGED — they take drowning damage and die before
// they can react (observed: 'YOU DIED / Drowning' on a fresh ocean-fallback world). Final
// safety net: never spawn below the water line. The water surface top is SEA_LEVEL+1, so the
// body centre must be at least SEA_LEVEL+1+PLAYER_HALF_HEIGHT (feet on the surface). No-op for
// normal land spawns (already above sea level); lifts only submerged spawns onto the surface.
const MIN_SPAWN_BODY_Y = SEA_LEVEL + 1 + PLAYER_HALF_HEIGHT
export const clampAboveWater = (sel: SpawnSelectionLike): SpawnSelectionLike =>
  sel.position.y >= MIN_SPAWN_BODY_Y
    ? sel
    : { ...sel, position: { ...sel.position, y: MIN_SPAWN_BODY_Y } }

export const selectSurfaceSpawn = (
  chunks: ReadonlyArray<Chunk>,
  baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number },
): SpawnSelection => {
  const chunkMap = new Map<string, Chunk>()
  for (const chunk of chunks) {
    chunkMap.set(keyOf(chunk.coord.x, chunk.coord.z), chunk)
  }

  let best: SpawnCandidate | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const chunk of chunks) {
    const baseWorldX = chunk.coord.x * CHUNK_SIZE
    const baseWorldZ = chunk.coord.z * CHUNK_SIZE
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseWorldX + lx
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const candidate = Option.getOrNull(candidateAt(chunkMap, baseSpawnPosition, wx, baseWorldZ + lz))
        if (candidate === null) continue
        // Prefer open-surface spawns: weight openness heavily so distance only
        // breaks ties. A wide-open plains column 30 blocks away is better than
        // a cave-adjacent surface right next to the origin.
        const candidateScore = scoreSpawnCandidate(candidate)
        if (candidateScore > bestScore) {
          best = candidate
          bestScore = candidateScore
        }
      }
    }
  }

  if (best !== null) {
    return clampAboveWater({ position: best.position, yaw: best.yaw })
  }

  // No valid surface candidate found — scan loaded chunks for any
  // solid ground as a last-resort fallback before using the fixed height.
  const fallbackY = 67.9
  const safetyY = findFallbackSurfaceY(chunkMap, baseSpawnPosition)
  return clampAboveWater({ position: { ...baseSpawnPosition, y: safetyY ?? fallbackY }, yaw: 0 })
}

// Scan ALL loaded chunks for solid ground as a last-resort fallback (e.g. the origin
// sits in a large ocean and no clear-sky land candidate exists). The previous version
// counted WATER/LAVA as "ground" (blocks !== AIR), so on an ocean origin it spawned the
// player at/under the water surface — they then sank underwater with nothing to see.
// Now: find the topmost SOLID block per column; PREFER dry columns; and for a submerged
// column spawn ABOVE the water surface so the player is at least visible above water.
export const findFallbackSurfaceY = (
  chunkMap: ReadonlyMap<string, Chunk>,
  base: { readonly x: number; readonly z: number },
): number | undefined => {
  type Candidate = { readonly y: number; readonly distSq: number; readonly dry: boolean }
  let best: Candidate | undefined
  // A dry column always beats a wet one; among equals, the nearest to origin wins.
  const isBetter = (c: Candidate): boolean => best === undefined || (c.dry !== best.dry ? c.dry : c.distSq < best.distSq)

  for (const chunk of chunkMap.values()) {
    const cx = chunk.coord.x
    const cz = chunk.coord.z
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        let fluidTop = -1
        let solidTop = -1
        for (let y = FALLBACK_SURFACE_Y + FALLBACK_HEADROOM; y > 0; y--) {
          const idx = localBlockIndex(lx, y, lz)
          if (idx === null) continue
          const b = readLoadedChunkBlock(chunk, idx)
          if (b === AIR) continue
          if (b === WATER || b === LAVA) {
            if (fluidTop < 0) fluidTop = y
            continue
          }
          solidTop = y
          break // topmost solid block in this column
        }
        if (solidTop < 0) continue // no solid ground here
        const wx = cx * CHUNK_SIZE + lx
        const wz = cz * CHUNK_SIZE + lz
        const dry = fluidTop < 0
        // Submerged ground → spawn above the water surface, not on the seabed.
        const topY = dry ? solidTop : Math.max(solidTop, fluidTop)
        const candidate: Candidate = {
          y: topY + 1 + PLAYER_HALF_HEIGHT,
          distSq: (wx + 0.5 - base.x) ** 2 + (wz + 0.5 - base.z) ** 2,
          dry,
        }
        if (isBetter(candidate)) best = candidate
      }
    }
  }
  return best?.y
}
