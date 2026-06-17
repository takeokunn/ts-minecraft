import { Option } from 'effect'
import { Block } from './block'
import { BlockId, type BlockType } from '@ts-minecraft/core'
import { defaultBlockFaces } from './blocks.config.terrain'

// XP awarded when a player breaks an ore block (vanilla Java Edition values).
// Iron and gold drop raw ore items (no XP at break time; XP comes from smelting).
const ORE_XP_BLOCK_TYPES = [
  'COAL_ORE',
  'DEEPSLATE_COAL_ORE',
  'IRON_ORE',
  'DEEPSLATE_IRON_ORE',
  'GOLD_ORE',
  'DEEPSLATE_GOLD_ORE',
  'DIAMOND_ORE',
  'DEEPSLATE_DIAMOND_ORE',
  'EMERALD_ORE',
  'DEEPSLATE_EMERALD_ORE',
  'LAPIS_ORE',
  'DEEPSLATE_LAPIS_ORE',
  'REDSTONE_ORE',
  'DEEPSLATE_REDSTONE_ORE',
] as const satisfies ReadonlyArray<BlockType>

export type OreXpBlockType = typeof ORE_XP_BLOCK_TYPES[number]

const ORE_XP_BLOCK_TYPE_SET: ReadonlySet<BlockType> = new Set<BlockType>(ORE_XP_BLOCK_TYPES)

const ORE_XP_TABLE = {
  COAL_ORE: 5, DEEPSLATE_COAL_ORE: 5,
  IRON_ORE: 0, DEEPSLATE_IRON_ORE: 0,
  GOLD_ORE: 0, DEEPSLATE_GOLD_ORE: 0,
  DIAMOND_ORE: 7, DEEPSLATE_DIAMOND_ORE: 7,
  EMERALD_ORE: 7, DEEPSLATE_EMERALD_ORE: 7,
  LAPIS_ORE: 5, DEEPSLATE_LAPIS_ORE: 5,
  REDSTONE_ORE: 5, DEEPSLATE_REDSTONE_ORE: 5,
} as const satisfies Readonly<Record<OreXpBlockType, number>>

export const isOreXpBlock = (blockType: BlockType): blockType is OreXpBlockType =>
  ORE_XP_BLOCK_TYPE_SET.has(blockType)

export const getOreXpDrop = (blockType: OreXpBlockType): number => ORE_XP_TABLE[blockType]

export const getOreXpDropOption = (blockType: BlockType): Option.Option<number> =>
  isOreXpBlock(blockType) ? Option.some(getOreXpDrop(blockType)) : Option.none()

// Hardness on the shared 0-100 scale (see blocks.config.terrain.ts), preserving
// vanilla relative ordering: stone-tier ore(50, vanilla 3.0 = deepslate) <
// deepslate ore(60, 4.5) < most mineral blocks(65, 5.0) — all far below
// obsidian(90). Gold & lapis blocks are soft (vanilla 3.0) → 50.
export const oreAndMineralBlocks: ReadonlyArray<Block> = [
  new Block({
    id: BlockId.make('block:coal_ore'),
    type: 'COAL_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:iron_ore'),
    type: 'IRON_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:gold_ore'),
    type: 'GOLD_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:diamond_ore'),
    type: 'DIAMOND_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:redstone_ore'),
    type: 'REDSTONE_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: true, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:lapis_ore'),
    type: 'LAPIS_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:emerald_ore'),
    type: 'EMERALD_ORE',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_coal_ore'),
    type: 'DEEPSLATE_COAL_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_iron_ore'),
    type: 'DEEPSLATE_IRON_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_gold_ore'),
    type: 'DEEPSLATE_GOLD_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_diamond_ore'),
    type: 'DEEPSLATE_DIAMOND_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_redstone_ore'),
    type: 'DEEPSLATE_REDSTONE_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: true, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_lapis_ore'),
    type: 'DEEPSLATE_LAPIS_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:deepslate_emerald_ore'),
    type: 'DEEPSLATE_EMERALD_ORE',
    properties: { hardness: 60, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:coal_block'),
    type: 'COAL_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:iron_block'),
    type: 'IRON_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:gold_block'),
    type: 'GOLD_BLOCK',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:diamond_block'),
    type: 'DIAMOND_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:redstone_block'),
    type: 'REDSTONE_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: true, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:lapis_block'),
    type: 'LAPIS_BLOCK',
    properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: BlockId.make('block:emerald_block'),
    type: 'EMERALD_BLOCK',
    properties: { hardness: 65, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
]
