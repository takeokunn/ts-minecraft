// Placed in kernel (not @ts-minecraft/inventory) to break the circular dependency:
//   @ts-minecraft/world → @ts-minecraft/inventory → @ts-minecraft/world
import { Schema } from 'effect'
import { InventoryItemSchema } from './inventory-item'
import { SlotIndexSchema, StackCountSchema } from './numerics'

const InventorySlotSaveEntrySchema = Schema.Struct({
  slot: SlotIndexSchema,
  itemType: InventoryItemSchema,
  // Branded like ItemStack.count — plain JSON numbers still decode, but the
  // hydrated value carries the 1-64 invariant end to end.
  count: StackCountSchema,
  durability: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  // Anvil rename — optional keeps pre-rename saves decodable (like durability).
  customName: Schema.optional(Schema.String),
})

export type InventorySlotSaveEntry = Schema.Schema.Type<typeof InventorySlotSaveEntrySchema>

export const InventorySaveDataSchema = Schema.Struct({
  slots: Schema.Array(Schema.OptionFromNullOr(InventorySlotSaveEntrySchema)),
})

export type InventorySaveData = Schema.Schema.Type<typeof InventorySaveDataSchema>
