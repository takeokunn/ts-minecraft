import { Schema } from 'effect'
import { BlockTypeSchema } from './block'
import { SlotIndexSchema } from '@ts-minecraft/kernel'

const InventorySlotSaveEntrySchema = Schema.Struct({
  slot: SlotIndexSchema,
  blockType: BlockTypeSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
})

export const InventorySaveDataSchema = Schema.Struct({
  slots: Schema.Array(Schema.NullOr(InventorySlotSaveEntrySchema)),
})

export type InventorySaveData = Schema.Schema.Type<typeof InventorySaveDataSchema>
