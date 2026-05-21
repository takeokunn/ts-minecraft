import { Cause, Effect, Option, Ref } from 'effect';
import { INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory';
import { RecipeId, SlotIndex } from '@ts-minecraft/kernel';
/* c8 ignore next */
export const buildHandleDelegatedClick = (deps) => (event) => {
    const { hasNearbyCraftingTable, hasNearbyFurnace, performRecipe, hotbarService, inventoryService, statusMessageRef, refreshSlots, } = deps;
    const htmlTarget = event.target instanceof HTMLElement ? event.target : null;
    const recipeTarget = Option.fromNullable(htmlTarget?.closest('[data-recipe-id]')).pipe(Option.filter((target) => target instanceof HTMLElement));
    Option.match(recipeTarget, {
        onSome: (target) => {
            const recipeId = target.dataset['recipeId'];
            if (!recipeId)
                return;
            Effect.runFork(Effect.all([hasNearbyCraftingTable(), hasNearbyFurnace()], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([hasTableAccess, hasFurnaceAccess]) => performRecipe(RecipeId.make(recipeId), hasTableAccess, hasFurnaceAccess)), Effect.andThen(Ref.set(statusMessageRef, 'Crafted successfully.')), Effect.catchAll((error) => Ref.set(statusMessageRef, error instanceof Error ? error.message : 'Crafting failed.')), Effect.andThen(refreshSlots()), Effect.catchAllCause((cause) => Effect.logError(`Crafting click error: ${Cause.pretty(cause)}`))));
        },
        onNone: () => {
            const slotTarget = Option.fromNullable(htmlTarget?.closest('[data-slot]')).pipe(Option.filter((target) => target instanceof HTMLElement));
            Option.map(slotTarget, (target) => {
                const index = parseInt(Option.getOrElse(Option.fromNullable(target.dataset['slot']), () => '-1'), 10);
                if (index < 0 || index >= INVENTORY_SIZE)
                    return;
                Effect.runFork(Effect.gen(function* () {
                    const selectedSlot = yield* hotbarService.getSelectedSlot();
                    const hotbarInventoryIndex = HOTBAR_START + SlotIndex.toNumber(selectedSlot);
                    yield* inventoryService.moveStack(SlotIndex.make(index), SlotIndex.make(hotbarInventoryIndex));
                }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Inventory click error: ${Cause.pretty(cause)}`))));
            });
        },
    });
};
//# sourceMappingURL=../../../../dist/packages/app/presentation/inventory/inventory-renderer-click-handler.js.map