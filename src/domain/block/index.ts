// 型定義のエクスポート
export type {
  BlockCategory,
  BlockId,
  BlockPhysics,
  BlockSound,
  BlockTexture,
  BlockType,
  BlockTypeEncoded,
  ItemDrop,
  TextureFaces,
  TextureId,
  ToolType,
} from './BlockType'

// スキーマと値のエクスポート（Brandedタイプの値コンストラクターのみ）
export {
  BlockCategorySchema,
  BlockId as BlockIdBrand,
  BlockPhysicsSchema,
  BlockSoundSchema,
  BlockTextureSchema,
  BlockTypeSchema,
  ItemDropSchema,
  SimpleTextureSchema,
  TextureFacesSchema,
  TextureId as TextureIdBrand,
  ToolTypeSchema,
  createDefaultPhysics,
  createDefaultSound,
} from './BlockType'

// プロパティシステムのエクスポート
export type { BlockProperties } from './BlockProperties'

export {
  defaultBlockProperties,
  dirtProperties,
  glassProperties,
  leavesProperties,
  liquidProperties,
  oreProperties,
  plantProperties,
  stoneProperties,
  unbreakableProperties,
  withDrop,
  withDropSelf,
  withFlammable,
  withGravity,
  withHardness,
  withLuminance,
  withNoDrops,
  withOpacity,
  withPhysics,
  withReplaceable,
  withResistance,
  withSimpleTexture,
  withSolid,
  withSound,
  withSoundGroup,
  withTag,
  withTexture,
  withTexturePerFace,
  withTool,
  withWaterloggable,
  woodProperties,
  woolProperties,
} from './BlockProperties'

// 全ブロック定義のエクスポート
export {
  // 全ブロックリスト
  allBlocks,
  bedrockBlock,
  birchLogBlock,
  bookshelfBlock,
  // 建築ブロック
  brickBlock,
  carpetBlock,
  chestBlock,
  clayBlock,
  // 鉱石ブロック
  coalOreBlock,
  cobblestoneBlock,
  concreteBlock,
  craftingTableBlock,
  diamondOreBlock,
  dirtBlock,
  emeraldOreBlock,
  endStoneBlock,
  farmlandBlock,
  flowerBlock,
  // テクニカルブロック
  furnaceBlock,
  glassBlock,
  glowstoneBlock,
  goldOreBlock,
  grassBlock,
  gravelBlock,
  iceBlock,
  ironOreBlock,
  lapisOreBlock,
  lavaBlock,
  netherBrickBlock,
  netherrackBlock,
  oakLeavesBlock,
  // 木材ブロック
  oakLogBlock,
  oakPlanksBlock,
  obsidianBlock,
  pistonBlock,
  purpurBlock,
  quartzBlock,
  // レッドストーン関連
  redstoneBlock,
  redstoneOreBlock,
  sandBlock,
  snowBlock,
  soulSandBlock,
  spruceLogBlock,
  stainedGlassBlock,
  // 自然ブロック
  stoneBlock,
  stoneBrickBlock,
  terracottaBlock,
  // 装飾ブロック
  torchBlock,
  // 液体ブロック
  waterBlock,
  // 農業ブロック
  wheatBlock,
  woolBlock,
} from './blocks'

// BlockRegistryサービスのエクスポート
export type { BlockRegistry } from './BlockRegistry'

export {
  BlockAlreadyRegisteredError,
  BlockNotFoundError,
  BlockRegistryLive,
  BlockRegistry as BlockRegistryTag,
  getAllBlocks,
  getBlock,
  getBlocksByCategory,
  getBlocksByTag,
  isBlockRegistered,
  registerBlock,
  searchBlocks,
} from './BlockRegistry'
