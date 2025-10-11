import {
  EPOCH_ZERO,
  Timestamp,
  TimestampSchema,
  now as timestampNow,
} from '@domain/shared/value_object/units/timestamp'
import { Effect, Schema } from 'effect'

// PlayerIdは共有カーネルから再エクスポート
export { PlayerIdSchema, type PlayerId } from '@domain/shared/entities/player_id'
export { SimpleItemIdSchema as ItemIdSchema, type ItemId } from '../../shared/entities/item_id'

// 共有カーネルから再エクスポート（互換性のためSimpleItemIdSchemaを使用）
import { SimpleItemIdSchema } from '../../shared/entities/item_id'
export const ItemId = (value: string): ItemId => Schema.decodeUnknownSync(SimpleItemIdSchema)(value)

export const ItemMetadataSchema = Schema.Struct({
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
export type ItemMetadata = Schema.Schema.Type<typeof ItemMetadataSchema>

export const ItemStackSchema = Schema.Struct({
  itemId: ItemIdSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.positive()),
  metadata: Schema.optional(ItemMetadataSchema),
})
export type ItemStack = Schema.Schema.Type<typeof ItemStackSchema>

export interface ArmorSlots {
  readonly helmet: ItemStack | null
  readonly chestplate: ItemStack | null
  readonly leggings: ItemStack | null
  readonly boots: ItemStack | null
}

export interface InventoryMetadata {
  readonly lastUpdated: Timestamp
  readonly checksum: string
}

export interface Inventory {
  readonly id: string
  readonly playerId: PlayerId
  readonly slots: ReadonlyArray<ItemStack | null>
  readonly hotbar: ReadonlyArray<number>
  readonly selectedSlot: number
  readonly armor: ArmorSlots
  readonly offhand: ItemStack | null
  readonly version: number
  readonly metadata: InventoryMetadata
}

export interface InventoryState {
  readonly inventory: Inventory
  readonly persistedAt: Timestamp
}

export const InventorySchema: Schema.Schema<Inventory> = Schema.Struct({
  id: Schema.String,
  playerId: PlayerIdSchema,
  slots: Schema.Array(Schema.Union(ItemStackSchema, Schema.Null)).pipe(Schema.minItems(36), Schema.maxItems(36)),
  hotbar: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 35))).pipe(
    Schema.minItems(9),
    Schema.maxItems(9)
  ),
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),
  armor: Schema.Struct({
    helmet: Schema.Union(ItemStackSchema, Schema.Null),
    chestplate: Schema.Union(ItemStackSchema, Schema.Null),
    leggings: Schema.Union(ItemStackSchema, Schema.Null),
    boots: Schema.Union(ItemStackSchema, Schema.Null),
  }),
  offhand: Schema.Union(ItemStackSchema, Schema.Null),
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  metadata: Schema.Struct({
    lastUpdated: TimestampSchema,
    checksum: Schema.String,
  }),
})

export const InventoryStateSchema: Schema.Schema<InventoryState> = Schema.Struct({
  inventory: InventorySchema,
  persistedAt: TimestampSchema,
})

const createEmptyArmor = (): ArmorSlots => ({
  helmet: null,
  chestplate: null,
  leggings: null,
  boots: null,
})

const DEFAULT_SLOT_COUNT = 36
const DEFAULT_HOTBAR_SIZE = 9

const serializeInventory = (inventory: Inventory) => ({
  playerId: inventory.playerId,
  slots: inventory.slots,
  hotbar: inventory.hotbar,
  selectedSlot: inventory.selectedSlot,
  armor: inventory.armor,
  offhand: inventory.offhand,
  version: inventory.version,
})

export const computeChecksum = (inventory: Inventory): string => {
  const json = JSON.stringify(serializeInventory(inventory))
  const hash = Array.from(json).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0)
  return hash.toString(16)
}

type InventoryCreationOptions = {
  readonly timestamp?: Timestamp
}

export const createEmptyInventory = (playerId: PlayerId, options?: InventoryCreationOptions): Inventory => {
  const timestamp = options?.timestamp ?? EPOCH_ZERO

  const base: Inventory = {
    id: `inventory-${playerId}`,
    playerId,
    slots: Array.from({ length: DEFAULT_SLOT_COUNT }, () => null as ItemStack | null),
    hotbar: Array.from({ length: DEFAULT_HOTBAR_SIZE }, (_, index) => index),
    selectedSlot: 0,
    armor: createEmptyArmor(),
    offhand: null,
    version: 0,
    metadata: {
      lastUpdated: timestamp,
      checksum: '',
    },
  }

  return {
    ...base,
    metadata: {
      lastUpdated: base.metadata.lastUpdated,
      checksum: computeChecksum(base),
    },
  }
}

export const createEmptyInventoryEffect = (playerId: PlayerId): Effect.Effect<Inventory> =>
  Effect.map(timestampNow(), (timestamp) => createEmptyInventory(playerId, { timestamp }))

export const touchInventory = (inventory: Inventory, timestamp: Timestamp): Inventory => {
  const updated: Inventory = {
    ...inventory,
    version: inventory.version + 1,
  }

  return {
    ...updated,
    metadata: {
      lastUpdated: timestamp,
      checksum: computeChecksum(updated),
    },
  }
}

export const touchInventoryEffect = (inventory: Inventory): Effect.Effect<Inventory> =>
  Effect.map(timestampNow(), (timestamp) => touchInventory(inventory, timestamp))

export const validateInventoryState = Schema.decodeUnknown(InventoryStateSchema)
