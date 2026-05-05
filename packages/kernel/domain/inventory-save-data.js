// Placed in kernel (not @ts-minecraft/inventory) to break the circular dependency:
//   @ts-minecraft/world-state → @ts-minecraft/inventory → @ts-minecraft/world-state
import { Schema } from 'effect';
import { InventoryItemSchema } from './inventory-item';
import { SlotIndexSchema } from './numerics';
const InventorySlotSaveEntrySchema = Schema.Struct({
    slot: SlotIndexSchema,
    itemType: InventoryItemSchema,
    count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
});
export const InventorySaveDataSchema = Schema.Struct({
    slots: Schema.Array(Schema.OptionFromNullOr(InventorySlotSaveEntrySchema)),
});
//# sourceMappingURL=inventory-save-data.js.map