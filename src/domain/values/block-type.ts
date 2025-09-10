import * as S from 'effect/Schema'
import { Data, Match } from 'effect'

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
  'leaves',
  'glass',
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

// Block properties as a Data class
export class BlockProperties extends Data.Class<{
  readonly isSolid: boolean
  readonly isTransparent: boolean
  readonly isFluid: boolean
  readonly hardness: number
  readonly luminance: number
  readonly flammable: boolean
}> {
  static readonly schema = S.Struct({
    isSolid: S.Boolean,
    isTransparent: S.Boolean,
    isFluid: S.Boolean,
    hardness: S.Number.pipe(S.finite(), S.nonNegative()),
    luminance: S.Number.pipe(S.finite(), S.between(0, 15)),
    flammable: S.Boolean,
  })

  static readonly default = new BlockProperties({
    isSolid: true,
    isTransparent: false,
    isFluid: false,
    hardness: 1.0,
    luminance: 0,
    flammable: false,
  })
}

// Block texture coordinates
export class TextureCoordinates extends Data.Class<{
  readonly u: number
  readonly v: number
}> {
  static readonly schema = S.Struct({
    u: S.Number.pipe(S.finite(), S.between(0, 16)),
    v: S.Number.pipe(S.finite(), S.between(0, 16)),
  })
}

export class BlockTextures extends Data.Class<{
  readonly top: TextureCoordinates
  readonly bottom: TextureCoordinates
  readonly north: TextureCoordinates
  readonly south: TextureCoordinates
  readonly east: TextureCoordinates
  readonly west: TextureCoordinates
}> {
  static readonly schema = S.Struct({
    top: TextureCoordinates.schema,
    bottom: TextureCoordinates.schema,
    north: TextureCoordinates.schema,
    south: TextureCoordinates.schema,
    east: TextureCoordinates.schema,
    west: TextureCoordinates.schema,
  })

  static readonly uniform = (coords: TextureCoordinates) =>
    new BlockTextures({
      top: coords,
      bottom: coords,
      north: coords,
      south: coords,
      east: coords,
      west: coords,
    })
}

// Block definition with all metadata
export class BlockDefinition extends Data.Class<{
  readonly type: BlockType
  readonly properties: BlockProperties
  readonly textures: BlockTextures
}> {
  static readonly schema = S.Struct({
    type: BlockTypeSchema,
    properties: BlockProperties.schema,
    textures: BlockTextures.schema,
  })
}

// Block registry for managing block definitions
export const getBlockProperties = (type: BlockType): BlockProperties =>
  Match.value(type).pipe(
    Match.when('air', () =>
      new BlockProperties({
        isSolid: false,
        isTransparent: true,
        isFluid: false,
        hardness: 0,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('water', () =>
      new BlockProperties({
        isSolid: false,
        isTransparent: true,
        isFluid: true,
        hardness: 100,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('lava', () =>
      new BlockProperties({
        isSolid: false,
        isTransparent: true,
        isFluid: true,
        hardness: 100,
        luminance: 15,
        flammable: false,
      }),
    ),
    Match.when('glass', () =>
      new BlockProperties({
        isSolid: true,
        isTransparent: true,
        isFluid: false,
        hardness: 0.3,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('leaves', () =>
      new BlockProperties({
        isSolid: true,
        isTransparent: true,
        isFluid: false,
        hardness: 0.2,
        luminance: 0,
        flammable: true,
      }),
    ),
    Match.when('glowstone', () =>
      new BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: 0.3,
        luminance: 15,
        flammable: false,
      }),
    ),
    Match.when('wood', () =>
      new BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: 2.0,
        luminance: 0,
        flammable: true,
      }),
    ),
    Match.when('stone', () =>
      new BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: 1.5,
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.when('bedrock', () =>
      new BlockProperties({
        isSolid: true,
        isTransparent: false,
        isFluid: false,
        hardness: -1, // Unbreakable
        luminance: 0,
        flammable: false,
      }),
    ),
    Match.orElse(() => BlockProperties.default),
  )

export const getBlockTextures = (type: BlockType): BlockTextures => {
  // This would normally load from a texture atlas configuration
  // For now, return placeholder coordinates
  const defaultCoords = new TextureCoordinates({ u: 0, v: 0 })
  
  return Match.value(type).pipe(
    Match.when('grass', () =>
      new BlockTextures({
        top: new TextureCoordinates({ u: 0, v: 0 }),
        bottom: new TextureCoordinates({ u: 2, v: 0 }),
        north: new TextureCoordinates({ u: 3, v: 0 }),
        south: new TextureCoordinates({ u: 3, v: 0 }),
        east: new TextureCoordinates({ u: 3, v: 0 }),
        west: new TextureCoordinates({ u: 3, v: 0 }),
      }),
    ),
    Match.when('log', () =>
      new BlockTextures({
        top: new TextureCoordinates({ u: 5, v: 1 }),
        bottom: new TextureCoordinates({ u: 5, v: 1 }),
        north: new TextureCoordinates({ u: 4, v: 1 }),
        south: new TextureCoordinates({ u: 4, v: 1 }),
        east: new TextureCoordinates({ u: 4, v: 1 }),
        west: new TextureCoordinates({ u: 4, v: 1 }),
      }),
    ),
    Match.orElse(() => BlockTextures.uniform(defaultCoords)),
  )
}