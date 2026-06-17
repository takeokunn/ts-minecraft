import { Block } from './block'
import { BlockId } from '@ts-minecraft/core'

// Hardness uses a 0-100 scale; values preserve vanilla Minecraft RELATIVE ordering:
//   snow(2) < ice/leaves(3) < glass(4) < dirt/sand(8) < grass/gravel(10)
//   < stone/granite/diorite/andesite(25) < wood/cobblestone(35) < deepslate(50)
//   < obsidian(90) < bedrock(100, unbreakable). Mirrors vanilla floats
//   (dirt 0.5 < stone 1.5 < wood 2.0 < deepslate 3.0 < obsidian 50 < bedrock ∞).
export const defaultBlockProperties = {
  hardness: 8, // dirt-soft baseline (vanilla dirt 0.5)
  transparency: false,
  solid: true,
  emissive: false,
  friction: 0.6,
}

export const defaultBlockFaces = {
  top: true,
  bottom: true,
  north: true,
  south: true,
  east: true,
  west: true,
}

const makeBlockId = (id: string) => BlockId.make(id)

const plantBlockProperties = {
  hardness: 0,
  transparency: true,
  solid: false,
  emissive: false,
  friction: 0,
}

const cactusBlockProperties = {
  hardness: 8,
  transparency: true,
  solid: true,
  emissive: false,
  friction: 0.6,
}

export const terrainBlocks: ReadonlyArray<Block> = [
  new Block({
    id: makeBlockId('block:air'),
    type: 'AIR',
    properties: {
      hardness: 0,
      transparency: true,
      solid: false,
      emissive: false,
      friction: 0,
    },
    faces: {
      top: false,
      bottom: false,
      north: false,
      south: false,
      east: false,
      west: false,
    },
  }),
  new Block({
    id: makeBlockId('block:dirt'),
    type: 'DIRT',
    properties: defaultBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:stone'),
    type: 'STONE',
    properties: {
      ...defaultBlockProperties,
      hardness: 25,
      friction: 0.8,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:wood'),
    type: 'WOOD',
    properties: {
      ...defaultBlockProperties,
      hardness: 35,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:grass'),
    type: 'GRASS',
    properties: {
      ...defaultBlockProperties,
      hardness: 10,
      emissive: false,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:sand'),
    type: 'SAND',
    properties: {
      ...defaultBlockProperties,
      hardness: 8,
      friction: 0.5,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:water'),
    type: 'WATER',
    properties: {
      ...defaultBlockProperties,
      hardness: 0,
      transparency: true,
      solid: false,
      friction: 0,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:leaves'),
    type: 'LEAVES',
    properties: {
      ...defaultBlockProperties,
      hardness: 3,
      transparency: true,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:glass'),
    type: 'GLASS',
    properties: {
      ...defaultBlockProperties,
      hardness: 4,
      transparency: true,
    },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:snow'),
    type: 'SNOW',
    properties: { hardness: 2, transparency: false, solid: true, emissive: false, friction: 0.3 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:gravel'),
    type: 'GRAVEL',
    properties: { hardness: 10, transparency: false, solid: true, emissive: false, friction: 0.5 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:cobblestone'),
    type: 'COBBLESTONE',
    properties: { hardness: 35, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:granite'),
    type: 'GRANITE',
    properties: { hardness: 25, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:diorite'),
    type: 'DIORITE',
    properties: { hardness: 25, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:andesite'),
    type: 'ANDESITE',
    properties: { hardness: 25, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate'),
    type: 'DEEPSLATE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:bedrock'),
    type: 'BEDROCK',
    properties: { hardness: 100, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:lava'),
    type: 'LAVA',
    properties: { hardness: 0, transparency: false, solid: false, emissive: true, friction: 0 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:obsidian'),
    type: 'OBSIDIAN',
    properties: { hardness: 90, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:farmland'),
    type: 'FARMLAND',
    properties: { hardness: 8, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:wheat_crop'),
    type: 'WHEAT_CROP',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:sapling'),
    type: 'SAPLING',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:dandelion'),
    type: 'DANDELION',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:poppy'),
    type: 'POPPY',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:brown_mushroom'),
    type: 'BROWN_MUSHROOM',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:red_mushroom'),
    type: 'RED_MUSHROOM',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:tall_grass'),
    type: 'TALL_GRASS',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:fern'),
    type: 'FERN',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:sugar_cane'),
    type: 'SUGAR_CANE',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:cactus'),
    type: 'CACTUS',
    properties: cactusBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:lily_pad'),
    type: 'LILY_PAD',
    properties: plantBlockProperties,
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:ice'),
    type: 'ICE',
    properties: { hardness: 3, transparency: true, solid: true, emissive: false, friction: 0.98 },
    faces: defaultBlockFaces,
  }),
]
