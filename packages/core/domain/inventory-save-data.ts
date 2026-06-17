// Placed in kernel (not @ts-minecraft/inventory) to break the circular dependency:
//   @ts-minecraft/world → @ts-minecraft/inventory → @ts-minecraft/world
import { Schema } from 'effect'
import { InventoryItemSchema } from './inventory-item'
import { SlotIndexSchema } from './numerics'

const InventorySlotSaveEntrySchema = Schema.Struct({
  slot: SlotIndexSchema,
  itemType: InventoryItemSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  durability: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})

export type InventorySlotSaveEntry = Schema.Schema.Type<typeof InventorySlotSaveEntrySchema>

export const InventorySaveDataSchema = Schema.Struct({
  slots: Schema.Array(Schema.OptionFromNullOr(InventorySlotSaveEntrySchema)),
})

export type InventorySaveData = Schema.Schema.Type<typeof InventorySaveDataSchema>
