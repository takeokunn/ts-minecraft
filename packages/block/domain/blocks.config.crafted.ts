import { Block } from './block'
import { BlockId } from '@ts-minecraft/core'
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
]
