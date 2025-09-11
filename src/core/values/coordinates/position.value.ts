import * as S from "@effect/schema/Schema"

type Struct<T> = T

/**
 * Position Value Object - Represents a 3D position in the world
 * Implemented using functional programming patterns without classes
 */

// Constants
export const CHUNK_SIZE = 16
export const MIN_Y = 0
export const MAX_Y = 255

// Schema definition with validation
export const PositionSchema = S.Struct({
  x: S.Number.pipe(S.finite()),
  y: S.Number.pipe(S.finite(), S.clamp(MIN_Y, MAX_Y)),
  z: S.Number.pipe(S.finite()),
})

// Type definition using Struct for immutability
export type Position = Struct<{
  readonly x: number
  readonly y: number
  readonly z: number
}>

// Factory function
export const Position = Struct<Position>()

// Create a position with validation
export const create = (x: number, y: number, z: number): Position =>
  Position({
    x,
    y: Math.max(MIN_Y, Math.min(MAX_Y, y)),
    z,
  })

// Zero position constant
export const ZERO = Position({ x: 0, y: 0, z: 0 })

// Origin position constant
export const ORIGIN = Position({ x: 0, y: 64, z: 0 })

/**
 * Pure functions for Position operations
 */

// Translate position by given deltas
export const translate = (dx: number, dy: number, dz: number) =>
  (pos: Position): Position =>
    create(pos.x + dx, pos.y + dy, pos.z + dz)

// Calculate distance between two positions
export const distanceTo = (other: Position) =>
  (pos: Position): number => {
    const dx = pos.x - other.x
    const dy = pos.y - other.y
    const dz = pos.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

// Calculate squared distance (more efficient for comparisons)
export const squaredDistanceTo = (other: Position) =>
  (pos: Position): number => {
    const dx = pos.x - other.x
    const dy = pos.y - other.y
    const dz = pos.z - other.z
    return dx * dx + dy * dy + dz * dz
  }

// Add two positions
export const add = (other: Position) =>
  (pos: Position): Position =>
    create(pos.x + other.x, pos.y + other.y, pos.z + other.z)

// Subtract positions
export const subtract = (other: Position) =>
  (pos: Position): Position =>
    create(pos.x - other.x, pos.y - other.y, pos.z - other.z)

// Scale position by a factor
export const scale = (factor: number) =>
  (pos: Position): Position =>
    create(pos.x * factor, pos.y * factor, pos.z * factor)

// Lerp between two positions
export const lerp = (target: Position, t: number) =>
  (pos: Position): Position =>
    create(
      pos.x + (target.x - pos.x) * t,
      pos.y + (target.y - pos.y) * t,
      pos.z + (target.z - pos.z) * t,
    )

// Round to nearest integer coordinates
export const round = (pos: Position): Position =>
  create(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z))

// Floor to integer coordinates
export const floor = (pos: Position): Position =>
  create(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))

// Ceil to integer coordinates
export const ceil = (pos: Position): Position =>
  create(Math.ceil(pos.x), Math.ceil(pos.y), Math.ceil(pos.z))

// Check if position is within bounds
export const isWithinBounds = (min: Position, max: Position) =>
  (pos: Position): boolean =>
    pos.x >= min.x && pos.x <= max.x &&
    pos.y >= min.y && pos.y <= max.y &&
    pos.z >= min.z && pos.z <= max.z

// Check if positions are equal
export const equals = (other: Position) =>
  (pos: Position): boolean =>
    pos.x === other.x && pos.y === other.y && pos.z === other.z

// Convert to array format
export const toArray = (pos: Position): [number, number, number] =>
  [pos.x, pos.y, pos.z]

// Create from array
export const fromArray = ([x, y, z]: [number, number, number]): Position =>
  create(x, y, z)

// Convert to object with different property names (for Three.js compatibility)
export const toVector3 = (pos: Position): { x: number; y: number; z: number } =>
  ({ x: pos.x, y: pos.y, z: pos.z })

// Format as string for debugging
export const toString = (pos: Position): string =>
  `Position(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`

// Get chunk position (for chunk-based world management)
export const toChunkPosition = (pos: Position): { x: number; z: number } => ({
  x: Math.floor(pos.x / CHUNK_SIZE),
  z: Math.floor(pos.z / CHUNK_SIZE),
})

// Get position within chunk (local coordinates)
export const toLocalChunkPosition = (pos: Position): Position =>
  create(
    ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    pos.y,
    ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  )

// Common position operations composed with pipe
export const moveUp = (distance: number) => translate(0, distance, 0)
export const moveDown = (distance: number) => translate(0, -distance, 0)
export const moveNorth = (distance: number) => translate(0, 0, -distance)
export const moveSouth = (distance: number) => translate(0, 0, distance)
export const moveEast = (distance: number) => translate(distance, 0, 0)
export const moveWest = (distance: number) => translate(-distance, 0, 0)

/**
 * Usage examples:
 * 
 * const pos1 = create(10, 64, 20)
 * const pos2 = pipe(
 *   pos1,
 *   translate(5, 0, 5),
 *   moveUp(10),
 *   round
 * )
 * 
 * const distance = pipe(pos1, distanceTo(pos2))
 * 
 * const midpoint = pipe(
 *   pos1,
 *   lerp(pos2, 0.5)
 * )
 */