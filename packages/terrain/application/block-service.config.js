import { HashMap, HashSet, Option } from 'effect';
export { DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, IRON_PICKAXE_HARVESTABLE_BLOCKS, STONE_PICKAXE_HARVESTABLE_BLOCKS, WOODEN_PICKAXE_HARVESTABLE_BLOCKS, } from './harvestable-blocks';
export const NON_PLACEABLE_ITEM_TYPES = HashSet.fromIterable([
    'STICKS',
    'COAL',
    'WOODEN_SWORD',
    'WOODEN_PICKAXE',
    'STONE_PICKAXE',
    'RAW_IRON',
    'IRON_INGOT',
    'IRON_PICKAXE',
    'RAW_GOLD',
    'GOLD_INGOT',
    'DIAMOND',
    'REDSTONE_DUST',
    'LAPIS_LAZULI',
    'EMERALD',
    'DIAMOND_PICKAXE',
]);
export const INVENTORY_DROP_OVERRIDES = HashMap.fromIterable([
    ['STONE', 'COBBLESTONE'],
    ['COAL_ORE', 'COAL'],
    ['DEEPSLATE_COAL_ORE', 'COAL'],
    ['IRON_ORE', 'RAW_IRON'],
    ['DEEPSLATE_IRON_ORE', 'RAW_IRON'],
    ['GOLD_ORE', 'RAW_GOLD'],
    ['DEEPSLATE_GOLD_ORE', 'RAW_GOLD'],
    ['DIAMOND_ORE', 'DIAMOND'],
    ['DEEPSLATE_DIAMOND_ORE', 'DIAMOND'],
    ['REDSTONE_ORE', 'REDSTONE_DUST'],
    ['DEEPSLATE_REDSTONE_ORE', 'REDSTONE_DUST'],
    ['LAPIS_ORE', 'LAPIS_LAZULI'],
    ['DEEPSLATE_LAPIS_ORE', 'LAPIS_LAZULI'],
    ['EMERALD_ORE', 'EMERALD'],
    ['DEEPSLATE_EMERALD_ORE', 'EMERALD'],
]);
export const getInventoryDropForBlock = (blockType) => Option.getOrElse(HashMap.get(INVENTORY_DROP_OVERRIDES, blockType), () => blockType);
export const PICKAXE_BLOCK_TYPES = HashSet.fromIterable([
    'WOODEN_PICKAXE',
    'STONE_PICKAXE',
    'IRON_PICKAXE',
    'DIAMOND_PICKAXE',
]);
//# sourceMappingURL=../../../dist/packages/terrain/application/block-service.config.js.map