import { Effect, HashMap, Option } from 'effect';
import { RecipeService, InventoryService } from '@ts-minecraft/inventory';
import { PlayerService } from '@ts-minecraft/player';
import { ChunkManagerService } from '@ts-minecraft/terrain';
import type { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel';
import { FurnaceError } from '../domain/errors';
import type { FurnaceBlockState, FurnaceItemStack } from '../domain/furnace-state';
type FurnaceState = {
    readonly furnaces: HashMap.HashMap<string, FurnaceBlockState>;
    readonly selectedFurnacePosition: Option.Option<{
        readonly x: number;
        readonly y: number;
        readonly z: number;
    }>;
};
declare const FurnaceService_base: Effect.Service.Class<FurnaceService, "@minecraft/application/FurnaceService", {
    readonly effect: Effect.Effect<{
        getState: () => Effect.Effect<FurnaceState, never>;
        getNearestFurnaceState: () => Effect.Effect<Option.Option<FurnaceBlockState>, never>;
        hasNearbyFurnace: () => Effect.Effect<boolean, never>;
        setSelectedFurnace: (position: {
            readonly x: number;
            readonly y: number;
            readonly z: number;
        }) => Effect.Effect<void, never>;
        startSmelting: (recipeId: RecipeId) => Effect.Effect<void, FurnaceError>;
        collectOutput: () => Effect.Effect<boolean, FurnaceError>;
        clearFurnace: (position: {
            readonly x: number;
            readonly y: number;
            readonly z: number;
        }) => Effect.Effect<ReadonlyArray<FurnaceItemStack>, never>;
        dismantleFurnace: (position: {
            readonly x: number;
            readonly y: number;
            readonly z: number;
        }) => Effect.Effect<boolean, never>;
        serialize: () => Effect.Effect<ReadonlyArray<FurnaceBlockState>, never>;
        deserialize: (serialized: ReadonlyArray<FurnaceBlockState>) => Effect.Effect<void, never>;
        tick: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>;
    }, never, PlayerService | ChunkManagerService | InventoryService | RecipeService>;
}>;
export declare class FurnaceService extends FurnaceService_base {
}
export declare const FurnaceServiceLive: import("effect/Layer").Layer<FurnaceService, never, PlayerService | ChunkManagerService | InventoryService | RecipeService>;
export {};
//# sourceMappingURL=furnace-service.d.ts.map