// Domain Entities - Named exports for better tree-shaking and explicit dependencies

// Player Entity
export { 
  PlayerInventory,
  Player,
  PlayerBusinessLogic,
  createPlayer,
  type Player as PlayerType 
} from './player.entity'

// Block Entity  
export {
  PlacedBlockSchema,
  FaceNameSchema,
  hotbarSlots,
  ATLAS_SIZE_IN_TILES,
  TILE_SIZE,
  getUvForFace,
  isBlockTransparent,
  isBlockFluid,
  createPlacedBlock,
  type PlacedBlock,
  type FaceName
} from './block.entity'

// Block Type exports (re-exported)
export type { BlockType } from './block.entity'

// Chunk Entity
export {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  Chunk,
  makeEmptyChunk,
  ChunkBusinessLogic,
  type Chunk as ChunkType
} from './chunk.entity'

// World Entity
export {
  WorldState,
  type WorldState as WorldStateType
} from './world.entity'

// Entity Base
export type * from './entity.entity'

// Block Definitions
export {
  BlockDefinitionSchema,
  blockDefinitions,
  type BlockDefinition,
  type BlockDefinitions
} from './block-definitions.entity'
