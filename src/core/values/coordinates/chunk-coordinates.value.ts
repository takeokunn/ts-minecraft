import { Data, pipe } from 'effect'
import * as S from "@effect/schema/Schema"
import { Position, CHUNK_SIZE } from './position.value'

/**
 * ChunkCoordinates Value Object - Represents chunk coordinates in the world
 * Chunks are 16x16 block areas used for world generation and loading
 */

// Schema definition
export const ChunkCoordinatesSchema = S.Struct({
  x: S.Int,
  z: S.Int,
})

// Type definition using Data.Struct for immutability
export type ChunkCoordinates = Data.Struct<{
  readonly x: number
  readonly z: number
}>

// Factory function
export const ChunkCoordinates = Data.struct<ChunkCoordinates>()

// Create chunk coordinates
export const create = (x: number, z: number): ChunkCoordinates =>
  ChunkCoordinates({
    x: Math.floor(x),
    z: Math.floor(z),
  })

// Origin chunk
export const ORIGIN = ChunkCoordinates({ x: 0, z: 0 })

/**
 * Pure functions for ChunkCoordinates operations
 */

// Convert Position to ChunkCoordinates
export const fromPosition = (pos: Position): ChunkCoordinates =>
  create(
    Math.floor(pos.x / CHUNK_SIZE),
    Math.floor(pos.z / CHUNK_SIZE)
  )

// Convert to a unique string key for caching/storage
export const toKey = (coords: ChunkCoordinates): string =>
  `${coords.x},${coords.z}`

// Parse from string key
export const fromKey = (key: string): ChunkCoordinates => {
  const parts = key.split(',')
  const x = parts[0] ? Number.parseInt(parts[0], 10) : 0
  const z = parts[1] ? Number.parseInt(parts[1], 10) : 0
  return create(x, z)
}

// Get world position of chunk origin (northwest corner at y=0)
export const toWorldPosition = (coords: ChunkCoordinates): Position =>
  Position({
    x: coords.x * CHUNK_SIZE,
    y: 0,
    z: coords.z * CHUNK_SIZE,
  })

// Get center position of chunk at given height
export const toCenterPosition = (height: number) =>
  (coords: ChunkCoordinates): Position =>
    Position({
      x: coords.x * CHUNK_SIZE + CHUNK_SIZE / 2,
      y: height,
      z: coords.z * CHUNK_SIZE + CHUNK_SIZE / 2,
    })

// Calculate distance between chunk centers
export const distanceTo = (other: ChunkCoordinates) =>
  (coords: ChunkCoordinates): number => {
    const dx = coords.x - other.x
    const dz = coords.z - other.z
    return Math.sqrt(dx * dx + dz * dz)
  }

// Calculate Manhattan distance (useful for chunk loading priority)
export const manhattanDistanceTo = (other: ChunkCoordinates) =>
  (coords: ChunkCoordinates): number =>
    Math.abs(coords.x - other.x) + Math.abs(coords.z - other.z)

// Get neighboring chunk coordinates
export const getNeighbors = (coords: ChunkCoordinates): ChunkCoordinates[] => [
  create(coords.x + 1, coords.z),     // East
  create(coords.x - 1, coords.z),     // West
  create(coords.x, coords.z + 1),     // South
  create(coords.x, coords.z - 1),     // North
  create(coords.x + 1, coords.z + 1), // Southeast
  create(coords.x + 1, coords.z - 1), // Northeast
  create(coords.x - 1, coords.z + 1), // Southwest
  create(coords.x - 1, coords.z - 1), // Northwest
]

// Get chunks in radius (for view distance)
export const getChunksInRadius = (radius: number) =>
  (center: ChunkCoordinates): ChunkCoordinates[] => {
    const chunks: ChunkCoordinates[] = []
    const radiusSquared = radius * radius
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz <= radiusSquared) {
          chunks.push(create(center.x + dx, center.z + dz))
        }
      }
    }
    
    return chunks
  }

// Get chunks in square area (alternative to radius)
export const getChunksInSquare = (halfSize: number) =>
  (center: ChunkCoordinates): ChunkCoordinates[] => {
    const chunks: ChunkCoordinates[] = []
    
    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dz = -halfSize; dz <= halfSize; dz++) {
        chunks.push(create(center.x + dx, center.z + dz))
      }
    }
    
    return chunks
  }

// Check if two chunk coordinates are equal
export const equals = (other: ChunkCoordinates) =>
  (coords: ChunkCoordinates): boolean =>
    coords.x === other.x && coords.z === other.z

// Check if chunk is within bounds
export const isWithinBounds = (min: ChunkCoordinates, max: ChunkCoordinates) =>
  (coords: ChunkCoordinates): boolean =>
    coords.x >= min.x && coords.x <= max.x &&
    coords.z >= min.z && coords.z <= max.z

// Translate chunk coordinates
export const translate = (dx: number, dz: number) =>
  (coords: ChunkCoordinates): ChunkCoordinates =>
    create(coords.x + dx, coords.z + dz)

// Common directional movements
export const north = translate(0, -1)
export const south = translate(0, 1)
export const east = translate(1, 0)
export const west = translate(-1, 0)

// Format as string for debugging
export const toString = (coords: ChunkCoordinates): string =>
  `Chunk(${coords.x}, ${coords.z})`

// Convert to array format
export const toArray = (coords: ChunkCoordinates): [number, number] =>
  [coords.x, coords.z]

// Create from array
export const fromArray = ([x, z]: [number, number]): ChunkCoordinates =>
  create(x, z)

/**
 * Usage examples:
 * 
 * const playerPos = Position({ x: 100, y: 64, z: 200 })
 * const chunk = fromPosition(playerPos)
 * 
 * const nearbyChunks = pipe(
 *   chunk,
 *   getChunksInRadius(3)
 * )
 * 
 * const chunkKey = toKey(chunk)
 * const restored = fromKey(chunkKey)
 */