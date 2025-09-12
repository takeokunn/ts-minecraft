import { Match, Option } from 'effect'
import * as S from 'effect/Schema'
import { Vector3Int, Vector3IntSchema } from '@domain/value-objects/common'
import { blockDefinitions } from '@domain/entities/block-definitions.entity'
import { BlockType, BlockTypeSchema } from '@domain/value-objects/block-type.vo'
import { ATLAS_WIDTH_IN_TILES } from '@shared/constants/texture'

export type { BlockType } from '@domain/value-objects/block-type.vo'

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

// Use ATLAS_WIDTH_IN_TILES from @shared/constants/texture instead of ATLAS_SIZE_IN_TILES
export const TILE_SIZE = 1 / ATLAS_WIDTH_IN_TILES

// --- Functions ---

const getBlockDefinition = (blockType: BlockType) => {
  return Option.fromNullable(blockDefinitions[blockType]).pipe(Option.getOrThrowWith(() => new Error(`Block definition not found for ${blockType}`)))
}

/**
 * Gets the UV coordinates for a specific face of a block type.
 * @param blockType The type of the block.
 * @param faceName The name of the face.
 * @returns A tuple [u, v] representing the texture coordinates.
 */
export const getUvForFace = (blockType: BlockType, faceName: FaceName): readonly [number, number] => {
  const { textures } = getBlockDefinition(blockType)
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
export const isBlockTransparent = (blockType: BlockType) => {
  return getBlockDefinition(blockType).isTransparent
}

/**
 * Checks if a block type is a fluid.
 * @param blockType The type of the block.
 * @returns True if the block is a fluid, false otherwise.
 */
export const isBlockFluid = (blockType: BlockType) => {
  return getBlockDefinition(blockType).isFluid
}

/**
 * Creates a PlacedBlock object.
 * @param position The position of the block.
 * @param blockType The type of the block.
 * @returns A PlacedBlock object.
 */
export const createPlacedBlock = (position: Vector3Int, blockType: BlockType): PlacedBlock => {
  return { position, blockType }
}
