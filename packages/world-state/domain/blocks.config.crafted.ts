import { Block } from './block'
import { BlockId } from '@ts-minecraft/kernel'
import { defaultBlockFaces } from './blocks.config.terrain'

const makeBlockId = (id: string) => BlockId.make(id)

export const craftedAndItemBlocks: ReadonlyArray<Block> = [
  new Block({
    id: makeBlockId('block:planks'),
    type: 'PLANKS',
    properties: { hardness: 25, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:sticks'),
    type: 'STICKS',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.2 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:crafting_table'),
    type: 'CRAFTING_TABLE',
    properties: { hardness: 40, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:furnace'),
    type: 'FURNACE',
    properties: { hardness: 80, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:torch'),
    type: 'TORCH',
    properties: { hardness: 1, transparency: true, solid: false, emissive: true, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:coal'),
    type: 'COAL',
    properties: { hardness: 1, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:wooden_sword'),
    type: 'WOODEN_SWORD',
    properties: { hardness: 10, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:wooden_pickaxe'),
    type: 'WOODEN_PICKAXE',
    properties: { hardness: 10, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:stone_pickaxe'),
    type: 'STONE_PICKAXE',
    properties: { hardness: 15, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:raw_iron'),
    type: 'RAW_IRON',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:iron_ingot'),
    type: 'IRON_INGOT',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:iron_pickaxe'),
    type: 'IRON_PICKAXE',
    properties: { hardness: 20, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:raw_gold'),
    type: 'RAW_GOLD',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:gold_ingot'),
    type: 'GOLD_INGOT',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:diamond'),
    type: 'DIAMOND',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:redstone_dust'),
    type: 'REDSTONE_DUST',
    properties: { hardness: 1, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:lapis_lazuli'),
    type: 'LAPIS_LAZULI',
    properties: { hardness: 1, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:emerald'),
    type: 'EMERALD',
    properties: { hardness: 1, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:diamond_pickaxe'),
    type: 'DIAMOND_PICKAXE',
    properties: { hardness: 30, transparency: true, solid: false, emissive: false, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
]
