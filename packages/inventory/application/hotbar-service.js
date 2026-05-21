import { Array as Arr, Effect, Option, Ref } from 'effect';
import { InventoryService, HOTBAR_SIZE, HOTBAR_START } from './inventory-service';
import { PlayerInputService } from '@ts-minecraft/player';
import { KeyMappings } from '@ts-minecraft/player';
import { SlotIndex } from '@ts-minecraft/kernel';
export { HOTBAR_SIZE };
export class HotbarService extends Effect.Service()('@minecraft/application/HotbarService', {
    effect: Effect.all([
        PlayerInputService,
        InventoryService,
        Ref.make(SlotIndex.make(0)),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([inputService, inventoryService, selectedSlotRef]) => {
        const hotbarKeys = [
            KeyMappings.HOTBAR_SLOT_1,
            KeyMappings.HOTBAR_SLOT_2,
            KeyMappings.HOTBAR_SLOT_3,
            KeyMappings.HOTBAR_SLOT_4,
            KeyMappings.HOTBAR_SLOT_5,
            KeyMappings.HOTBAR_SLOT_6,
            KeyMappings.HOTBAR_SLOT_7,
            KeyMappings.HOTBAR_SLOT_8,
            KeyMappings.HOTBAR_SLOT_9,
        ];
        return {
            getSelectedSlot: () => Ref.get(selectedSlotRef),
            setSelectedSlot: (slot) => Ref.set(selectedSlotRef, SlotIndex.make(Math.max(0, Math.min(HOTBAR_SIZE - 1, SlotIndex.toNumber(slot))))),
            getSelectedBlockType: () => Effect.gen(function* () {
                const slot = yield* Ref.get(selectedSlotRef);
                const inventorySlot = yield* inventoryService.getSlot(SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(slot)));
                return Option.map(inventorySlot, (stack) => stack.itemType);
            }),
            getSlots: () => Effect.gen(function* () {
                const hotbarSlots = yield* inventoryService.getHotbarSlots();
                return Arr.map(hotbarSlots, (slot) => Option.map(slot, (stack) => stack.itemType));
            }),
            update: () => Effect.gen(function* () {
                const keyFound = yield* Effect.reduce(Arr.map(hotbarKeys, (key, i) => [i, key]), false, (found, [i, key]) => found
                    ? Effect.succeed(true)
                    : inputService.consumeKeyPress(key).pipe(Effect.flatMap((pressed) => pressed
                        ? Ref.set(selectedSlotRef, SlotIndex.make(i)).pipe(Effect.as(true))
                        : Effect.succeed(false))));
                if (keyFound)
                    return;
                const wheelDelta = yield* inputService.consumeWheelDelta();
                if (wheelDelta !== 0) {
                    const direction = wheelDelta > 0 ? 1 : -1;
                    yield* Ref.update(selectedSlotRef, (cur) => SlotIndex.make((SlotIndex.toNumber(cur) + direction + HOTBAR_SIZE) % HOTBAR_SIZE));
                }
            }),
        };
    }))
}) {
}
export const HotbarServiceLive = HotbarService.Default;
//# sourceMappingURL=../../../dist/packages/inventory/application/hotbar-service.js.map