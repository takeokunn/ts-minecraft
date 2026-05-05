import { Schema } from 'effect';
export declare const CraftingStationSchema: Schema.Literal<["inventory", "crafting_table", "furnace"]>;
export type CraftingStation = Schema.Schema.Type<typeof CraftingStationSchema>;
declare const RecipeIngredient_base: Schema.Class<RecipeIngredient, {
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
export declare class RecipeIngredient extends RecipeIngredient_base {
}
declare const Recipe_base: Schema.Class<Recipe, {
    id: Schema.brand<typeof Schema.String, "RecipeId">;
    station: Schema.Literal<["inventory", "crafting_table", "furnace"]>;
    ingredients: Schema.filter<Schema.Array$<typeof RecipeIngredient>>;
    output: Schema.Struct<{
        itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
        count: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>;
}, Schema.Struct.Encoded<{
    id: Schema.brand<typeof Schema.String, "RecipeId">;
    station: Schema.Literal<["inventory", "crafting_table", "furnace"]>;
    ingredients: Schema.filter<Schema.Array$<typeof RecipeIngredient>>;
    output: Schema.Struct<{
        itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
        count: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>;
}>, never, {
    readonly output: {
        readonly itemType: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH" | "STICKS" | "COAL" | "WOODEN_SWORD" | "WOODEN_PICKAXE" | "STONE_PICKAXE" | "RAW_IRON" | "IRON_INGOT" | "IRON_PICKAXE" | "RAW_GOLD" | "GOLD_INGOT" | "DIAMOND" | "REDSTONE_DUST" | "LAPIS_LAZULI" | "EMERALD" | "DIAMOND_PICKAXE";
        readonly count: number;
    };
} & {
    readonly id: string & import("effect/Brand").Brand<"RecipeId">;
} & {
    readonly station: "inventory" | "crafting_table" | "furnace";
} & {
    readonly ingredients: readonly RecipeIngredient[];
}, {}, {}>;
export declare class Recipe extends Recipe_base {
}
export {};
//# sourceMappingURL=crafting.d.ts.map