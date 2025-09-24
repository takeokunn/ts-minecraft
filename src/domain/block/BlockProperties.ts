import { pipe, Predicate } from 'effect'
import type { BlockPhysics, BlockSound, BlockTexture, ItemDrop, ToolType } from './BlockType'
import { createDefaultPhysics, createDefaultSound } from './BlockType'

// ブロックプロパティの型
export interface BlockProperties {
  physics: BlockPhysics
  sound: BlockSound
  texture: BlockTexture
  tool: ToolType
  minToolLevel: number
  drops: ItemDrop[]
  tags: string[]
}

// デフォルトプロパティ
export const defaultBlockProperties: BlockProperties = {
  physics: createDefaultPhysics(),
  sound: createDefaultSound(),
  texture: 'missing',
  tool: 'none',
  minToolLevel: 0,
  drops: [],
  tags: [],
}

// プロパティ更新関数
export const withPhysics =
  (update: Partial<BlockPhysics>) =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    physics: { ...props.physics, ...update },
  })

export const withHardness = (value: number) => withPhysics({ hardness: value })

export const withResistance = (value: number) => withPhysics({ resistance: value })

export const withLuminance = (value: number) => withPhysics({ luminance: Math.max(0, Math.min(15, value)) })

export const withOpacity = (value: number) => withPhysics({ opacity: Math.max(0, Math.min(15, value)) })

export const withFlammable = (value = true) => withPhysics({ flammable: value })

export const withGravity = (value = true) => withPhysics({ gravity: value })

export const withSolid = (value = true) => withPhysics({ solid: value })

export const withReplaceable = (value = true) => withPhysics({ replaceable: value })

export const withWaterloggable = (value = true) => withPhysics({ waterloggable: value })

// テクスチャ設定関数
export const withTexture =
  (texture: BlockTexture) =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    texture,
  })

export const withSimpleTexture = (textureId: string) => withTexture(textureId)

export const withTexturePerFace =
  (faces: { top?: string; bottom?: string; north?: string; south?: string; east?: string; west?: string }) =>
  (props: BlockProperties): BlockProperties => {
    const defaultTexture = Predicate.isString(props.texture) ? props.texture : 'missing'
    return {
      ...props,
      texture: {
        top: faces.top ?? defaultTexture,
        bottom: faces.bottom ?? defaultTexture,
        north: faces.north ?? defaultTexture,
        south: faces.south ?? defaultTexture,
        east: faces.east ?? defaultTexture,
        west: faces.west ?? defaultTexture,
      },
    }
  }

// ツール設定関数
export const withTool =
  (tool: ToolType, minLevel = 0) =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    tool,
    minToolLevel: minLevel,
  })

// ドロップ設定関数
export const withDrop =
  (itemId: string, minCount = 1, maxCount = 1, chance = 1.0) =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    drops: [...props.drops, { itemId, minCount, maxCount, chance }],
  })

export const withDropSelf = (props: BlockProperties): BlockProperties => withDrop('self', 1, 1, 1.0)(props)

export const withNoDrops = (props: BlockProperties): BlockProperties => ({
  ...props,
  drops: [],
})

// 音設定関数
export const withSound =
  (sound: Partial<BlockSound>) =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    sound: { ...props.sound, ...sound },
  })

export const withSoundGroup =
  (group: 'stone' | 'wood' | 'gravel' | 'grass' | 'metal' | 'glass' | 'wool' | 'sand') =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    sound: {
      break: `block.${group}.break`,
      place: `block.${group}.place`,
      step: `block.${group}.step`,
    },
  })

// タグ設定関数
export const withTag =
  (tag: string) =>
  (props: BlockProperties): BlockProperties => ({
    ...props,
    tags: props.tags.includes(tag) ? props.tags : [...props.tags, tag],
  })

// プリセット関数
export const stoneProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(1.5),
    withResistance(6.0),
    withTool('pickaxe', 0),
    withSoundGroup('stone'),
    withDropSelf
  )

export const dirtProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(0.5),
    withResistance(0.5),
    withTool('shovel', 0),
    withSoundGroup('gravel'),
    withDropSelf
  )

export const woodProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(2.0),
    withResistance(2.0),
    withFlammable(),
    withTool('axe', 0),
    withSoundGroup('wood'),
    withDropSelf
  )

export const leavesProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(0.2),
    withResistance(0.2),
    withFlammable(),
    withOpacity(1),
    withTool('shears', 0),
    withSoundGroup('grass')
  )

export const glassProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(0.3),
    withResistance(0.3),
    withOpacity(0),
    withSoundGroup('glass'),
    withNoDrops
  )

export const oreProperties = (hardness: number, minToolLevel: number): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(hardness),
    withResistance(3.0),
    withTool('pickaxe', minToolLevel),
    withSoundGroup('stone')
  )

export const liquidProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(-1.0), // 破壊不可
    withResistance(100.0),
    withOpacity(3),
    withSolid(false),
    withReplaceable(),
    withNoDrops
  )

export const plantProperties = (): BlockProperties =>
  pipe(
    defaultBlockProperties,
    withHardness(0.0),
    withResistance(0.0),
    withSolid(false),
    withReplaceable(),
    withSoundGroup('grass'),
    withDropSelf
  )

export const unbreakableProperties = (): BlockProperties =>
  pipe(defaultBlockProperties, withHardness(-1.0), withResistance(3600000.0), withNoDrops)

export const woolProperties = (): BlockProperties =>
  pipe(defaultBlockProperties, withHardness(0.8), withFlammable(), withSoundGroup('wool'), withDropSelf)
