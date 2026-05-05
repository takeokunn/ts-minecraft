import { Effect, HashMap, Option } from 'effect';
import { Recipe } from '../domain/crafting';
import type { InventoryItem } from '@ts-minecraft/kernel';
import { RecipeError } from '../domain/errors';
import type { InventoryService } from './inventory-service';
import { RecipeId } from '@ts-minecraft/kernel';
declare const RecipeService_base: Effect.Service.Class<RecipeService, "@minecraft/application/RecipeService", {
    readonly effect: Effect.Effect<{
        getAllRecipes: () => ReadonlyArray<Recipe>;
        findById: (id: RecipeId) => Option.Option<Recipe>;
        findCraftable: (available: HashMap.HashMap<InventoryItem, number>, hasCraftingTableAccess?: boolean, hasFurnaceAccess?: boolean) => ReadonlyArray<Recipe>;
        craft: (recipeId: RecipeId, inventoryService: InventoryService, hasCraftingTableAccess?: boolean, hasFurnaceAccess?: boolean) => Effect.Effect<void, RecipeError>;
    }, never, never>;
}>;
export declare class RecipeService extends RecipeService_base {
}
export declare const RecipeServiceLive: import("effect/Layer").Layer<RecipeService, never, never>;
export {};
//# sourceMappingURL=recipe-service.d.ts.map