import { Effect, Option } from 'effect';
import type { InventoryItem } from '@ts-minecraft/kernel';
import { InventoryService, HOTBAR_SIZE } from './inventory-service';
import { PlayerInputService } from '@ts-minecraft/player';
import { SlotIndex } from '@ts-minecraft/kernel';
export { HOTBAR_SIZE };
declare const HotbarService_base: Effect.Service.Class<HotbarService, "@minecraft/application/HotbarService", {
    readonly effect: Effect.Effect<{
        getSelectedSlot: () => Effect.Effect<SlotIndex, never>;
        setSelectedSlot: (slot: SlotIndex) => Effect.Effect<void, never>;
        getSelectedBlockType: () => Effect.Effect<Option.Option<InventoryItem>, never>;
        getSlots: () => Effect.Effect<ReadonlyArray<Option.Option<InventoryItem>>, never>;
        update: () => Effect.Effect<void, never>;
    }, never, PlayerInputService | InventoryService>;
}>;
export declare class HotbarService extends HotbarService_base {
}
export declare const HotbarServiceLive: import("effect/Layer").Layer<HotbarService, never, PlayerInputService | InventoryService>;
//# sourceMappingURL=hotbar-service.d.ts.map