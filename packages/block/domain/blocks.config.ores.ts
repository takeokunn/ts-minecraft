import { Block } from './block'
import { BlockId } from '@ts-minecraft/core'
import { defaultBlockFaces } from './blocks.config.terrain'

// Hardness on the shared 0-100 scale (see blocks.config.terrain.ts), preserving
// vanilla relative ordering: stone-tier ore(50, vanilla 3.0 = deepslate) <
// deepslate ore(60, 4.5) < most mineral blocks(65, 5.0) — all far below
// obsidian(90). Gold & lapis blocks are soft (vanilla 3.0) → 50.
const makeBlockId = (id: string) => BlockId.make(id)

export const oreAndMineralBlocks: ReadonlyArray<Block> = [
  new Block({
    id: makeBlockId('block:coal_ore'),
    type: 'COAL_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:iron_ore'),
    type: 'IRON_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:gold_ore'),
    type: 'GOLD_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:diamond_ore'),
    type: 'DIAMOND_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:redstone_ore'),
    type: 'REDSTONE_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: true, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:lapis_ore'),
    type: 'LAPIS_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:emerald_ore'),
    type: 'EMERALD_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_coal_ore'),
    type: 'DEEPSLATE_COAL_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_iron_ore'),
    type: 'DEEPSLATE_IRON_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_gold_ore'),
    type: 'DEEPSLATE_GOLD_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_diamond_ore'),
    type: 'DEEPSLATE_DIAMOND_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_redstone_ore'),
    type: 'DEEPSLATE_REDSTONE_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: true, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_lapis_ore'),
    type: 'DEEPSLATE_LAPIS_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:deepslate_emerald_ore'),
    type: 'DEEPSLATE_EMERALD_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:coal_block'),
    type: 'COAL_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:iron_block'),
    type: 'IRON_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:gold_block'),
    type: 'GOLD_BLOCK',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:diamond_block'),
    type: 'DIAMOND_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:redstone_block'),
    type: 'REDSTONE_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: true, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:lapis_block'),
    type: 'LAPIS_BLOCK',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:emerald_block'),
    type: 'EMERALD_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
]
