import { Brand, Data } from 'effect'

/**
 * スロットIDのBrand型
 */
export type SlotId = Brand.Brand<number, 'SlotId'> & {
  readonly min: 0
  readonly max: 35
}

/**
 * スロット状態のADT
 */
export type SlotState = Data.TaggedEnum<{
  Empty: {}
  Occupied: { readonly itemId: string; readonly quantity: number }
  Locked: { readonly reason: string }
  Reserved: { readonly reservedBy: string; readonly duration: number }
}>

/**
 * SlotState コンストラクタ
 */
export const SlotState = Data.taggedEnum<SlotState>()

/**
 * スロット制約のBrand型
 */
export type SlotConstraint = Brand.Brand<
  {
    readonly maxStackSize: number
    readonly allowedItemTypes: readonly string[]
    readonly isLocked: boolean
    readonly isHotbar: boolean
  },
  'SlotConstraint'
>

/**
 * スロット値オブジェクトのBrand型
 */
export type Slot = Brand.Brand<
  {
    readonly id: SlotId
    readonly state: SlotState
    readonly constraint: SlotConstraint
    readonly position: { readonly row: number; readonly column: number }
  },
  'Slot'
>

/**
 * スロット関連のエラーADT
 */
export type SlotError = Data.TaggedEnum<{
  InvalidSlotId: { readonly id: number; readonly min: number; readonly max: number }
  SlotOccupied: { readonly slotId: SlotId; readonly currentItem: string }
  SlotLocked: { readonly slotId: SlotId; readonly reason: string }
  IncompatibleItem: { readonly slotId: SlotId; readonly itemId: string; readonly allowedTypes: readonly string[] }
  ExceedsStackLimit: {
    readonly slotId: SlotId
    readonly currentQuantity: number
    readonly addQuantity: number
    readonly maxStack: number
  }
  InvalidPosition: { readonly row: number; readonly column: number; readonly expected: string }
  SlotNotFound: { readonly slotId: SlotId }
  InvalidConstraint: { readonly field: string; readonly value: unknown; readonly expected: string }
}>

/**
 * SlotError コンストラクタ
 */
export const SlotError = Data.taggedEnum<SlotError>()

/**
 * スロットタイプの列挙型
 */
export type SlotType = 'inventory' | 'hotbar' | 'armor' | 'crafting' | 'fuel' | 'result'

/**
 * アイテム受入判定結果
 */
export type AcceptanceResult = Data.TaggedEnum<{
  Accepted: { readonly remainingCapacity: number }
  PartiallyAccepted: { readonly acceptedQuantity: number; readonly rejectedQuantity: number }
  Rejected: { readonly reason: string }
}>

/**
 * AcceptanceResult コンストラクタ
 */
export const AcceptanceResult = Data.taggedEnum<AcceptanceResult>()
