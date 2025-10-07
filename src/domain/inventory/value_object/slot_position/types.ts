import { Brand, Data } from 'effect'
import { unsafeCoerce } from 'effect/Function'

/**
 * SlotPosition Brand型（0-35範囲）
 */
export type SlotPosition = Brand.Brand<number, 'SlotPosition'> & {
  readonly min: 0
  readonly max: 35
}

/**
 * グリッド座標のBrand型
 */
export type GridCoordinate = Brand.Brand<
  {
    readonly row: number
    readonly column: number
  },
  'GridCoordinate'
>

/**
 * スロットセクションのADT
 */
export type SlotSection = Data.TaggedEnum<{
  Hotbar: { readonly startIndex: 0; readonly endIndex: 8; readonly priority: 'highest' }
  MainInventory: { readonly startIndex: 9; readonly endIndex: 35; readonly priority: 'normal' }
  ArmorSlots: { readonly helmet: 36; readonly chestplate: 37; readonly leggings: 38; readonly boots: 39 }
  OffhandSlot: { readonly index: 40 }
  CraftingGrid: { readonly startIndex: 1; readonly endIndex: 4; readonly gridSize: '2x2' }
  CraftingResult: { readonly index: 0 }
}>

/**
 * SlotSection コンストラクタ
 */
export const SlotSection = Data.taggedEnum<SlotSection>()

/**
 * 座標変換の種類ADT
 */
export type CoordinateTransform = Data.TaggedEnum<{
  PositionToGrid: { readonly position: SlotPosition }
  GridToPosition: { readonly grid: GridCoordinate }
  HotbarToPosition: { readonly hotbarIndex: number }
  PositionToHotbar: { readonly position: SlotPosition }
  ArmorSlotToPosition: { readonly armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots' }
  PositionToArmorSlot: { readonly position: SlotPosition }
}>

/**
 * CoordinateTransform コンストラクタ
 */
export const CoordinateTransform = Data.taggedEnum<CoordinateTransform>()

/**
 * 座標変換結果のADT
 */
export type TransformResult = Data.TaggedEnum<{
  Success: { readonly result: SlotPosition | GridCoordinate | number | string }
  OutOfRange: { readonly input: number; readonly validRange: { min: number; max: number } }
  InvalidSection: { readonly section: string; readonly reason: string }
  UnsupportedTransform: { readonly from: string; readonly to: string }
}>

/**
 * TransformResult コンストラクタ
 */
export const TransformResult = Data.taggedEnum<TransformResult>()

/**
 * SlotPosition関連のエラーADT
 */
export type SlotPositionError = Data.TaggedEnum<{
  PositionOutOfRange: { readonly position: number; readonly min: number; readonly max: number }
  InvalidGridCoordinate: {
    readonly row: number
    readonly column: number
    readonly maxRow: number
    readonly maxColumn: number
  }
  InvalidHotbarIndex: { readonly index: number; readonly validRange: string }
  InvalidArmorSlot: { readonly slot: string; readonly validSlots: readonly string[] }
  CoordinateConversionFailed: { readonly from: unknown; readonly to: string; readonly reason: string }
  SectionMismatch: { readonly position: SlotPosition; readonly expectedSection: string; readonly actualSection: string }
  GridSizeExceeded: { readonly requestedSize: number; readonly maxSize: number }
}>

/**
 * SlotPositionError コンストラクタ
 */
export const SlotPositionError = Data.taggedEnum<SlotPositionError>()

/**
 * スロット範囲の定義
 */
export type SlotRange = {
  readonly start: SlotPosition
  readonly end: SlotPosition
  readonly length: number
  readonly section: SlotSection
}

/**
 * 座標計算の設定
 */
export type CoordinateConfig = {
  readonly gridWidth: number
  readonly gridHeight: number
  readonly hotbarSize: number
  readonly totalSlots: number
  readonly hasArmorSlots: boolean
  readonly hasOffhandSlot: boolean
  readonly hasCraftingGrid: boolean
}

/**
 * スロット配置パターンのADT
 */
export type SlotPattern = Data.TaggedEnum<{
  Standard: { readonly rows: 3; readonly columns: 9; readonly hotbar: true }
  Compact: { readonly rows: 2; readonly columns: 9; readonly hotbar: true }
  Wide: { readonly rows: 1; readonly columns: 9; readonly hotbar: false }
  Creative: { readonly unlimited: true; readonly searchable: true }
  Crafting: { readonly gridSize: '2x2' | '3x3'; readonly hasResult: true }
  Furnace: { readonly input: SlotPosition; readonly fuel: SlotPosition; readonly output: SlotPosition }
  Anvil: { readonly left: SlotPosition; readonly right: SlotPosition; readonly result: SlotPosition }
}>

/**
 * SlotPattern コンストラクタ
 */
export const SlotPattern = Data.taggedEnum<SlotPattern>()

/**
 * 隣接スロット情報
 */
export type AdjacentSlots = {
  readonly above?: SlotPosition
  readonly below?: SlotPosition
  readonly left?: SlotPosition
  readonly right?: SlotPosition
  readonly diagonal?: {
    readonly topLeft?: SlotPosition
    readonly topRight?: SlotPosition
    readonly bottomLeft?: SlotPosition
    readonly bottomRight?: SlotPosition
  }
}

/**
 * SlotPosition を安全でない方法で作成（パフォーマンス重視）
 * 高頻度呼び出し箇所でのみ使用すること
 */
export const makeUnsafeSlotPosition = (position: number): SlotPosition => unsafeCoerce<number, SlotPosition>(position)
