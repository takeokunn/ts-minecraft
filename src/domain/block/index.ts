// 型定義のエクスポート
export type {
  BlockId,
  TextureId,
  ToolType,
  TextureFaces,
  BlockTexture,
  ItemDrop,
  BlockSound,
  BlockPhysics,
  BlockCategory,
  BlockType,
  BlockTypeEncoded,
} from './BlockType'

// スキーマと値のエクスポート（Brandedタイプの値コンストラクターのみ）
export {
  BlockId as BlockIdBrand,
  TextureId as TextureIdBrand,
  ToolTypeSchema,
  TextureFacesSchema,
  SimpleTextureSchema,
  BlockTextureSchema,
  ItemDropSchema,
  BlockSoundSchema,
  BlockPhysicsSchema,
  BlockCategorySchema,
  BlockTypeSchema,
  createDefaultPhysics,
  createDefaultSound,
} from './BlockType'

// プロパティシステムのエクスポート
export type { BlockProperties } from './BlockProperties'

export {
  defaultBlockProperties,
  withPhysics,
  withHardness,
  withResistance,
  withLuminance,
  withOpacity,
  withFlammable,
  withGravity,
  withSolid,
  withReplaceable,
  withWaterloggable,
  withTexture,
  withSimpleTexture,
  withTexturePerFace,
  withTool,
  withDrop,
  withDropSelf,
  withNoDrops,
  withSound,
  withSoundGroup,
  withTag,
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
} from './BlockProperties'

// 全ブロック定義のエクスポート
export {
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

  // 全ブロックリスト
  allBlocks,
} from './blocks'

// BlockRegistryサービスのエクスポート
export type { BlockRegistry } from './BlockRegistry'

export {
  BlockNotFoundError,
  BlockAlreadyRegisteredError,
  BlockRegistry as BlockRegistryTag,
  BlockRegistryLive,
  getBlock,
  getAllBlocks,
  getBlocksByCategory,
  getBlocksByTag,
  searchBlocks,
  registerBlock,
  isBlockRegistered,
} from './BlockRegistry'
