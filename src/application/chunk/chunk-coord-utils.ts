import { Array as Arr, Order, Number as N } from 'effect'
import { Position, ChunkCacheKey } from '@/shared/kernel'
import { ChunkCoord, CHUNK_SIZE } from '@/domain/chunk'

/**
 * Calculate distance squared between two chunk coordinates
 */
export const chunkDistanceSquared = (a: ChunkCoord, b: ChunkCoord): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

/**
 * Convert world position to chunk coordinate
 */
export const worldToChunkCoord = (pos: Position): ChunkCoord => ({
  x: Math.floor(pos.x / CHUNK_SIZE),
  z: Math.floor(pos.z / CHUNK_SIZE),
})

export const getChunkLoadOffsets = (renderDistance: number): ReadonlyArray<readonly [number, number]> => {
  const range = Arr.makeBy(2 * renderDistance + 1, i => i - renderDistance)
  const allPairs = Arr.flatMap(range, dx => Arr.map(range, dz => [dx, dz, dx * dx + dz * dz] as const))
  const inRadius = Arr.filter(allPairs, ([, , dist]) => dist <= renderDistance * renderDistance)
  const byDist = Order.mapInput(N.Order, (t: readonly [number, number, number]) => t[2])
  const byDx = Order.mapInput(N.Order, (t: readonly [number, number, number]) => t[0])
  const byDz = Order.mapInput(N.Order, (t: readonly [number, number, number]) => t[1])
  const sorted = Arr.sort(inRadius, Order.combine(byDist, Order.combine(byDx, byDz)))
  return Arr.map(sorted, ([dx, dz]) => [dx, dz] as const)
}

export const countChunksInRadius = (radius: number): number => {
  const range = Arr.makeBy(2 * radius + 1, i => i - radius)
  const allPairs = Arr.flatMap(range, dx => Arr.map(range, dz => dx * dx + dz * dz))
  return Arr.filter(allPairs, dist => dist <= radius * radius).length
}

/**
 * Get all chunk coordinates within render distance of a center point
 * Uses a circular check for a nicer radius shape
 */
export const getChunksInRenderDistance = (center: ChunkCoord, renderDistance: number): ReadonlyArray<ChunkCoord> => {
  return Arr.map(getChunkLoadOffsets(renderDistance), ([dx, dz]) => ({ x: center.x + dx, z: center.z + dz }))
}

/**
 * Create a unique key for chunk coordinate
 */
export const chunkCoordToKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)
