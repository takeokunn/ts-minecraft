import { Block } from './block'
import { BlockId } from '@ts-minecraft/core'
import { defaultBlockFaces, plantBlockProperties } from './blocks.config.terrain'

const makeBlockId = (id: string) => BlockId.make(id)

// Cactus is solid (unlike the passable small plants) but transparent, with an
// inset collision box — see CACTUS_COLLISION_SHAPE in aabb-collision-shapes.
const cactusBlockProperties = {
  hardness: 8,
  transparency: true,
  solid: true,
  emissive: false,
  friction: 0.6,
}

// Small plants and decoration: passable (solid:false) flora, plus the cactus.
// A sibling of blocks.config.{ores,crafted,end} — combined into initialBlocks by
// blocks.config.ts. Shares the base presets from blocks.config.terrain.
export const floraBlocks: ReadonlyArray<Block> = [
  new Block({ id: makeBlockId('block:sapling'), type: 'SAPLING', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:dandelion'), type: 'DANDELION', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:poppy'), type: 'POPPY', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:brown_mushroom'), type: 'BROWN_MUSHROOM', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:red_mushroom'), type: 'RED_MUSHROOM', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:tall_grass'), type: 'TALL_GRASS', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:fern'), type: 'FERN', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:sugar_cane'), type: 'SUGAR_CANE', properties: plantBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:cactus'), type: 'CACTUS', properties: cactusBlockProperties, faces: defaultBlockFaces }),
  new Block({ id: makeBlockId('block:lily_pad'), type: 'LILY_PAD', properties: plantBlockProperties, faces: defaultBlockFaces }),
]
