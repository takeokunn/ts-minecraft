import { Option, Schema } from 'effect';
import { InventoryItem } from '@ts-minecraft/kernel';
declare const ItemStack_base: Schema.Class<ItemStack, {
    itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
    count: Schema.filter<Schema.filter<typeof Schema.Number>>;
}, Schema.Struct.Encoded<{
    itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
    count: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>, never, {
    readonly itemType: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH" | "STICKS" | "COAL" | "WOODEN_SWORD" | "WOODEN_PICKAXE" | "STONE_PICKAXE" | "RAW_IRON" | "IRON_INGOT" | "IRON_PICKAXE" | "RAW_GOLD" | "GOLD_INGOT" | "DIAMOND" | "REDSTONE_DUST" | "LAPIS_LAZULI" | "EMERALD" | "DIAMOND_PICKAXE";
} & {
    readonly count: number;
}, {}, {}>;
export declare class ItemStack extends ItemStack_base {
}
export declare const MAX_STACK_SIZE = 64;
export declare const maxStackFor: (itemType: InventoryItem) => number;
export declare const createStack: (itemType: InventoryItem, count?: number) => ItemStack;
export declare const addToStack: (stack: ItemStack, n: number) => ItemStack;
export declare const removeFromStack: (stack: ItemStack, n: number) => Option.Option<ItemStack>;
export declare const canMerge: (a: ItemStack, b: ItemStack) => boolean;
export declare const mergeStacks: (a: ItemStack, b: ItemStack) => readonly [ItemStack, Option.Option<ItemStack>];
export {};
//# sourceMappingURL=item-stack.d.ts.map