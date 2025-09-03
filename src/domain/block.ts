import { Effect, Match } from 'effect'
import * as S from 'effect/Schema'
import { Vector3Int, Vector3IntSchema } from './common'
import { blockDefinitions } from './block-definitions'
import { BlockType, BlockTypeSchema } from './block-types'

// --- Schemas ---

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

// --- Functions ---

/**
 * Gets the UV coordinates for a specific face of a block type.
 * @param blockType The type of the block.
 * @param faceName The name of the face.
 * @returns A tuple [u, v] representing the texture coordinates.
 */
export const getUvForFace = (
  blockType: BlockType,
  faceName: FaceName,
): Effect.Effect<readonly [number, number], S.ParseError> =>
  Effect.flatMap(blockDefinitions, (definitions) => {
    const { textures } = definitions[blockType]
    const uv = Match.value(faceName).pipe(
      Match.when('top', () => textures.top ?? textures.side),
      Match.when('bottom', () => textures.bottom ?? textures.side),
      Match.orElse(() => textures.side),
    )
    return Effect.succeed(uv)
  })

/**
 * Checks if a block type is transparent.
 * @param blockType The type of the block.
 * @returns True if the block is transparent, false otherwise.
 */
export const isBlockTransparent = (blockType: BlockType) =>
  Effect.map(blockDefinitions, (definitions) => {
    return definitions[blockType].isTransparent
  })

/**
 * Checks if a block type is a fluid.
 * @param blockType The type of the block.
 * @returns True if the block is a fluid, false otherwise.
 */
export const isBlockFluid = (blockType: BlockType) =>
  Effect.map(blockDefinitions, (definitions) => {
    return definitions[blockType].isFluid
  })

/**
 * Creates a PlacedBlock object.
 * @param position The position of the block.
 * @param blockType The type of the block.
 * @returns A PlacedBlock object.
 */
export const createPlacedBlock = (position: Vector3Int, blockType: BlockType) => {
  return S.decode(PlacedBlockSchema)({ position, blockType })
}

export const isBlockType = S.is(BlockTypeSchema)
