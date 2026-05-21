import { Schema } from 'effect';
import { BlockTypeSchema } from './block-type';
import { ItemTypeSchema } from './item-type';
// Union of all items that can appear in a player's inventory:
// world-placeable blocks (BlockType) and inventory-only items (ItemType).
export const InventoryItemSchema = Schema.Union(BlockTypeSchema, ItemTypeSchema);
//# sourceMappingURL=../../../dist/packages/kernel/domain/inventory-item.js.map