import { Schema } from 'effect';
import { BlockIdSchema, BlockId } from '@ts-minecraft/kernel';
export type { BlockType } from '@ts-minecraft/kernel';
export { BlockTypeSchema } from '@ts-minecraft/kernel';
export { BlockIdSchema };
export type { BlockId };
export declare const BlockPropertiesSchema: Schema.Struct<{
    hardness: Schema.filter<Schema.filter<typeof Schema.Number>>;
    transparency: typeof Schema.Boolean;
    solid: typeof Schema.Boolean;
    emissive: typeof Schema.Boolean;
    friction: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type BlockProperties = Schema.Schema.Type<typeof BlockPropertiesSchema>;
export declare const BlockFaceSchema: Schema.Struct<{
    top: typeof Schema.Boolean;
    bottom: typeof Schema.Boolean;
    north: typeof Schema.Boolean;
    south: typeof Schema.Boolean;
    east: typeof Schema.Boolean;
    west: typeof Schema.Boolean;
}>;
export type BlockFace = Schema.Schema.Type<typeof BlockFaceSchema>;
declare const Block_base: Schema.Class<Block, {
    id: Schema.brand<typeof Schema.String, "BlockId">;
    type: Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>;
    properties: Schema.Struct<{
        hardness: Schema.filter<Schema.filter<typeof Schema.Number>>;
        transparency: typeof Schema.Boolean;
        solid: typeof Schema.Boolean;
        emissive: typeof Schema.Boolean;
        friction: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>;
    faces: Schema.Struct<{
        top: typeof Schema.Boolean;
        bottom: typeof Schema.Boolean;
        north: typeof Schema.Boolean;
        south: typeof Schema.Boolean;
        east: typeof Schema.Boolean;
        west: typeof Schema.Boolean;
    }>;
}, Schema.Struct.Encoded<{
    id: Schema.brand<typeof Schema.String, "BlockId">;
    type: Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>;
    properties: Schema.Struct<{
        hardness: Schema.filter<Schema.filter<typeof Schema.Number>>;
        transparency: typeof Schema.Boolean;
        solid: typeof Schema.Boolean;
        emissive: typeof Schema.Boolean;
        friction: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>;
    faces: Schema.Struct<{
        top: typeof Schema.Boolean;
        bottom: typeof Schema.Boolean;
        north: typeof Schema.Boolean;
        south: typeof Schema.Boolean;
        east: typeof Schema.Boolean;
        west: typeof Schema.Boolean;
    }>;
}>, never, {
    readonly type: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH";
} & {
    readonly id: string & import("effect/Brand").Brand<"BlockId">;
} & {
    readonly properties: {
        readonly hardness: number;
        readonly transparency: boolean;
        readonly solid: boolean;
        readonly emissive: boolean;
        readonly friction: number;
    };
} & {
    readonly faces: {
        readonly top: boolean;
        readonly bottom: boolean;
        readonly north: boolean;
        readonly south: boolean;
        readonly east: boolean;
        readonly west: boolean;
    };
}, {}, {}>;
export declare class Block extends Block_base {
}
//# sourceMappingURL=block.d.ts.map