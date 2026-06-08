import { Block } from './block'
import { BlockId, type InventoryItem } from '@ts-minecraft/core'
import { defaultBlockFaces } from './blocks.config.terrain'

const makeBlockId = (id: string) => BlockId.make(id)

const endBlockTypes = [
  'CHORUS_FLOWER',
  'CHORUS_PLANT',
  'DRAGON_EGG',
  'END_CRYSTAL',
  'END_GATEWAY',
  'END_ROD',
  'END_STONE_BRICKS',
  'ENDER_CHEST',
  'PURPUR_BLOCK',
  'PURPUR_PILLAR',
  'PURPUR_SLAB',
  'PURPUR_STAIRS',
  'SHULKER_BOX',
] as const

type EndBlockType = (typeof endBlockTypes)[number]

export const endBlockDrops: Readonly<Record<EndBlockType, InventoryItem>> = {
  CHORUS_FLOWER: 'CHORUS_FLOWER',
  CHORUS_PLANT: 'CHORUS_PLANT',
  DRAGON_EGG: 'DRAGON_EGG',
  END_CRYSTAL: 'END_CRYSTAL',
  END_GATEWAY: 'AIR',
  END_ROD: 'END_ROD',
  END_STONE_BRICKS: 'END_STONE_BRICKS',
  ENDER_CHEST: 'ENDER_CHEST',
  PURPUR_BLOCK: 'PURPUR_BLOCK',
  PURPUR_PILLAR: 'PURPUR_PILLAR',
  PURPUR_SLAB: 'PURPUR_SLAB',
  PURPUR_STAIRS: 'PURPUR_STAIRS',
  SHULKER_BOX: 'SHULKER_BOX',
}

const makeEndBlock = (type: EndBlockType, hardness: number, solid: boolean, transparency = false, emissive = false) =>
  new Block({
    id: makeBlockId(`block:${type.toLowerCase()}`),
    type,
    properties: { hardness, transparency, solid, emissive, friction: solid ? 0.6 : 0.0 },
    faces: defaultBlockFaces,
  })

export const endBlocks: ReadonlyArray<Block> = [
  makeEndBlock('CHORUS_FLOWER', 0.4, false, true),
  makeEndBlock('CHORUS_PLANT', 0.4, false, true),
  makeEndBlock('DRAGON_EGG', 3, true, true),
  makeEndBlock('END_CRYSTAL', 0, false, true),
  makeEndBlock('END_GATEWAY', -1, false, true, true),
  makeEndBlock('END_ROD', 0, false, true, true),
  makeEndBlock('END_STONE_BRICKS', 45, true),
  makeEndBlock('ENDER_CHEST', 22.5, true, false, true),
  makeEndBlock('PURPUR_BLOCK', 1.5, true),
  makeEndBlock('PURPUR_PILLAR', 1.5, true),
  makeEndBlock('PURPUR_SLAB', 1.5, true, true),
  makeEndBlock('PURPUR_STAIRS', 1.5, true, true),
  makeEndBlock('SHULKER_BOX', 2, true),
]
