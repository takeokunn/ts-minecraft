/**
 * Block Properties Constants
 *
 * Pure domain constants defining block properties including colors, opacity, textures, and materials.
 * These constants are extracted from infrastructure layer to maintain technology-agnostic domain logic.
 * All properties use const assertions for maximum type safety.
 */

/**
 * RGB color values for different block types
 * Values are normalized to 0-1 range for universal compatibility
 */
export const BLOCK_COLORS = {
  air: [0, 0, 0] as const,
  bedrock: [0.2, 0.2, 0.2] as const,
  stone: [0.5, 0.5, 0.5] as const,
  dirt: [0.6, 0.4, 0.2] as const,
  grass: [0.4, 0.8, 0.2] as const,
  sand: [0.9, 0.9, 0.6] as const,
  water: [0.0, 0.4, 0.8] as const,
  wood: [0.6, 0.3, 0.1] as const,
  leaves: [0.2, 0.6, 0.2] as const,
  coal_ore: [0.3, 0.3, 0.3] as const,
  iron_ore: [0.7, 0.5, 0.4] as const,
  gold_ore: [0.8, 0.8, 0.3] as const,
  diamond_ore: [0.6, 0.8, 0.9] as const,
  cobblestone: [0.4, 0.4, 0.4] as const,
  planks: [0.7, 0.5, 0.3] as const,
  glass: [0.9, 0.9, 0.9] as const,
  lava: [1.0, 0.4, 0.0] as const,
  obsidian: [0.1, 0.0, 0.2] as const,
  snow: [1.0, 1.0, 1.0] as const,
  ice: [0.8, 0.9, 1.0] as const,
  clay: [0.7, 0.6, 0.5] as const,
  gravel: [0.6, 0.6, 0.6] as const,
} as const

/**
 * Block opacity settings
 * Determines whether blocks are transparent, translucent, or opaque
 */
export const BLOCK_OPACITY = {
  air: { isTransparent: true, opacity: 0.0 } as const,
  water: { isTransparent: true, opacity: 0.8 } as const,
  glass: { isTransparent: true, opacity: 0.9 } as const,
  ice: { isTransparent: true, opacity: 0.85 } as const,
  leaves: { isTransparent: true, opacity: 0.8 } as const,
  lava: { isTransparent: false, opacity: 1.0, isEmissive: true } as const,
  // All other blocks are opaque
  bedrock: { isTransparent: false, opacity: 1.0 } as const,
  stone: { isTransparent: false, opacity: 1.0 } as const,
  dirt: { isTransparent: false, opacity: 1.0 } as const,
  grass: { isTransparent: false, opacity: 1.0 } as const,
  sand: { isTransparent: false, opacity: 1.0 } as const,
  wood: { isTransparent: false, opacity: 1.0 } as const,
  coal_ore: { isTransparent: false, opacity: 1.0 } as const,
  iron_ore: { isTransparent: false, opacity: 1.0 } as const,
  gold_ore: { isTransparent: false, opacity: 1.0 } as const,
  diamond_ore: { isTransparent: false, opacity: 1.0 } as const,
  cobblestone: { isTransparent: false, opacity: 1.0 } as const,
  planks: { isTransparent: false, opacity: 1.0 } as const,
  obsidian: { isTransparent: false, opacity: 1.0 } as const,
  snow: { isTransparent: false, opacity: 1.0 } as const,
  clay: { isTransparent: false, opacity: 1.0 } as const,
  gravel: { isTransparent: false, opacity: 1.0 } as const,
} as const

/**
 * Block texture mapping definitions
 * Maps block faces to texture coordinates or texture names
 */
export const BLOCK_TEXTURES = {
  grass: {
    top: 'grass_top',
    sides: 'grass_side',
    bottom: 'dirt',
  } as const,
  dirt: {
    all: 'dirt',
  } as const,
  stone: {
    all: 'stone',
  } as const,
  bedrock: {
    all: 'bedrock',
  } as const,
  sand: {
    all: 'sand',
  } as const,
  water: {
    all: 'water',
    animated: true,
  } as const,
  wood: {
    top: 'log_top',
    bottom: 'log_top',
    sides: 'log_side',
  } as const,
  leaves: {
    all: 'leaves',
  } as const,
  coal_ore: {
    all: 'coal_ore',
  } as const,
  iron_ore: {
    all: 'iron_ore',
  } as const,
  gold_ore: {
    all: 'gold_ore',
  } as const,
  diamond_ore: {
    all: 'diamond_ore',
  } as const,
  cobblestone: {
    all: 'cobblestone',
  } as const,
  planks: {
    all: 'planks_oak',
  } as const,
  glass: {
    all: 'glass',
  } as const,
  lava: {
    all: 'lava',
    animated: true,
    emissive: true,
  } as const,
  obsidian: {
    all: 'obsidian',
  } as const,
  snow: {
    all: 'snow',
  } as const,
  ice: {
    all: 'ice',
  } as const,
  clay: {
    all: 'clay',
  } as const,
  gravel: {
    all: 'gravel',
  } as const,
} as const

/**
 * Block material properties for physics and gameplay
 */
export const BLOCK_MATERIAL_PROPERTIES = {
  air: {
    hardness: 0,
    resistance: 0,
    toolRequired: null,
    isSolid: false,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: false,
    canPassThrough: true,
  } as const,
  water: {
    hardness: 100,
    resistance: 100,
    toolRequired: 'bucket',
    isSolid: false,
    isFluid: true,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: false,
    canPassThrough: true,
    flowRate: 7,
  } as const,
  lava: {
    hardness: 100,
    resistance: 100,
    toolRequired: 'bucket',
    isSolid: false,
    isFluid: true,
    isLightSource: true,
    lightLevel: 15,
    isBuildable: false,
    canPassThrough: false,
    flowRate: 3,
    damagePerSecond: 4,
  } as const,
  bedrock: {
    hardness: -1, // Unbreakable
    resistance: 3600000,
    toolRequired: null,
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
  } as const,
  stone: {
    hardness: 1.5,
    resistance: 6,
    toolRequired: 'pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
  } as const,
  dirt: {
    hardness: 0.5,
    resistance: 2.5,
    toolRequired: 'shovel',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
  } as const,
  grass: {
    hardness: 0.6,
    resistance: 3,
    toolRequired: 'shovel',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
  } as const,
  sand: {
    hardness: 0.5,
    resistance: 2.5,
    toolRequired: 'shovel',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    hasGravity: true,
  } as const,
  wood: {
    hardness: 2,
    resistance: 10,
    toolRequired: 'axe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    isFlammable: true,
  } as const,
  leaves: {
    hardness: 0.2,
    resistance: 1,
    toolRequired: 'shears',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: true,
    isFlammable: true,
    decayRate: 0.1,
  } as const,
  coal_ore: {
    hardness: 3,
    resistance: 15,
    toolRequired: 'pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropItem: 'coal',
    dropCount: [1, 1] as const,
  } as const,
  iron_ore: {
    hardness: 3,
    resistance: 15,
    toolRequired: 'stone_pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropItem: 'raw_iron',
    dropCount: [1, 1] as const,
  } as const,
  gold_ore: {
    hardness: 3,
    resistance: 15,
    toolRequired: 'iron_pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropItem: 'raw_gold',
    dropCount: [1, 1] as const,
  } as const,
  diamond_ore: {
    hardness: 3,
    resistance: 15,
    toolRequired: 'iron_pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropItem: 'diamond',
    dropCount: [1, 1] as const,
  } as const,
  cobblestone: {
    hardness: 2,
    resistance: 30,
    toolRequired: 'pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
  } as const,
  planks: {
    hardness: 2,
    resistance: 15,
    toolRequired: 'axe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    isFlammable: true,
  } as const,
  glass: {
    hardness: 0.3,
    resistance: 1.5,
    toolRequired: null,
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropsItself: false,
  } as const,
  obsidian: {
    hardness: 50,
    resistance: 1200,
    toolRequired: 'diamond_pickaxe',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
  } as const,
  snow: {
    hardness: 0.1,
    resistance: 0.5,
    toolRequired: 'shovel',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropItem: 'snowball',
    dropCount: [1, 4] as const,
  } as const,
  ice: {
    hardness: 0.5,
    resistance: 2.5,
    toolRequired: null,
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropsItself: false,
    isSlippery: true,
  } as const,
  clay: {
    hardness: 0.6,
    resistance: 3,
    toolRequired: 'shovel',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    dropItem: 'clay_ball',
    dropCount: [4, 4] as const,
  } as const,
  gravel: {
    hardness: 0.6,
    resistance: 3,
    toolRequired: 'shovel',
    isSolid: true,
    isFluid: false,
    isLightSource: false,
    lightLevel: 0,
    isBuildable: true,
    canPassThrough: false,
    hasGravity: true,
    dropItem: 'flint',
    dropCount: [0, 1] as const,
    dropChance: 0.1,
  } as const,
} as const

/**
 * Block type enumeration for type safety
 */
export type BlockType = keyof typeof BLOCK_COLORS

/**
 * All supported block types as a readonly array
 */
export const ALL_BLOCK_TYPES: readonly BlockType[] = Object.keys(BLOCK_COLORS) as readonly BlockType[]

/**
 * Utility functions for block properties
 */
export const BlockPropertiesUtils = {
  /**
   * Get the color of a block type
   */
  getBlockColor: (blockType: BlockType): readonly [number, number, number] => {
    return BLOCK_COLORS[blockType] ?? BLOCK_COLORS.stone
  },

  /**
   * Check if a block type is transparent
   */
  isBlockTransparent: (blockType: BlockType): boolean => {
    return BLOCK_OPACITY[blockType]?.isTransparent ?? false
  },

  /**
   * Get the opacity value of a block type
   */
  getBlockOpacity: (blockType: BlockType): number => {
    return BLOCK_OPACITY[blockType]?.opacity ?? 1.0
  },

  /**
   * Check if a block type is a light source
   */
  isBlockLightSource: (blockType: BlockType): boolean => {
    return BLOCK_MATERIAL_PROPERTIES[blockType]?.isLightSource ?? false
  },

  /**
   * Get the light level emitted by a block type
   */
  getBlockLightLevel: (blockType: BlockType): number => {
    return BLOCK_MATERIAL_PROPERTIES[blockType]?.lightLevel ?? 0
  },

  /**
   * Check if a block type is solid
   */
  isBlockSolid: (blockType: BlockType): boolean => {
    return BLOCK_MATERIAL_PROPERTIES[blockType]?.isSolid ?? true
  },

  /**
   * Check if a block type is a fluid
   */
  isBlockFluid: (blockType: BlockType): boolean => {
    return BLOCK_MATERIAL_PROPERTIES[blockType]?.isFluid ?? false
  },

  /**
   * Get the hardness value of a block type
   */
  getBlockHardness: (blockType: BlockType): number => {
    return BLOCK_MATERIAL_PROPERTIES[blockType]?.hardness ?? 1.0
  },

  /**
   * Get texture mapping for a block type
   */
  getBlockTextures: (blockType: BlockType) => {
    return BLOCK_TEXTURES[blockType as keyof typeof BLOCK_TEXTURES] ?? BLOCK_TEXTURES.stone
  },

  /**
   * Check if a block type has animated textures
   */
  hasAnimatedTexture: (blockType: BlockType): boolean => {
    const textures = BLOCK_TEXTURES[blockType as keyof typeof BLOCK_TEXTURES]
    return textures && 'animated' in textures && textures.animated === true
  },

  /**
   * Check if a block type is emissive (self-illuminated)
   */
  isBlockEmissive: (blockType: BlockType): boolean => {
    const textures = BLOCK_TEXTURES[blockType as keyof typeof BLOCK_TEXTURES]
    const opacity = BLOCK_OPACITY[blockType as keyof typeof BLOCK_OPACITY]
    return (textures && 'emissive' in textures && textures.emissive === true) || (opacity && 'isEmissive' in opacity && opacity.isEmissive === true)
  },

  /**
   * Check if a block type can be passed through
   */
  canPassThrough: (blockType: BlockType): boolean => {
    return BLOCK_MATERIAL_PROPERTIES[blockType]?.canPassThrough ?? false
  },

  /**
   * Validate if a block type exists
   */
  isValidBlockType: (blockType: string): blockType is BlockType => {
    return blockType in BLOCK_COLORS
  },
} as const
