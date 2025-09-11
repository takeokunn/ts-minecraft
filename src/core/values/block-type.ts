import * as S from '@effect/schema/Schema'
import { Match } from 'effect'

type Struct<T> = T

// Define all block types as a const array for type safety
export const blockTypes = [
  'air',
  'stone',
  'dirt',
  'grass',
  'cobblestone',
  'wood',
  'sand',
  'gravel',
  'gold_ore',
  'iron_ore',
  'coal_ore',
  'log',
  'oakLog',
  'leaves',
  'glass',
  'plank',
  'brick',
  'lapis_ore',
  'lapis_block',
  'sandstone',
  'wool',
  'flower',
  'mushroom',
  'tnt',
  'bookshelf',
  'mossy_cobblestone',
  'obsidian',
  'diamond_ore',
  'diamond_block',
  'crafting_table',
  'furnace',
  'redstone_ore',
  'snow',
  'ice',
  'cactus',
  'clay',
  'jukebox',
  'pumpkin',
  'netherrack',
  'glowstone',
  'jack_o_lantern',
  'cake',
  'bedrock',
  'water',
  'lava',
] as const

export type BlockType = (typeof blockTypes)[number]

export const BlockTypeSchema = S.Literal(...blockTypes)

// Block properties as a Data struct
export const BlockPropertiesSchema = S.Struct({
  isSolid: S.Boolean,
  isTransparent: S.Boolean,
  isFluid: S.Boolean,
  hardness: S.Number.pipe(S.finite(), S.nonNegative()),
  luminance: S.Number.pipe(S.finite(), S.between(0, 15)),
  flammable: S.Boolean,
})

export type BlockProperties = Struct<{
  readonly isSolid: boolean
  readonly isTransparent: boolean
  readonly isFluid: boolean
  readonly hardness: number
  readonly luminance: number
  readonly flammable: boolean
}>

export const BlockProperties = Struct<BlockProperties>()

export const defaultBlockProperties: BlockProperties = BlockProperties({
  isSolid: true,
  isTransparent: false,
  isFluid: false,
  hardness: 1.0,
  luminance: 0,
  flammable: false,
})

// Block texture coordinates
export const TextureCoordinatesSchema = S.Struct({
  u: S.Number.pipe(S.finite(), S.between(0, 16)),
  v: S.Number.pipe(S.finite(), S.between(0, 16)),
})

export type TextureCoordinates = Struct<{
  readonly u: number
  readonly v: number
}>

export const TextureCoordinates = Struct<TextureCoordinates>()

export const makeTextureCoordinates = (u: number, v: number): TextureCoordinates =>
  TextureCoordinates({ u, v })

export const BlockTexturesSchema = S.Struct({
  top: TextureCoordinatesSchema,
  bottom: TextureCoordinatesSchema,
  north: TextureCoordinatesSchema,
  south: TextureCoordinatesSchema,
  east: TextureCoordinatesSchema,
  west: TextureCoordinatesSchema,
})

export type BlockTextures = Struct<{
  readonly top: TextureCoordinates
  readonly bottom: TextureCoordinates
  readonly north: TextureCoordinates
  readonly south: TextureCoordinates
  readonly east: TextureCoordinates
  readonly west: TextureCoordinates
}>

export const BlockTextures = Struct<BlockTextures>()

export const uniformBlockTextures = (coords: TextureCoordinates): BlockTextures =>
  BlockTextures({
    top: coords,
    bottom: coords,
    north: coords,
    south: coords,
    east: coords,
    west: coords,
  })

// Block definition with all metadata
export const BlockDefinitionSchema = S.Struct({
  type: BlockTypeSchema,
  properties: BlockPropertiesSchema,
  textures: BlockTexturesSchema,
})

export type BlockDefinition = Struct<{
  readonly type: BlockType
  readonly properties: BlockProperties
  readonly textures: BlockTextures
}>

export const BlockDefinition = Struct<BlockDefinition>()

export const makeBlockDefinition = (
  type: BlockType,
  properties: BlockProperties,
  textures: BlockTextures,
): BlockDefinition =>
  BlockDefinition({ type, properties, textures })

// Block registry for managing block definitions
export const getBlockProperties = (type: BlockType): BlockProperties =>
  Match.value(type).pipe(
    Match.when('air', () =>
      BlockProperties({
        isSolid: false,
        isTransparent: true,
        isFluid: false,
        hardness: 0,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('water', () =>
      BlockProperties({
        isSolid: false,
        isTransparent: true,
        isFluid: true,
        hardness: 100,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('lava', () =>
      BlockProperties({
        isSolid: false,
        isTransparent: true,
        isFluid: true,
        hardness: 100,
        luminance: 15,
        flammable: false,
      }),
    ),
    Match.when('glass', () =>
      BlockProperties({
        isSolid: true,
        isTransparent: true,
        isFluid: false,
        hardness: 0.3,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('leaves', () =>
      BlockProperties({
        isSolid: true,
        isTransparent: true,
        isFluid: false,
        hardness: 0.2,
        luminance: 0,
        flammable: true,
      }),
    ),
    Match.when('glowstone', () =>
      BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: 0.3,
        luminance: 15,
        flammable: false,
      }),
    ),
    Match.when('wood', () =>
      BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: 2.0,
        luminance: 0,
        flammable: true,
      }),
    ),
    Match.when('stone', () =>
      BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: 1.5,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('bedrock', () =>
      BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: -1, // Unbreakable
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.orElse(() => defaultBlockProperties),
  )

export const getBlockTextures = (type: BlockType): BlockTextures => {
  // This would normally load from a texture atlas configuration
  // For now, return placeholder coordinates
  const defaultCoords = makeTextureCoordinates(0, 0)
  
  return Match.value(type).pipe(
    Match.when('grass', () =>
      BlockTextures({
        top: makeTextureCoordinates(0, 0),
        bottom: makeTextureCoordinates(2, 0),
        north: makeTextureCoordinates(3, 0),
        south: makeTextureCoordinates(3, 0),
        east: makeTextureCoordinates(3, 0),
        west: makeTextureCoordinates(3, 0),
      }),
    ),
    Match.when('log', () =>
      BlockTextures({
        top: makeTextureCoordinates(5, 1),
        bottom: makeTextureCoordinates(5, 1),
        north: makeTextureCoordinates(4, 1),
        south: makeTextureCoordinates(4, 1),
        east: makeTextureCoordinates(4, 1),
        west: makeTextureCoordinates(4, 1),
      }),
    ),
    Match.orElse(() => uniformBlockTextures(defaultCoords)),
  )
}