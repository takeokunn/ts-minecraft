import { Position, ChunkCacheKey } from '@ts-minecraft/core'
import { ChunkCoord, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from './terrain/math'

export const chunkDistanceSquared = (a: ChunkCoord, b: ChunkCoord): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

export const worldToChunkCoord = (pos: Position): ChunkCoord => ({
  x: Math.floor(pos.x / CHUNK_SIZE),
  z: Math.floor(pos.z / CHUNK_SIZE),
})

export type LocalBlock = {
  readonly lx: number
  readonly y: number
  readonly lz: number
}

export function worldPositionFor(
  chunkCoord: ChunkCoord,
  block: LocalBlock,
): Position {
  return {
    x: chunkCoord.x * CHUNK_SIZE + block.lx,
    y: block.y,
    z: chunkCoord.z * CHUNK_SIZE + block.lz,
  }
}

// Caller must guard ly against [0, CHUNK_HEIGHT) — Y is not bounds-checked here.
export const worldToBlockIndex = (
  worldPos: Position
): {
  chunkCoord: ChunkCoord
  lx: number
  ly: number
  lz: number
  flatIdx: number
  coordKey: string
} => {
  const bx = Math.floor(worldPos.x)
  const bz = Math.floor(worldPos.z)
  const cx = Math.floor(bx / CHUNK_SIZE)
  const cz = Math.floor(bz / CHUNK_SIZE)
  const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const ly = Math.floor(worldPos.y)
  return {
    chunkCoord: { x: cx, z: cz },
    lx,
    ly,
    lz,
    flatIdx: chunkBlockIndexUnchecked(lx, ly, lz),
    coordKey: `${cx},${cz}`,
  }
}

// Memoize the offset list per renderDistance. The result is a pure function of
// renderDistance (an integer in [2, 16]), so the full build — 5 array allocs +
// a sort over up to ~441 elements — runs at most once per distinct distance
// instead of on every loadChunksAroundPlayer call (≈5×/sec during movement).
// Callers treat the returned array as immutable (they map over it to build fresh
// coord objects), so handing out the shared cached array is safe.
const _offsetCacheByRenderDistance = new Map<number, ReadonlyArray<readonly [number, number]>>()

export const getChunkLoadOffsets = (renderDistance: number): ReadonlyArray<readonly [number, number]> => {
  const cached = _offsetCacheByRenderDistance.get(renderDistance)
  if (cached !== undefined) return cached
  const radiusSquared = renderDistance * renderDistance
  const minOffset = renderDistance === 0 ? 0 : -renderDistance
  const offsetsWithDistance: Array<readonly [number, number, number]> = []
  for (let dx = minOffset; dx <= renderDistance; dx += 1) {
    for (let dz = minOffset; dz <= renderDistance; dz += 1) {
      const distSquared = dx * dx + dz * dz
      if (distSquared <= radiusSquared) {
        offsetsWithDistance.push([dx, dz, distSquared] as const)
      }
    }
  }
  offsetsWithDistance.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1])
  const offsets: Array<readonly [number, number]> = []
  for (let i = 0; i < offsetsWithDistance.length; i += 1) {
    const [dx, dz] = offsetsWithDistance[i]!
    offsets.push([dx, dz] as const)
  }
  _offsetCacheByRenderDistance.set(renderDistance, offsets)
  return offsets
}

export const countChunksInRadius = (radius: number): number => {
  const radiusSquared = radius * radius
  const minOffset = radius === 0 ? 0 : -radius
  let count = 0
  for (let dx = minOffset; dx <= radius; dx += 1) {
    for (let dz = minOffset; dz <= radius; dz += 1) {
      if (dx * dx + dz * dz <= radiusSquared) count += 1
    }
  }
  return count
}

export const getChunksInRenderDistance = (center: ChunkCoord, renderDistance: number): ReadonlyArray<ChunkCoord> => {
  const offsets = getChunkLoadOffsets(renderDistance)
  const chunks: Array<ChunkCoord> = []
  for (let i = 0; i < offsets.length; i += 1) {
    const [dx, dz] = offsets[i]!
    chunks.push({ x: center.x + dx, z: center.z + dz })
  }
  return chunks
}

export const chunkCoordToKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)

export const chunkCoordToWorldKey = (coord: ChunkCoord, worldId: string): ChunkCacheKey =>
  ChunkCacheKey.make(`${worldId}:${coord.x},${coord.z}`)

// FR-2.1: chunk-load priority weighted by player velocity direction.
// Pure-distance baseline matches chunkDistanceSquared ordering;
// when the player is moving, chunks ahead of the velocity vector receive a
// lower priority value (= higher priority) than chunks behind, so the loader
// fetches the visible-direction chunks first.

export type ChunkVelocity = Readonly<{ vx: number; vz: number }>

// Mixing weight between pure distance (alpha=0) and direction-weighted
// distance (alpha=1). 0.5 keeps both axes meaningful: a chunk dead ahead at
// distance d² scores d²·0.5, while a chunk directly behind scores d²·1.5.
export const DEFAULT_PRIORITY_ALPHA = 0.5

// Squared-velocity threshold below which we treat the player as stationary
// and fall back to pure distance ordering. 1e-6 corresponds to |v|≈1e-3
// blocks/tick — well below any real player input.
export const STATIC_VELOCITY_EPSILON_SQUARED = 1e-6

export const computeChunkPriority = (
  chunkCoord: ChunkCoord,
  playerCoord: ChunkCoord,
  velocity: ChunkVelocity,
  alpha: number = DEFAULT_PRIORITY_ALPHA,
): number => {
  const distSquared = chunkDistanceSquared(chunkCoord, playerCoord)
  const vMagSq = velocity.vx * velocity.vx + velocity.vz * velocity.vz
// velocity≈0 → reduce to pure distance ordering.
  if (vMagSq < STATIC_VELOCITY_EPSILON_SQUARED) return distSquared
  const dx = chunkCoord.x - playerCoord.x
  const dz = chunkCoord.z - playerCoord.z
  // Eliminate double sqrt: dist * sqrt(vMagSq) = sqrt(distSquared * vMagSq).
  // dist === 0 check is equivalent to distSquared === 0 (both non-negative).
  if (distSquared === 0) return 0
  const combinedSqrt = Math.sqrt(distSquared * vMagSq)
  // dotProduct ∈ [-1, 1]: +1 = chunk dead ahead, -1 = behind, 0 = perpendicular.
  const dotProduct = (dx * velocity.vx + dz * velocity.vz) / combinedSqrt
  // Scale d² by (1 + alpha·(1 - dot)): ahead → 1·d², behind → (1+2α)·d².
  return distSquared * (1 + alpha * (1 - dotProduct))
}
