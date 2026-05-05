import { Schema } from 'effect';
declare const InventorySlotSaveEntrySchema: Schema.Struct<{
    slot: Schema.brand<Schema.filter<Schema.filter<typeof Schema.Number>>, "SlotIndex">;
    itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
    count: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type InventorySlotSaveEntry = Schema.Schema.Type<typeof InventorySlotSaveEntrySchema>;
export declare const InventorySaveDataSchema: Schema.Struct<{
    slots: Schema.Array$<Schema.OptionFromNullOr<Schema.Struct<{
        slot: Schema.brand<Schema.filter<Schema.filter<typeof Schema.Number>>, "SlotIndex">;
        itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
        count: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>>>;
}>;
export type InventorySaveData = Schema.Schema.Type<typeof InventorySaveDataSchema>;
export {};
//# sourceMappingURL=inventory-save-data.d.ts.map