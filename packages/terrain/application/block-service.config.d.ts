import { HashMap, HashSet } from 'effect';
import type { BlockType, ItemType, InventoryItem } from '@ts-minecraft/kernel';
export { DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, IRON_PICKAXE_HARVESTABLE_BLOCKS, STONE_PICKAXE_HARVESTABLE_BLOCKS, WOODEN_PICKAXE_HARVESTABLE_BLOCKS, } from './harvestable-blocks';
export declare const NON_PLACEABLE_ITEM_TYPES: HashSet.HashSet<ItemType>;
export declare const INVENTORY_DROP_OVERRIDES: HashMap.HashMap<BlockType, InventoryItem>;
export declare const getInventoryDropForBlock: (blockType: BlockType) => InventoryItem;
export declare const PICKAXE_BLOCK_TYPES: HashSet.HashSet<ItemType>;
//# sourceMappingURL=block-service.config.d.ts.map