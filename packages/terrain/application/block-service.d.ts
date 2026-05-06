import { Effect } from 'effect';
import { ChunkManagerService } from './chunk-manager-service';
import { FluidService } from './fluid-service';
import { ChunkService } from './chunk-service';
export { worldToBlockLocal, blockOverlapsPlayer } from './block-utils';
import { PlayerService } from '@ts-minecraft/player';
import { InventoryService } from '@ts-minecraft/inventory';
import { HotbarService } from '@ts-minecraft/inventory';
import { FurnaceService } from '@ts-minecraft/furnace';
import { InventoryItem } from '@ts-minecraft/kernel';
import { Position, SlotIndex } from '@ts-minecraft/kernel';
declare const BlockServiceError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "BlockServiceError";
} & Readonly<A>;
export declare class BlockServiceError extends BlockServiceError_base<{
    readonly operation: string;
    readonly reason: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
declare const BlockService_base: Effect.Service.Class<BlockService, "@minecraft/application/BlockService", {
    readonly effect: Effect.Effect<{
        breakBlock: (position: Position) => Effect.Effect<void, BlockServiceError>;
        placeBlock: (position: Position, itemType: InventoryItem, preferredInventorySlot?: SlotIndex) => Effect.Effect<void, BlockServiceError>;
    }, never, PlayerService | ChunkService | ChunkManagerService | InventoryService | HotbarService | FurnaceService | FluidService>;
}>;
export declare class BlockService extends BlockService_base {
}
export declare const BlockServiceLive: import("effect/Layer").Layer<BlockService, never, PlayerService | ChunkService | ChunkManagerService | InventoryService | HotbarService | FurnaceService | FluidService>;
//# sourceMappingURL=block-service.d.ts.map
