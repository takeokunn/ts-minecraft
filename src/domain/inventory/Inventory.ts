import { Schema } from '@effect/schema'
import type { ItemId } from '@domain/core/types/brands'

// アイテムスタック定義
export const ItemStack = Schema.Struct({
  itemId: Schema.String,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// インベントリスキーマ
export const InventorySchema = Schema.Struct({
  slots: Schema.Array(Schema.Union(ItemStack, Schema.Null)), // 36 slots (27 main + 9 hotbar)
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)), // Hotbar selection
})
export type Inventory = Schema.Schema.Type<typeof InventorySchema>

// 空のインベントリを作成
export const createEmptyInventory = (): Inventory => ({
  slots: Array(36).fill(null),
  selectedSlot: 0,
})

// インベントリ容量定数
export const INVENTORY_SIZE = {
  MAIN: 27,
  HOTBAR: 9,
  TOTAL: 36,
} as const
