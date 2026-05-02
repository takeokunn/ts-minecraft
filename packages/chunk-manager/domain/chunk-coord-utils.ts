import { Array as Arr, Order, Number as N } from 'effect'
import { Position, ChunkCacheKey } from '@ts-minecraft/kernel'
import { ChunkCoord, CHUNK_SIZE } from '@ts-minecraft/domain'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/terrain-generator'

export const chunkDistanceSquared = (a: ChunkCoord, b: ChunkCoord): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

export const worldToChunkCoord = (pos: Position): ChunkCoord => ({
  x: Math.floor(pos.x / CHUNK_SIZE),
  z: Math.floor(pos.z / CHUNK_SIZE),
})

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

export const getChunksInRenderDistance = (center: ChunkCoord, renderDistance: number): ReadonlyArray<ChunkCoord> => {
  return Arr.map(getChunkLoadOffsets(renderDistance), ([dx, dz]) => ({ x: center.x + dx, z: center.z + dz }))
}

export const chunkCoordToKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)
