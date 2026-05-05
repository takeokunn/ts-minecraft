import { Effect, Option } from 'effect';
import type { InventoryItem } from '@ts-minecraft/kernel';
import type { InventorySaveData } from '@ts-minecraft/kernel';
import { ItemStack } from '../domain/item-stack';
import { SlotIndex } from '@ts-minecraft/kernel';
import { InventoryError } from '../domain/errors';
export type InventorySlot = Option.Option<ItemStack>;
export type InventorySlots = ReadonlyArray<InventorySlot>;
export declare const INVENTORY_SIZE = 36;
export declare const HOTBAR_START = 27;
export declare const HOTBAR_SIZE = 9;
declare const InventoryService_base: Effect.Service.Class<InventoryService, "@minecraft/application/InventoryService", {
    readonly effect: Effect.Effect<{
        getSlot: (index: SlotIndex) => Effect.Effect<InventorySlot, never>;
        setSlot: (index: SlotIndex, stack: InventorySlot) => Effect.Effect<void, never>;
        moveStack: (from: SlotIndex, to: SlotIndex) => Effect.Effect<void, never>;
        addBlock: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryError>;
        removeBlock: (itemType: InventoryItem, count: number, preferredSlot?: SlotIndex) => Effect.Effect<void, InventoryError>;
        getHotbarSlots: () => Effect.Effect<ReadonlyArray<InventorySlot>, never>;
        getAllSlots: () => Effect.Effect<InventorySlots, never>;
        serialize: () => Effect.Effect<InventorySaveData, never>;
        clear: () => Effect.Effect<void, never>;
        deserialize: (data: InventorySaveData) => Effect.Effect<void, never>;
    }, never, never>;
}>;
export declare class InventoryService extends InventoryService_base {
}
export declare const InventoryServiceLive: import("effect/Layer").Layer<InventoryService, never, never>;
export {};
//# sourceMappingURL=inventory-service.d.ts.map