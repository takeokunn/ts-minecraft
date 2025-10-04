import { Schema } from '@effect/schema'

export const PlayerIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>
export const PlayerId = (value: string): PlayerId => Schema.decodeUnknownSync(PlayerIdSchema)(value)

export const ItemIdSchema = Schema.String.pipe(Schema.pattern(/^[a-z0-9_:-]+$/i), Schema.brand('ItemId'))
export type ItemId = Schema.Schema.Type<typeof ItemIdSchema>
export const ItemId = (value: string): ItemId => Schema.decodeUnknownSync(ItemIdSchema)(value)

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
  readonly lastUpdated: number
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
  readonly persistedAt: number
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
    lastUpdated: Schema.Number,
    checksum: Schema.String,
  }),
})

export const InventoryStateSchema: Schema.Schema<InventoryState> = Schema.Struct({
  inventory: InventorySchema,
  persistedAt: Schema.Number,
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
  let hash = 0
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

export const createEmptyInventory = (playerId: PlayerId): Inventory => {
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
      lastUpdated: Date.now(),
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

export const touchInventory = (inventory: Inventory): Inventory => {
  const updated: Inventory = {
    ...inventory,
    version: inventory.version + 1,
  }

  return {
    ...updated,
    metadata: {
      lastUpdated: Date.now(),
      checksum: computeChecksum(updated),
    },
  }
}

export const validateInventoryState = Schema.decodeUnknown(InventoryStateSchema)
