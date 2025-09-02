import { Schema as S, Match } from 'effect'
import { Vector3IntSchema } from './common'

// --- Schemas ---

export const BlockTypeSchema = S.Literal('air', 'grass', 'dirt', 'stone', 'cobblestone', 'oakLog', 'oakLeaves', 'sand', 'water', 'glass', 'brick', 'plank')
export type BlockType = S.Schema.Type<typeof BlockTypeSchema>
export const blockTypeNames: ReadonlyArray<BlockType> = BlockTypeSchema.literals

export const PlacedBlockSchema = S.Struct({
  position: Vector3IntSchema,
  blockType: BlockTypeSchema,
})
export type PlacedBlock = S.Schema.Type<typeof PlacedBlockSchema>

export const FaceNameSchema = S.Literal('top', 'bottom', 'north', 'south', 'east', 'west')
export type FaceName = S.Schema.Type<typeof FaceNameSchema>

// --- Constants ---

export const hotbarSlots: ReadonlyArray<BlockType> = ['grass', 'dirt', 'stone', 'cobblestone', 'oakLog', 'plank', 'glass', 'brick', 'sand']

export const ATLAS_SIZE_IN_TILES = 16
export const TILE_SIZE = 1 / ATLAS_SIZE_IN_TILES

const BlockDefinitionSchema = S.Struct({
  textures: S.Struct({
    top: S.optional(S.Tuple(S.Number, S.Number)),
    bottom: S.optional(S.Tuple(S.Number, S.Number)),
    side: S.Tuple(S.Number, S.Number),
  }),
  isTransparent: S.Boolean,
  isFluid: S.Boolean,
})
type BlockDefinition = S.Schema.Type<typeof BlockDefinitionSchema>

export const blockDefinitions: Readonly<Record<BlockType, BlockDefinition>> = {
  air: { textures: { side: [0, 0] }, isTransparent: true, isFluid: false }, // Note: air doesn't have a real texture
  grass: { textures: { top: [7, 0], bottom: [5, 0], side: [6, 0] }, isTransparent: false, isFluid: false },
  dirt: { textures: { side: [3, 0] }, isTransparent: false, isFluid: false },
  stone: { textures: { side: [15, 0] }, isTransparent: false, isFluid: false },
  cobblestone: { textures: { side: [1, 0] }, isTransparent: false, isFluid: false },
  oakLog: { textures: { top: [12, 0], bottom: [10, 0], side: [11, 0] }, isTransparent: false, isFluid: false },
  oakLeaves: { textures: { side: [8, 0] }, isTransparent: true, isFluid: false }, // Using non-transparent for now
  sand: { textures: { side: [14, 0] }, isTransparent: false, isFluid: false },
  water: { textures: { side: [9, 0] }, isTransparent: true, isFluid: true }, // Assuming water has a texture, placeholder
  glass: { textures: { side: [4, 0] }, isTransparent: true, isFluid: false },
  brick: { textures: { side: [0, 0] }, isTransparent: false, isFluid: false },
  plank: { textures: { side: [13, 0] }, isTransparent: false, isFluid: false },
}

// --- Functions ---

/**
 * Gets the UV coordinates for a specific face of a block type.
 * @param blockType The type of the block.
 * @param faceName The name of the face.
 * @returns A tuple [u, v] representing the texture coordinates.
 */
export const getUvForFace = (blockType: BlockType, faceName: FaceName): readonly [number, number] => {
  const { textures } = blockDefinitions[blockType]
  return Match.value(faceName).pipe(
    Match.when('top', () => textures.top ?? textures.side),
    Match.when('bottom', () => textures.bottom ?? textures.side),
    Match.orElse(() => textures.side),
  )
}

/**
 * Checks if a block type is transparent.
 * @param blockType The type of the block.
 * @returns True if the block is transparent, false otherwise.
 */
export const isBlockTransparent = (blockType: BlockType): boolean => {
  return blockDefinitions[blockType].isTransparent
}

/**
 * Checks if a block type is a fluid.
 * @param blockType The type of the block.
 * @returns True if the block is a fluid, false otherwise.
 */
export const isBlockFluid = (blockType: BlockType): boolean => blockDefinitions[blockType].isFluid

/**
 * Creates a PlacedBlock object.
 * @param position The position of the block.
 * @param blockType The type of the block.
 * @returns A PlacedBlock object.
 */
export const createPlacedBlock = (
  position: { readonly x: number; readonly y: number; readonly z: number },
  blockType: BlockType,
) => {
  const decode = S.decodeEither(PlacedBlockSchema)
  return decode({ position, blockType })
}

export const isBlockType = S.is(BlockTypeSchema)
