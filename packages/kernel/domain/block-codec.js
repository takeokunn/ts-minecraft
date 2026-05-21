import { Array as Arr, Option } from 'effect';
// Single source of truth for storage indices. Array position = storage index (0=AIR, 1=DIRT, …).
export const INDEX_TO_BLOCK_TYPE = [
    'AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE',
    'GRANITE', 'DIORITE', 'ANDESITE', 'DEEPSLATE', 'BEDROCK', 'LAVA', 'OBSIDIAN',
    'COAL_ORE', 'IRON_ORE', 'GOLD_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE', 'EMERALD_ORE',
    'DEEPSLATE_COAL_ORE', 'DEEPSLATE_IRON_ORE', 'DEEPSLATE_GOLD_ORE', 'DEEPSLATE_DIAMOND_ORE',
    'DEEPSLATE_REDSTONE_ORE', 'DEEPSLATE_LAPIS_ORE', 'DEEPSLATE_EMERALD_ORE',
    'COAL_BLOCK', 'IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'REDSTONE_BLOCK', 'LAPIS_BLOCK', 'EMERALD_BLOCK',
    'PLANKS', 'CRAFTING_TABLE', 'FURNACE', 'TORCH',
];
// Reverse lookup: BlockType → storage index. Derived from INDEX_TO_BLOCK_TYPE.
export const BLOCK_TYPE_TO_INDEX = Object.fromEntries(INDEX_TO_BLOCK_TYPE.map((type, idx) => [type, idx]));
export const blockTypeToIndex = (blockType) => BLOCK_TYPE_TO_INDEX[blockType];
export const indexToBlockType = (index) => Option.getOrElse(Arr.get(INDEX_TO_BLOCK_TYPE, index), () => 'AIR');
//# sourceMappingURL=../../../dist/packages/kernel/domain/block-codec.js.map