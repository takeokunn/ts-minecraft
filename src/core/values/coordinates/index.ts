/**
 * Coordinate-related Value Objects
 * Exports Position and ChunkCoordinates with their associated functions
 */

// Position exports
export {
  // Types and schemas
  Position,
  PositionSchema,
  type Position as PositionType,
  
  // Factory and constants
  create as createPosition,
  ZERO as ZERO_POSITION,
  ORIGIN as ORIGIN_POSITION,
  CHUNK_SIZE,
  MIN_Y,
  MAX_Y,
  
  // Operations
  translate,
  distanceTo,
  squaredDistanceTo,
  add as addPosition,
  subtract as subtractPosition,
  scale as scalePosition,
  lerp as lerpPosition,
  round as roundPosition,
  floor as floorPosition,
  ceil as ceilPosition,
  
  // Utilities
  isWithinBounds as isPositionWithinBounds,
  equals as positionEquals,
  toArray as positionToArray,
  fromArray as positionFromArray,
  toVector3,
  toString as positionToString,
  toChunkPosition,
  toLocalChunkPosition,
  
  // Directional movements
  moveUp,
  moveDown,
  moveNorth,
  moveSouth,
  moveEast,
  moveWest,
} from './position.value'

// ChunkCoordinates exports
export {
  // Types and schemas
  ChunkCoordinates,
  ChunkCoordinatesSchema,
  type ChunkCoordinates as ChunkCoordinatesType,
  
  // Factory and constants
  create as createChunkCoordinates,
  ORIGIN as ORIGIN_CHUNK,
  
  // Conversions
  fromPosition as chunkFromPosition,
  toKey as chunkToKey,
  fromKey as chunkFromKey,
  toWorldPosition,
  toCenterPosition,
  
  // Operations
  distanceTo as chunkDistanceTo,
  manhattanDistanceTo,
  getNeighbors,
  getChunksInRadius,
  getChunksInSquare,
  
  // Utilities
  equals as chunkEquals,
  isWithinBounds as isChunkWithinBounds,
  translate as translateChunk,
  north,
  south,
  east,
  west,
  toString as chunkToString,
  toArray as chunkToArray,
  fromArray as chunkFromArray,
} from './chunk-coordinates.value'