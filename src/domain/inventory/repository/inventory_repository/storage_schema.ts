import { TimestampSchema } from '@domain/shared/value_object/units/timestamp'
import { Schema } from 'effect'

/**
 * LocalStorage保存用のInventory型定義
 *
 * Brand型は一度プリミティブ型に戻してから保存し、
 * 読み込み時にBrand型へ再変換する。
 */

/**
 * ItemStack用のストレージスキーマ
 * inventory-types.tsのItemStackSchemaと同等の構造だが、
 * 循環参照を避けるため独立して定義
 */
const ItemStackStorageSchema = Schema.Struct({
  itemId: Schema.String, // ItemId Brand型を解除
  count: Schema.Number.pipe(Schema.int(), Schema.positive()),
  metadata: Schema.optional(
    Schema.Struct({
      durability: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
      enchantments: Schema.optional(
        Schema.Array(
          Schema.Struct({
            id: Schema.String,
            level: Schema.Number.pipe(Schema.int(), Schema.positive()),
          })
        )
      ),
      customName: Schema.optional(Schema.String),
      lore: Schema.optional(Schema.Array(Schema.String)),
    })
  ),
})

/**
 * ArmorSlots用のストレージスキーマ
 */
const ArmorSlotsStorageSchema = Schema.Struct({
  helmet: Schema.Union(ItemStackStorageSchema, Schema.Null),
  chestplate: Schema.Union(ItemStackStorageSchema, Schema.Null),
  leggings: Schema.Union(ItemStackStorageSchema, Schema.Null),
  boots: Schema.Union(ItemStackStorageSchema, Schema.Null),
})

/**
 * InventoryMetadata用のストレージスキーマ
 */
const InventoryMetadataStorageSchema = Schema.Struct({
  lastUpdated: TimestampSchema,
  checksum: Schema.String,
})

/**
 * 単一Inventory用のストレージスキーマ
 */
const InventoryStorageItemSchema = Schema.Struct({
  id: Schema.String,
  playerId: Schema.String, // PlayerIdはStringとして保存
  slots: Schema.Record({ key: Schema.String, value: Schema.Union(ItemStackStorageSchema, Schema.Null) }).pipe(
    Schema.filter((slots) => Object.keys(slots).length <= 54, {
      message: () => 'Inventory slots cannot exceed 54 entries',
    })
  ),
  hotbar: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(Schema.maxItems(9)),
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  armor: ArmorSlotsStorageSchema,
  offhand: Schema.Union(ItemStackStorageSchema, Schema.Null),
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  metadata: InventoryMetadataStorageSchema,
})

/**
 * InventorySnapshot用のストレージスキーマ
 */
const InventorySnapshotStorageSchema = Schema.Struct({
  snapshotId: Schema.String,
  inventory: InventoryStorageItemSchema,
  timestamp: TimestampSchema,
  reason: Schema.optional(Schema.String),
})

/**
 * LocalStorage全体のデータ構造
 * inventories: Map<PlayerId, Inventory>をObjectとして保存
 * snapshots: Map<string, InventorySnapshot>をObjectとして保存
 */
export const InventoryRepositoryStorageSchema = Schema.Struct({
  inventories: Schema.optional(Schema.Record({ key: Schema.String, value: InventoryStorageItemSchema })),
  snapshots: Schema.optional(Schema.Record({ key: Schema.String, value: InventorySnapshotStorageSchema })),
  timestamp: Schema.optional(TimestampSchema),
})

export type InventoryRepositoryStorageData = Schema.Schema.Type<typeof InventoryRepositoryStorageSchema>
export type InventoryStorageItem = Schema.Schema.Type<typeof InventoryStorageItemSchema>
export type InventorySnapshotStorage = Schema.Schema.Type<typeof InventorySnapshotStorageSchema>
