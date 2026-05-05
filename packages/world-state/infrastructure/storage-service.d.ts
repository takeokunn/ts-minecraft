import { Brand, Effect, Option, Schema } from 'effect';
import { WorldId } from '@ts-minecraft/kernel';
import { StorageError } from '../domain/errors';
import type { ChunkCoord } from '@ts-minecraft/kernel';
export declare const WORLD_SCHEMA_VERSION = 3;
export type ChunkStorageValue = Readonly<{
    readonly blocks: Uint8Array<ArrayBufferLike>;
    readonly fluid: Uint8Array<ArrayBufferLike> | undefined;
}>;
export declare const CURRENT_WORLD_SAVE_VERSION = 1;
export type { ChunkCoord };
export declare const WorldMetadataSchema: Schema.Struct<{
    seed: Schema.filter<Schema.filter<typeof Schema.Number>>;
    createdAt: typeof Schema.DateFromSelf;
    lastPlayed: typeof Schema.DateFromSelf;
    playerSpawn: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<Schema.filter<typeof Schema.Number>>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    playerState: Schema.optional<Schema.Struct<{
        position: Schema.Struct<{
            x: Schema.filter<typeof Schema.Number>;
            y: Schema.filter<typeof Schema.Number>;
            z: Schema.filter<typeof Schema.Number>;
        }>;
        health: Schema.filter<Schema.filter<typeof Schema.Number>>;
        inventory: Schema.Struct<{
            slots: Schema.Array$<Schema.OptionFromNullOr<Schema.Struct<{
                slot: Schema.brand<Schema.filter<Schema.filter<typeof Schema.Number>>, "SlotIndex">;
                itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
                count: Schema.filter<Schema.filter<typeof Schema.Number>>;
            }>>>;
        }>;
        timeOfDay: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>>;
    furnaceStates: Schema.optional<Schema.Array$<Schema.Struct<{
        position: Schema.Struct<{
            x: Schema.filter<typeof Schema.Number>;
            y: Schema.filter<typeof Schema.Number>;
            z: Schema.filter<typeof Schema.Number>;
        }>;
        input: Schema.OptionFromNullOr<Schema.Struct<{
            itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
            count: Schema.filter<Schema.filter<typeof Schema.Number>>;
        }>>;
        fuel: Schema.OptionFromNullOr<Schema.Struct<{
            itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
            count: Schema.filter<Schema.filter<typeof Schema.Number>>;
        }>>;
        output: Schema.OptionFromNullOr<Schema.Struct<{
            itemType: Schema.Union<[Schema.Literal<["AIR", "DIRT", "STONE", "WOOD", "GRASS", "SAND", "WATER", "LEAVES", "GLASS", "SNOW", "GRAVEL", "COBBLESTONE", "GRANITE", "DIORITE", "ANDESITE", "DEEPSLATE", "BEDROCK", "LAVA", "OBSIDIAN", "COAL_ORE", "IRON_ORE", "GOLD_ORE", "DIAMOND_ORE", "REDSTONE_ORE", "LAPIS_ORE", "EMERALD_ORE", "DEEPSLATE_COAL_ORE", "DEEPSLATE_IRON_ORE", "DEEPSLATE_GOLD_ORE", "DEEPSLATE_DIAMOND_ORE", "DEEPSLATE_REDSTONE_ORE", "DEEPSLATE_LAPIS_ORE", "DEEPSLATE_EMERALD_ORE", "COAL_BLOCK", "IRON_BLOCK", "GOLD_BLOCK", "DIAMOND_BLOCK", "REDSTONE_BLOCK", "LAPIS_BLOCK", "EMERALD_BLOCK", "PLANKS", "CRAFTING_TABLE", "FURNACE", "TORCH"]>, Schema.Literal<["STICKS", "COAL", "WOODEN_SWORD", "WOODEN_PICKAXE", "STONE_PICKAXE", "RAW_IRON", "IRON_INGOT", "IRON_PICKAXE", "RAW_GOLD", "GOLD_INGOT", "DIAMOND", "REDSTONE_DUST", "LAPIS_LAZULI", "EMERALD", "DIAMOND_PICKAXE"]>]>;
            count: Schema.filter<Schema.filter<typeof Schema.Number>>;
        }>>;
        activeRecipeId: Schema.OptionFromNullOr<Schema.brand<typeof Schema.String, "RecipeId">>;
        progressSecs: Schema.filter<Schema.filter<typeof Schema.Number>>;
    }>>>;
    gameMode: Schema.optionalWith<Schema.Literal<["survival", "creative"]>, {
        default: () => "survival";
    }>;
    saveVersion: Schema.optionalWith<Schema.filter<Schema.filter<typeof Schema.Number>>, {
        default: () => number;
    }>;
}>;
export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadataSchema>;
export type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>;
export declare const ChunkStorageKey: Brand.Brand.Constructor<ChunkStorageKey>;
declare const StorageService_base: Effect.Service.Class<StorageService, "@minecraft/infrastructure/storage/StorageService", {
    readonly effect: Effect.Effect<{
        initialize: Effect.Effect<void, StorageError, never>;
        saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: ChunkStorageValue) => Effect.Effect<void, StorageError, never>;
        loadChunk: (worldId: WorldId, chunkCoord: ChunkCoord) => Effect.Effect<Option.Option<Readonly<{
            readonly blocks: Uint8Array<ArrayBufferLike>;
            readonly fluid: Uint8Array<ArrayBufferLike> | undefined;
        }>>, StorageError, never>;
        saveWorldMetadata: (worldId: WorldId, metadata: WorldMetadata) => Effect.Effect<void, StorageError, never>;
        loadWorldMetadata: (worldId: WorldId) => Effect.Effect<Option.Option<{
            readonly seed: number;
            readonly createdAt: Date;
            readonly lastPlayed: Date;
            readonly playerSpawn: {
                readonly x: number;
                readonly y: number;
                readonly z: number;
            };
            readonly playerState?: {
                readonly position: {
                    readonly x: number;
                    readonly y: number;
                    readonly z: number;
                };
                readonly health: number;
                readonly inventory: {
                    readonly slots: readonly Option.Option<{
                        readonly slot: number & Brand.Brand<"SlotIndex">;
                        readonly itemType: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH" | "STICKS" | "COAL" | "WOODEN_SWORD" | "WOODEN_PICKAXE" | "STONE_PICKAXE" | "RAW_IRON" | "IRON_INGOT" | "IRON_PICKAXE" | "RAW_GOLD" | "GOLD_INGOT" | "DIAMOND" | "REDSTONE_DUST" | "LAPIS_LAZULI" | "EMERALD" | "DIAMOND_PICKAXE";
                        readonly count: number;
                    }>[];
                };
                readonly timeOfDay: number;
            } | undefined;
            readonly furnaceStates?: readonly {
                readonly position: {
                    readonly x: number;
                    readonly y: number;
                    readonly z: number;
                };
                readonly input: Option.Option<{
                    readonly itemType: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH" | "STICKS" | "COAL" | "WOODEN_SWORD" | "WOODEN_PICKAXE" | "STONE_PICKAXE" | "RAW_IRON" | "IRON_INGOT" | "IRON_PICKAXE" | "RAW_GOLD" | "GOLD_INGOT" | "DIAMOND" | "REDSTONE_DUST" | "LAPIS_LAZULI" | "EMERALD" | "DIAMOND_PICKAXE";
                    readonly count: number;
                }>;
                readonly output: Option.Option<{
                    readonly itemType: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH" | "STICKS" | "COAL" | "WOODEN_SWORD" | "WOODEN_PICKAXE" | "STONE_PICKAXE" | "RAW_IRON" | "IRON_INGOT" | "IRON_PICKAXE" | "RAW_GOLD" | "GOLD_INGOT" | "DIAMOND" | "REDSTONE_DUST" | "LAPIS_LAZULI" | "EMERALD" | "DIAMOND_PICKAXE";
                    readonly count: number;
                }>;
                readonly fuel: Option.Option<{
                    readonly itemType: "AIR" | "DIRT" | "STONE" | "WOOD" | "GRASS" | "SAND" | "WATER" | "LEAVES" | "GLASS" | "SNOW" | "GRAVEL" | "COBBLESTONE" | "GRANITE" | "DIORITE" | "ANDESITE" | "DEEPSLATE" | "BEDROCK" | "LAVA" | "OBSIDIAN" | "COAL_ORE" | "IRON_ORE" | "GOLD_ORE" | "DIAMOND_ORE" | "REDSTONE_ORE" | "LAPIS_ORE" | "EMERALD_ORE" | "DEEPSLATE_COAL_ORE" | "DEEPSLATE_IRON_ORE" | "DEEPSLATE_GOLD_ORE" | "DEEPSLATE_DIAMOND_ORE" | "DEEPSLATE_REDSTONE_ORE" | "DEEPSLATE_LAPIS_ORE" | "DEEPSLATE_EMERALD_ORE" | "COAL_BLOCK" | "IRON_BLOCK" | "GOLD_BLOCK" | "DIAMOND_BLOCK" | "REDSTONE_BLOCK" | "LAPIS_BLOCK" | "EMERALD_BLOCK" | "PLANKS" | "CRAFTING_TABLE" | "FURNACE" | "TORCH" | "STICKS" | "COAL" | "WOODEN_SWORD" | "WOODEN_PICKAXE" | "STONE_PICKAXE" | "RAW_IRON" | "IRON_INGOT" | "IRON_PICKAXE" | "RAW_GOLD" | "GOLD_INGOT" | "DIAMOND" | "REDSTONE_DUST" | "LAPIS_LAZULI" | "EMERALD" | "DIAMOND_PICKAXE";
                    readonly count: number;
                }>;
                readonly activeRecipeId: Option.Option<string & Brand.Brand<"RecipeId">>;
                readonly progressSecs: number;
            }[] | undefined;
            readonly gameMode: "survival" | "creative";
            readonly saveVersion: number;
        }>, StorageError, never>;
        listWorldMetadata: Effect.Effect<{
            readonly valid: ReadonlyArray<{
                readonly worldId: WorldId;
                readonly metadata: WorldMetadata;
            }>;
            readonly corrupt: ReadonlyArray<WorldId>;
        }, StorageError, never>;
        deleteWorld: (worldId: WorldId) => Effect.Effect<void, StorageError, never>;
    }, never, never>;
}>;
export declare class StorageService extends StorageService_base {
}
export declare const StorageServiceLive: import("effect/Layer").Layer<StorageService, never, never>;
//# sourceMappingURL=storage-service.d.ts.map