import { HashSet } from 'effect';
export const WOODEN_PICKAXE_HARVESTABLE_BLOCKS = HashSet.fromIterable([
    'STONE',
    'COAL_ORE',
    'DEEPSLATE_COAL_ORE',
]);
export const STONE_PICKAXE_HARVESTABLE_BLOCKS = HashSet.union(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, HashSet.fromIterable([
    'IRON_ORE',
    'DEEPSLATE_IRON_ORE',
    'DEEPSLATE_LAPIS_ORE',
    'LAPIS_ORE',
]));
export const IRON_PICKAXE_HARVESTABLE_BLOCKS = HashSet.union(STONE_PICKAXE_HARVESTABLE_BLOCKS, HashSet.fromIterable([
    'GOLD_ORE',
    'REDSTONE_ORE',
    'DIAMOND_ORE',
    'EMERALD_ORE',
    'DEEPSLATE_GOLD_ORE',
    'DEEPSLATE_REDSTONE_ORE',
    'DEEPSLATE_DIAMOND_ORE',
    'DEEPSLATE_EMERALD_ORE',
]));
export const DIAMOND_PICKAXE_HARVESTABLE_BLOCKS = HashSet.union(IRON_PICKAXE_HARVESTABLE_BLOCKS, HashSet.fromIterable(['OBSIDIAN']));
//# sourceMappingURL=harvestable-blocks.js.map