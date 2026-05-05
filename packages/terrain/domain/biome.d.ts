import { Schema } from 'effect';
export declare const BiomeTypeSchema: Schema.Literal<["PLAINS", "DESERT", "FOREST", "OCEAN", "MOUNTAINS", "SNOW", "SWAMP", "JUNGLE", "BEACH", "RIVER", "TAIGA", "SAVANNA"]>;
export type BiomeType = Schema.Schema.Type<typeof BiomeTypeSchema>;
export declare const BiomePropertiesSchema: Schema.Struct<{
    surfaceBlock: Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>;
    subSurfaceBlock: Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>;
    treeDensity: Schema.filter<Schema.filter<typeof Schema.Number>>;
    temperature: Schema.filter<Schema.filter<typeof Schema.Number>>;
    humidity: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type BiomeProperties = Schema.Schema.Type<typeof BiomePropertiesSchema>;
//# sourceMappingURL=biome.d.ts.map