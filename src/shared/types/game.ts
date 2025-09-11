import * as S from 'effect/Schema'
import { Point3D, ID, Brand } from '@shared/types/common'

/**
 * Game-specific types for Minecraft-like functionality
 */

// Block types
export const BlockTypeSchema = S.Literal('air', 'grass', 'dirt', 'stone', 'cobblestone', 'oakLog', 'oakLeaves', 'sand', 'water', 'glass', 'brick', 'plank')
export type BlockType = S.Schema.Type<typeof BlockTypeSchema>
export const blockTypeNames: ReadonlyArray<BlockType> = BlockTypeSchema.literals

// World coordinates
export type WorldPosition = Point3D
export type ChunkPosition = { x: number; z: number }
export type BlockPosition = Point3D

// Chunk-related types
export type ChunkID = ID<'Chunk'>
export type ChunkData = {
  id: ChunkID
  position: ChunkPosition
  blocks: BlockType[][][]
  isLoaded: boolean
  isDirty: boolean
  lastAccessed: number
}

// Player-related types
export type PlayerID = ID<'Player'>
export type PlayerInput = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  sprint: boolean
  sneak: boolean
  mouseX: number
  mouseY: number
}

// Game modes
export type GameMode = 'survival' | 'creative' | 'spectator' | 'adventure'

// World generation
export type BiomeType = 'plains' | 'forest' | 'desert' | 'mountains' | 'ocean' | 'swamp'
export type TerrainFeature = 'cave' | 'ore_vein' | 'water_source' | 'lava_source' | 'structure'

// Inventory and items
export type ItemType = BlockType | 'tool_pickaxe' | 'tool_shovel' | 'tool_axe' | 'tool_sword'
export type ItemStack = {
  type: ItemType
  count: number
  metadata?: Record<string, any>
}
export type InventorySlot = ItemStack | null
export type Inventory = InventorySlot[]

// Game physics
export type Velocity = Point3D
export type CollisionBox = {
  min: Point3D
  max: Point3D
}

// Rendering
export type RenderDistance = Brand<number, 'RenderDistance'>
export type LODLevel = 0 | 1 | 2 | 3
export type MeshData = {
  vertices: Float32Array
  indices: Uint32Array
  normals?: Float32Array
  uvs?: Float32Array
}

// Network/Multiplayer
export type ServerMessage = {
  type: string
  data: any
  timestamp: number
}
export type ClientMessage = ServerMessage

// Performance metrics specific to the game
export type GameMetrics = {
  fps: number
  frameTime: number
  chunkUpdates: number
  entitiesRendered: number
  drawCalls: number
  memoryUsage: number
  networkLatency?: number
}

// World events
export type WorldEvent =
  | { type: 'block_placed'; position: BlockPosition; blockType: BlockType }
  | { type: 'block_destroyed'; position: BlockPosition; blockType: BlockType }
  | { type: 'chunk_loaded'; chunkId: ChunkID }
  | { type: 'chunk_unloaded'; chunkId: ChunkID }
  | { type: 'player_moved'; playerId: PlayerID; position: WorldPosition }

// Game state
export type GameState = {
  gameMode: GameMode
  worldSeed: number
  dayTime: number
  weather: 'clear' | 'rain' | 'storm'
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
}
