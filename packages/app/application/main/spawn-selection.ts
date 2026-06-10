import { Array as Arr, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, PLAYER_HALF_HEIGHT, blockIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'

export type SpawnSelection = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly yaw: number
}

type SpawnCandidate = SpawnSelection & {
  readonly surfaceY: number
  readonly distanceSq: number
  readonly openness: number
}

const FALLBACK_SURFACE_Y = 64
const FALLBACK_HEADROOM = 3
const SPAWN_HEADROOM_BLOCKS = 2
const OPEN_VIEW_DISTANCE_BLOCKS = 5
// Maximum Y above which the surface must not be — avoids spawning on top of tall structures
const MAX_SURFACE_Y = FALLBACK_SURFACE_Y + 32

const AIR = blockTypeToIndex('AIR')

// Block types that should NOT be used as spawn surfaces.
// Non-solid / semi-solid / transparent / interactive-only blocks.
// All uncategorized blocks (STONE, DIRT, GRASS, SAND, GRAVEL, etc.) default to valid.
const NON_SPAWN_SURFACE_BLOCK_IDS = new Set([
  AIR,
  blockTypeToIndex('WATER'),
  blockTypeToIndex('LAVA'),
  blockTypeToIndex('WOOD'),          // log — semi-solid / tree
  blockTypeToIndex('LEAVES'),        // foliage — non-solid
  blockTypeToIndex('TORCH'),         // non-solid
  blockTypeToIndex('GLASS'),         // transparent
  // Redstone / interactive — non-solid blocks
  blockTypeToIndex('REDSTONE_WIRE'),
  blockTypeToIndex('REDSTONE_TORCH'),
  blockTypeToIndex('LEVER'),
  blockTypeToIndex('STONE_BUTTON'),
  blockTypeToIndex('REPEATER'),
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

const keyOf = (cx: number, cz: number) => `${cx},${cz}`

const chunkCoordFromWorld = (coord: number): number => Math.floor(coord / CHUNK_SIZE)

const localCoordFromWorld = (coord: number): number => ((coord % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

const localBlockIndex = (lx: number, y: number, lz: number): number | null =>
  Option.getOrNull(blockIndex(lx, y, lz))

const blockAt = (chunks: ReadonlyMap<string, Chunk>, wx: number, y: number, wz: number): number => {
  if (y < 0 || y >= CHUNK_HEIGHT) return AIR
  const chunk = chunks.get(keyOf(chunkCoordFromWorld(wx), chunkCoordFromWorld(wz)))
  if (chunk === undefined) return AIR
  const idx = localBlockIndex(localCoordFromWorld(wx), y, localCoordFromWorld(wz))
  return idx === null ? AIR : chunk.blocks[idx] ?? AIR
}

const hasSkyVisibleHeadroom = (chunks: ReadonlyMap<string, Chunk>, wx: number, surfaceY: number, wz: number): boolean =>
  Arr.every(Arr.makeBy(CHUNK_HEIGHT - surfaceY - 1, (i) => surfaceY + 1 + i), (y) =>
    blockAt(chunks, wx, y, wz) === AIR
  ) && surfaceY + SPAWN_HEADROOM_BLOCKS < CHUNK_HEIGHT

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

const candidateAt = (
  chunks: ReadonlyMap<string, Chunk>,
  base: { readonly x: number; readonly z: number },
  wx: number,
  wz: number,
): Option.Option<SpawnCandidate> =>
  Arr.findFirst(
    Arr.makeBy(Math.min(CHUNK_HEIGHT - SPAWN_HEADROOM_BLOCKS, MAX_SURFACE_Y), (i) => Math.min(CHUNK_HEIGHT - SPAWN_HEADROOM_BLOCKS, MAX_SURFACE_Y) - 1 - i),
    (y) => !NON_SPAWN_SURFACE_BLOCK_IDS.has(blockAt(chunks, wx, y, wz)) && hasSkyVisibleHeadroom(chunks, wx, y, wz),
  ).pipe(
    Option.map((surfaceY) => {
      const facing = openDirection(chunks, wx, surfaceY, wz)
      return {
        position: { x: wx + 0.5, y: surfaceY + 1 + PLAYER_HALF_HEIGHT, z: wz + 0.5 },
        yaw: facing.yaw,
        surfaceY,
        openness: facing.openness,
        distanceSq: (wx + 0.5 - base.x) ** 2 + (wz + 0.5 - base.z) ** 2,
      }
    }),
  )

export const selectSurfaceSpawn = (
  chunks: ReadonlyArray<Chunk>,
  baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number },
): SpawnSelection => {
  const chunkMap = new Map(Arr.map(chunks, (chunk) => [keyOf(chunk.coord.x, chunk.coord.z), chunk] as const))
  const candidates = Arr.filterMap(
    Arr.flatMap(chunks, (chunk) =>
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
        Arr.map(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) => ({ chunk, lx, lz })),
      ),
    ),
    ({ chunk, lx, lz }) => candidateAt(
      chunkMap,
      baseSpawnPosition,
      chunk.coord.x * CHUNK_SIZE + lx,
      chunk.coord.z * CHUNK_SIZE + lz,
    ),
  )

  return Arr.reduce(candidates, Option.none<SpawnCandidate>(), (best, candidate) =>
    Option.match(best, {
      onNone: () => Option.some(candidate),
      onSome: (current) => {
        // Prefer open-surface spawns: weight openness heavily so distance only
        // breaks ties. A wide-open plains column 30 blocks away is better than
        // a cave-adjacent surface right next to the origin.
        const candidateScore = candidate.openness * 1000 - candidate.distanceSq
        const currentScore = current.openness * 1000 - current.distanceSq
        return candidateScore > currentScore ? Option.some(candidate) : best
      },
    }),
  ).pipe(
    Option.match({
      onNone: () => {
        // No valid surface candidate found — scan loaded chunks for any
        // solid ground as a last-resort fallback before using the fixed height.
        const fallbackY = FALLBACK_SURFACE_Y + FALLBACK_HEADROOM + PLAYER_HALF_HEIGHT
        const safetyY = findFallbackSurfaceY(chunkMap, baseSpawnPosition)
        return {
          position: { ...baseSpawnPosition, y: safetyY ?? fallbackY },
          yaw: 0,
        }
      },
      onSome: ({ position, yaw }) => ({ position, yaw }),
    }),
  )
}

// Scan ALL loaded chunks for any solid ground as a last-resort fallback.
// Returns the best safe player Y found, or undefined if no solid ground exists.
const findFallbackSurfaceY = (
  chunkMap: ReadonlyMap<string, Chunk>,
  base: { readonly x: number; readonly z: number },
): number | undefined => {
  type Candidate = { readonly y: number; readonly distSq: number }
  let best: Candidate | undefined

  for (const chunk of chunkMap.values()) {
    const cx = chunk.coord.x
    const cz = chunk.coord.z
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx
        const wz = cz * CHUNK_SIZE + lz
        for (let y = FALLBACK_SURFACE_Y + FALLBACK_HEADROOM; y > 0; y--) {
          const idx = localBlockIndex(lx, y, lz)
          if (idx !== null && chunk.blocks[idx] !== undefined && chunk.blocks[idx] !== AIR) {
            const distSq = (wx + 0.5 - base.x) ** 2 + (wz + 0.5 - base.z) ** 2
            if (best === undefined || distSq < best.distSq) {
              best = { y: y + 1 + PLAYER_HALF_HEIGHT, distSq }
            }
            break // move to next column
          }
        }
      }
    }
  }
  return best?.y
}
