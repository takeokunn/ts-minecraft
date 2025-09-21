import { pipe } from 'effect'
import type { BlockType } from './BlockType'
import {
  stoneProperties,
  dirtProperties,
  woodProperties,
  leavesProperties,
  glassProperties,
  oreProperties,
  liquidProperties,
  plantProperties,
  unbreakableProperties,
  woolProperties,
  withHardness,
  withResistance,
  withGravity,
  withSoundGroup,
  withDrop,
  withDropSelf,
  withNoDrops,
  withLuminance,
  withOpacity,
  withFlammable,
  withSolid,
  withTool,
  withTexture,
} from './BlockProperties'

// 自然ブロック (Natural Blocks)
export const stoneBlock: BlockType = {
  id: 'stone',
  name: 'Stone',
  category: 'natural',
  stackSize: 64,
  ...pipe(stoneProperties(), withTexture('stone')),
}

export const dirtBlock: BlockType = {
  id: 'dirt',
  name: 'Dirt',
  category: 'natural',
  stackSize: 64,
  ...pipe(dirtProperties(), withTexture('dirt')),
}

export const grassBlock: BlockType = {
  id: 'grass_block',
  name: 'Grass Block',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    dirtProperties(),
    withSoundGroup('grass'),
    withTexture({
      top: 'grass_block_top',
      bottom: 'dirt',
      north: 'grass_block_side',
      south: 'grass_block_side',
      east: 'grass_block_side',
      west: 'grass_block_side',
    })
  ),
}

export const cobblestoneBlock: BlockType = {
  id: 'cobblestone',
  name: 'Cobblestone',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(2.0), withResistance(6.0), withTexture('cobblestone')),
}

export const sandBlock: BlockType = {
  id: 'sand',
  name: 'Sand',
  category: 'natural',
  stackSize: 64,
  ...pipe(dirtProperties(), withGravity(), withSoundGroup('sand'), withTexture('sand')),
}

export const gravelBlock: BlockType = {
  id: 'gravel',
  name: 'Gravel',
  category: 'natural',
  stackSize: 64,
  ...pipe(dirtProperties(), withGravity(), withSoundGroup('gravel'), withTexture('gravel')),
}

export const bedrockBlock: BlockType = {
  id: 'bedrock',
  name: 'Bedrock',
  category: 'natural',
  stackSize: 64,
  ...pipe(unbreakableProperties(), withTexture('bedrock')),
}

// 木材ブロック (Wood Blocks)
export const oakLogBlock: BlockType = {
  id: 'oak_log',
  name: 'Oak Log',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    woodProperties(),
    withTexture({
      top: 'oak_log_top',
      bottom: 'oak_log_top',
      north: 'oak_log',
      south: 'oak_log',
      east: 'oak_log',
      west: 'oak_log',
    })
  ),
}

export const oakPlanksBlock: BlockType = {
  id: 'oak_planks',
  name: 'Oak Planks',
  category: 'building',
  stackSize: 64,
  ...pipe(woodProperties(), withTexture('oak_planks')),
}

export const birchLogBlock: BlockType = {
  id: 'birch_log',
  name: 'Birch Log',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    woodProperties(),
    withTexture({
      top: 'birch_log_top',
      bottom: 'birch_log_top',
      north: 'birch_log',
      south: 'birch_log',
      east: 'birch_log',
      west: 'birch_log',
    })
  ),
}

export const spruceLogBlock: BlockType = {
  id: 'spruce_log',
  name: 'Spruce Log',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    woodProperties(),
    withTexture({
      top: 'spruce_log_top',
      bottom: 'spruce_log_top',
      north: 'spruce_log',
      south: 'spruce_log',
      east: 'spruce_log',
      west: 'spruce_log',
    })
  ),
}

export const oakLeavesBlock: BlockType = {
  id: 'oak_leaves',
  name: 'Oak Leaves',
  category: 'natural',
  stackSize: 64,
  ...pipe(leavesProperties(), withTexture('oak_leaves')),
}

// 鉱石ブロック (Ore Blocks)
export const coalOreBlock: BlockType = {
  id: 'coal_ore',
  name: 'Coal Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 0), withDrop('coal', 1, 1, 1.0), withTexture('coal_ore')),
}

export const ironOreBlock: BlockType = {
  id: 'iron_ore',
  name: 'Iron Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 1), withDrop('raw_iron', 1, 1, 1.0), withTexture('iron_ore')),
}

export const goldOreBlock: BlockType = {
  id: 'gold_ore',
  name: 'Gold Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 2), withDrop('raw_gold', 1, 1, 1.0), withTexture('gold_ore')),
}

export const diamondOreBlock: BlockType = {
  id: 'diamond_ore',
  name: 'Diamond Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 2), withDrop('diamond', 1, 1, 1.0), withTexture('diamond_ore')),
}

export const emeraldOreBlock: BlockType = {
  id: 'emerald_ore',
  name: 'Emerald Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 2), withDrop('emerald', 1, 1, 1.0), withTexture('emerald_ore')),
}

export const redstoneOreBlock: BlockType = {
  id: 'redstone_ore',
  name: 'Redstone Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 2), withLuminance(9), withDrop('redstone', 4, 5, 1.0), withTexture('redstone_ore')),
}

export const lapisOreBlock: BlockType = {
  id: 'lapis_ore',
  name: 'Lapis Lazuli Ore',
  category: 'natural',
  stackSize: 64,
  ...pipe(oreProperties(3.0, 1), withDrop('lapis_lazuli', 4, 9, 1.0), withTexture('lapis_ore')),
}

// 建築ブロック (Building Blocks)
export const brickBlock: BlockType = {
  id: 'bricks',
  name: 'Bricks',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(2.0), withResistance(6.0), withTexture('bricks')),
}

export const stoneBrickBlock: BlockType = {
  id: 'stone_bricks',
  name: 'Stone Bricks',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(1.5), withResistance(6.0), withTexture('stone_bricks')),
}

export const glassBlock: BlockType = {
  id: 'glass',
  name: 'Glass',
  category: 'building',
  stackSize: 64,
  ...pipe(glassProperties(), withTexture('glass')),
}

export const woolBlock: BlockType = {
  id: 'white_wool',
  name: 'White Wool',
  category: 'building',
  stackSize: 64,
  ...pipe(woolProperties(), withTexture('white_wool')),
}

export const bookshelfBlock: BlockType = {
  id: 'bookshelf',
  name: 'Bookshelf',
  category: 'decoration',
  stackSize: 64,
  ...pipe(
    woodProperties(),
    withHardness(1.5),
    withFlammable(),
    withTexture({
      top: 'oak_planks',
      bottom: 'oak_planks',
      north: 'bookshelf',
      south: 'bookshelf',
      east: 'bookshelf',
      west: 'bookshelf',
    })
  ),
}

// 装飾ブロック (Decoration Blocks)
export const torchBlock: BlockType = {
  id: 'torch',
  name: 'Torch',
  category: 'decoration',
  stackSize: 64,
  ...pipe(plantProperties(), withLuminance(14), withTexture('torch')),
}

export const glowstoneBlock: BlockType = {
  id: 'glowstone',
  name: 'Glowstone',
  category: 'building',
  stackSize: 64,
  ...pipe(
    glassProperties(),
    withLuminance(15),
    withSoundGroup('glass'),
    withDrop('glowstone_dust', 2, 4, 1.0),
    withTexture('glowstone')
  ),
}

export const flowerBlock: BlockType = {
  id: 'poppy',
  name: 'Poppy',
  category: 'decoration',
  stackSize: 64,
  ...pipe(plantProperties(), withTexture('poppy')),
}

// 液体ブロック (Liquid Blocks)
export const waterBlock: BlockType = {
  id: 'water',
  name: 'Water',
  category: 'natural',
  stackSize: 1,
  ...pipe(liquidProperties(), withTexture('water_still')),
}

export const lavaBlock: BlockType = {
  id: 'lava',
  name: 'Lava',
  category: 'natural',
  stackSize: 1,
  ...pipe(liquidProperties(), withLuminance(15), withTexture('lava_still')),
}

// テクニカルブロック (Technical Blocks)
export const furnaceBlock: BlockType = {
  id: 'furnace',
  name: 'Furnace',
  category: 'miscellaneous',
  stackSize: 64,
  ...pipe(
    stoneProperties(),
    withHardness(3.5),
    withTexture({
      top: 'furnace_top',
      bottom: 'furnace_top',
      north: 'furnace_front',
      south: 'furnace_side',
      east: 'furnace_side',
      west: 'furnace_side',
    })
  ),
}

export const craftingTableBlock: BlockType = {
  id: 'crafting_table',
  name: 'Crafting Table',
  category: 'miscellaneous',
  stackSize: 64,
  ...pipe(
    woodProperties(),
    withHardness(2.5),
    withTexture({
      top: 'crafting_table_top',
      bottom: 'oak_planks',
      north: 'crafting_table_front',
      south: 'crafting_table_front',
      east: 'crafting_table_side',
      west: 'crafting_table_side',
    })
  ),
}

export const chestBlock: BlockType = {
  id: 'chest',
  name: 'Chest',
  category: 'miscellaneous',
  stackSize: 64,
  ...pipe(woodProperties(), withHardness(2.5), withTexture('oak_planks')),
}

// 追加の自然ブロック
export const clayBlock: BlockType = {
  id: 'clay',
  name: 'Clay',
  category: 'natural',
  stackSize: 64,
  ...pipe(dirtProperties(), withHardness(0.6), withDrop('clay_ball', 4, 4, 1.0), withTexture('clay')),
}

export const snowBlock: BlockType = {
  id: 'snow_block',
  name: 'Snow Block',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    dirtProperties(),
    withHardness(0.2),
    withTool('shovel', 0),
    withDrop('snowball', 4, 4, 1.0),
    withTexture('snow')
  ),
}

export const iceBlock: BlockType = {
  id: 'ice',
  name: 'Ice',
  category: 'natural',
  stackSize: 64,
  ...pipe(glassProperties(), withHardness(0.5), withOpacity(3), withTexture('ice')),
}

export const obsidianBlock: BlockType = {
  id: 'obsidian',
  name: 'Obsidian',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    stoneProperties(),
    withHardness(50.0),
    withResistance(1200.0),
    withTool('pickaxe', 3),
    withTexture('obsidian')
  ),
}

// 追加の建築ブロック
export const quartzBlock: BlockType = {
  id: 'quartz_block',
  name: 'Block of Quartz',
  category: 'building',
  stackSize: 64,
  ...pipe(
    stoneProperties(),
    withHardness(0.8),
    withTexture({
      top: 'quartz_block_top',
      bottom: 'quartz_block_bottom',
      north: 'quartz_block_side',
      south: 'quartz_block_side',
      east: 'quartz_block_side',
      west: 'quartz_block_side',
    })
  ),
}

export const concreteBlock: BlockType = {
  id: 'white_concrete',
  name: 'White Concrete',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(1.8), withTexture('white_concrete')),
}

export const terracottaBlock: BlockType = {
  id: 'terracotta',
  name: 'Terracotta',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(1.25), withResistance(4.2), withTexture('terracotta')),
}

// 農業ブロック
export const farmlandBlock: BlockType = {
  id: 'farmland',
  name: 'Farmland',
  category: 'natural',
  stackSize: 64,
  ...pipe(
    dirtProperties(),
    withHardness(0.6),
    withTexture({
      top: 'farmland',
      bottom: 'dirt',
      north: 'dirt',
      south: 'dirt',
      east: 'dirt',
      west: 'dirt',
    })
  ),
}

export const wheatBlock: BlockType = {
  id: 'wheat',
  name: 'Wheat Crops',
  category: 'food',
  stackSize: 64,
  ...pipe(
    plantProperties(),
    withDrop('wheat', 1, 1, 1.0),
    withDrop('wheat_seeds', 0, 3, 1.0),
    withTexture('wheat_stage7')
  ),
}

// ネザーブロック
export const netherBrickBlock: BlockType = {
  id: 'nether_bricks',
  name: 'Nether Bricks',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(2.0), withResistance(6.0), withTexture('nether_bricks')),
}

export const soulSandBlock: BlockType = {
  id: 'soul_sand',
  name: 'Soul Sand',
  category: 'natural',
  stackSize: 64,
  ...pipe(dirtProperties(), withHardness(0.5), withTexture('soul_sand')),
}

export const netherrackBlock: BlockType = {
  id: 'netherrack',
  name: 'Netherrack',
  category: 'natural',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(0.4), withResistance(0.4), withTexture('netherrack')),
}

// エンドブロック
export const endStoneBlock: BlockType = {
  id: 'end_stone',
  name: 'End Stone',
  category: 'natural',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(3.0), withResistance(9.0), withTexture('end_stone')),
}

export const purpurBlock: BlockType = {
  id: 'purpur_block',
  name: 'Purpur Block',
  category: 'building',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(1.5), withResistance(6.0), withTexture('purpur_block')),
}

// レッドストーン関連
export const redstoneBlock: BlockType = {
  id: 'redstone_block',
  name: 'Block of Redstone',
  category: 'redstone',
  stackSize: 64,
  ...pipe(stoneProperties(), withHardness(5.0), withResistance(6.0), withLuminance(15), withTexture('redstone_block')),
}

export const pistonBlock: BlockType = {
  id: 'piston',
  name: 'Piston',
  category: 'redstone',
  stackSize: 64,
  ...pipe(
    stoneProperties(),
    withHardness(1.5),
    withTexture({
      top: 'piston_top',
      bottom: 'piston_bottom',
      north: 'piston_side',
      south: 'piston_side',
      east: 'piston_side',
      west: 'piston_side',
    })
  ),
}

// 追加の装飾ブロック
export const carpetBlock: BlockType = {
  id: 'white_carpet',
  name: 'White Carpet',
  category: 'decoration',
  stackSize: 64,
  ...pipe(woolProperties(), withHardness(0.1), withSolid(false), withTexture('white_wool')),
}

export const stainedGlassBlock: BlockType = {
  id: 'white_stained_glass',
  name: 'White Stained Glass',
  category: 'building',
  stackSize: 64,
  ...pipe(glassProperties(), withTexture('white_stained_glass')),
}

// 全ブロックのエクスポート
export const allBlocks: BlockType[] = [
  // 自然ブロック
  stoneBlock,
  dirtBlock,
  grassBlock,
  cobblestoneBlock,
  sandBlock,
  gravelBlock,
  bedrockBlock,
  clayBlock,
  snowBlock,
  iceBlock,
  obsidianBlock,
  netherrackBlock,
  soulSandBlock,
  endStoneBlock,
  farmlandBlock,

  // 木材ブロック
  oakLogBlock,
  oakPlanksBlock,
  birchLogBlock,
  spruceLogBlock,
  oakLeavesBlock,

  // 鉱石ブロック
  coalOreBlock,
  ironOreBlock,
  goldOreBlock,
  diamondOreBlock,
  emeraldOreBlock,
  redstoneOreBlock,
  lapisOreBlock,

  // 建築ブロック
  brickBlock,
  stoneBrickBlock,
  glassBlock,
  woolBlock,
  bookshelfBlock,
  quartzBlock,
  concreteBlock,
  terracottaBlock,
  netherBrickBlock,
  purpurBlock,
  stainedGlassBlock,

  // 装飾ブロック
  torchBlock,
  glowstoneBlock,
  flowerBlock,
  carpetBlock,

  // 液体ブロック
  waterBlock,
  lavaBlock,

  // テクニカルブロック
  furnaceBlock,
  craftingTableBlock,
  chestBlock,

  // 農業ブロック
  wheatBlock,

  // レッドストーン関連
  redstoneBlock,
  pistonBlock,
]

// ブロック数の確認（50種類以上）
console.log(`Total blocks defined: ${allBlocks.length}`)
