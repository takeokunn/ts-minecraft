import { Array as Arr, Effect, Either, Option, Ref } from 'effect';
import { InventoryService, HOTBAR_START } from '@ts-minecraft/inventory';
import { HotbarService } from '@ts-minecraft/inventory';
import { RecipeService } from '@ts-minecraft/inventory';
import { FurnaceService } from '@ts-minecraft/furnace';
import { GameStateService } from '@ts-minecraft/game';
import { ChunkManagerService } from '@ts-minecraft/terrain';
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel';
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair';
import { SlotIndex } from '@ts-minecraft/kernel';
import { blockTypeToIndex } from '@ts-minecraft/kernel';
import { scanNearbyBlock } from '@ts-minecraft/app/main/qa-spatial';
import { buildOverlayDom } from './inventory-renderer-dom';
import { collectAvailableCounts } from './inventory-renderer-helpers';
import { renderSlotElements, renderCraftingList, renderStatusEl } from './inventory-renderer-refresh';
import { buildHandleDelegatedClick } from './inventory-renderer-click-handler';
export class InventoryRendererService extends Effect.Service()('@minecraft/presentation/InventoryRenderer', {
    scoped: Effect.all([
        InventoryService,
        HotbarService,
        RecipeService,
        FurnaceService,
        GameStateService,
        ChunkManagerService,
        DomOperationsService,
        Ref.make(false),
        Ref.make([]),
        Ref.make(0),
        Ref.make('Click a recipe to craft it.'),
    ], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([inventoryService, hotbarService, recipeService, furnaceService, gameState, chunkManagerService, dom, isVisibleRef, availableRecipesRef, selectedRecipeIndexRef, statusMessageRef]) => {
        const getChunkOrNone = (coord) => chunkManagerService.getChunk(coord).pipe(Effect.option);
        const getPlayerPos = () => gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAllCause(() => Effect.succeed({ x: 0, y: 0, z: 0 })));
        const hasNearbyCraftingTable = () => getPlayerPos().pipe(Effect.flatMap((pos) => scanNearbyBlock(pos, 5, blockTypeToIndex('CRAFTING_TABLE'), getChunkOrNone)));
        const hasNearbyFurnace = () => getPlayerPos().pipe(Effect.flatMap((pos) => scanNearbyBlock(pos, 5, blockTypeToIndex('FURNACE'), getChunkOrNone)));
        const refreshCraftingState = (slots) => Effect.gen(function* () {
            const hasTableAccess = yield* hasNearbyCraftingTable();
            const hasFurnaceAccess = yield* hasNearbyFurnace();
            const craftable = recipeService.findCraftable(collectAvailableCounts(slots), hasTableAccess, hasFurnaceAccess);
            const nextSelectedIndex = yield* Ref.modify(selectedRecipeIndexRef, (current) => {
                if (craftable.length === 0)
                    return [0, 0];
                const clamped = Math.max(0, Math.min(current, craftable.length - 1));
                return [clamped, clamped];
            });
            yield* Ref.set(availableRecipesRef, craftable);
            return [craftable, nextSelectedIndex];
        });
        const performRecipe = (recipeId, hasTableAccess, hasFurnaceAccess) => {
            const recipe = recipeService.findById(recipeId);
            return Option.match(recipe, {
                onNone: () => recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess),
                onSome: (resolvedRecipe) => resolvedRecipe.station === 'furnace'
                    ? furnaceService.getNearestFurnaceState().pipe(Effect.flatMap((furnaceOpt) => Option.match(furnaceOpt, {
                        onNone: () => furnaceService.startSmelting(recipeId),
                        onSome: (furnace) => Option.match(furnace.output, {
                            onSome: () => furnaceService.collectOutput().pipe(Effect.asVoid),
                            onNone: () => furnaceService.startSmelting(recipeId),
                        }),
                    })))
                    : recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess),
            });
        };
        return Effect.sync(() => buildOverlayDom(dom)).pipe(Effect.flatMap(({ overlayEl, slotEls, craftingListEl, statusEl }) => {
            /* c8 ignore next */
            const handleDelegatedClick = buildHandleDelegatedClick({
                hasNearbyCraftingTable,
                hasNearbyFurnace,
                performRecipe,
                hotbarService,
                inventoryService,
                statusMessageRef,
                refreshSlots: () => refreshSlots(),
            });
            const refreshSlots = () => Effect.gen(function* () {
                const allSlots = yield* inventoryService.getAllSlots();
                const selectedSlot = yield* hotbarService.getSelectedSlot();
                const [craftableRecipes, selectedRecipeIndex] = yield* refreshCraftingState(allSlots);
                const statusMessage = yield* Ref.get(statusMessageRef);
                /* c8 ignore start */
                yield* Effect.sync(() => {
                    const selectedHotbarIdx = HOTBAR_START + SlotIndex.toNumber(selectedSlot);
                    renderSlotElements(slotEls, allSlots, selectedHotbarIdx);
                    renderCraftingList(dom, craftingListEl, craftableRecipes, selectedRecipeIndex);
                    renderStatusEl(statusEl, statusMessage);
                });
                /* c8 ignore stop */
            });
            return Effect.acquireRelease(Effect.sync(() => {
                Option.map(overlayEl, (el) => el.addEventListener('click', handleDelegatedClick));
            }), () => Effect.sync(() => {
                Option.map(overlayEl, (el) => { el.removeEventListener('click', handleDelegatedClick); el.remove(); });
            })).pipe(Effect.as({
                toggle: () => Effect.gen(function* () {
                    const next = yield* Ref.modify(isVisibleRef, (current) => [!current, !current]);
                    yield* Effect.sync(() => Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none'; }));
                    if (next)
                        yield* refreshSlots();
                    return next;
                }),
                isOpen: () => Ref.get(isVisibleRef),
                update: () => Effect.gen(function* () {
                    const isVisible = yield* Ref.get(isVisibleRef);
                    if (isVisible)
                        yield* refreshSlots();
                }),
                cycleRecipes: (delta) => Effect.gen(function* () {
                    const recipes = yield* Ref.get(availableRecipesRef);
                    if (recipes.length === 0)
                        return;
                    yield* Ref.update(selectedRecipeIndexRef, (current) => {
                        const next = (current + delta) % recipes.length;
                        return next < 0 ? next + recipes.length : next;
                    });
                    yield* refreshSlots();
                }),
                craftSelectedRecipe: () => Effect.gen(function* () {
                    const recipes = yield* Ref.get(availableRecipesRef);
                    const selectedRecipeIndex = yield* Ref.get(selectedRecipeIndexRef);
                    const recipe = Option.getOrElse(Arr.get(recipes, selectedRecipeIndex), () => null);
                    if (recipe === null) {
                        yield* Ref.set(statusMessageRef, 'No craftable recipe selected.');
                        yield* refreshSlots();
                        return false;
                    }
                    const hasTableAccess = yield* hasNearbyCraftingTable();
                    const hasFurnaceAccess = yield* hasNearbyFurnace();
                    const result = yield* performRecipe(recipe.id, hasTableAccess, hasFurnaceAccess).pipe(Effect.either);
                    const crafted = Either.isRight(result);
                    yield* Ref.set(statusMessageRef, crafted
                        ? `Crafted ${recipe.output.count} ${recipe.output.itemType}.`
                        : 'Crafting failed.');
                    yield* refreshSlots();
                    return crafted;
                }),
            }));
        }));
    })),
}) {
}
export const InventoryRendererLive = InventoryRendererService.Default;
//# sourceMappingURL=../../../../dist/packages/app/presentation/inventory/inventory-renderer.js.map