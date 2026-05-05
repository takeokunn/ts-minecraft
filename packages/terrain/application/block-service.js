import { Effect, Data, HashSet, Metric, Option } from 'effect';
import { ChunkManagerService } from './chunk-manager-service';
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel';
import { FluidService } from './fluid-service';
import { ChunkService } from './chunk-service';
import { setBlockInChunk } from '../domain/chunk';
import { worldToBlockLocal, blockOverlapsPlayer, canHarvestBlock } from './block-utils';
export { worldToBlockLocal, blockOverlapsPlayer } from './block-utils';
import { PlayerService } from '@ts-minecraft/player';
import { InventoryService } from '@ts-minecraft/inventory';
import { HotbarService } from '@ts-minecraft/inventory';
import { FurnaceService } from '@ts-minecraft/furnace';
import { NON_PLACEABLE_ITEM_TYPES, PICKAXE_BLOCK_TYPES, DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, getInventoryDropForBlock, } from './block-service.config';
const REQUIRES_PICKAXE_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS;
// ─── Error type ───────────────────────────────────────────────────────────────
export class BlockServiceError extends Data.TaggedError('BlockServiceError') {
    get message() {
        const causeStr = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : '';
        return `BlockService error during ${this.operation}: ${this.reason}${causeStr ? `: ${causeStr}` : ''}`;
    }
}
// ─── Service ─────────────────────────────────────────────────────────────────
export class BlockService extends Effect.Service()('@minecraft/application/BlockService', {
    effect: Effect.all([
        ChunkManagerService,
        ChunkService,
        FluidService,
        PlayerService,
        InventoryService,
        HotbarService,
        FurnaceService,
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([chunkManagerService, chunkService, fluidService, playerService, inventoryService, hotbarService, furnaceService]) => ({
        breakBlock: (position) => Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToBlockLocal(position);
            const y = Math.floor(position.y);
            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(Effect.mapError((e) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
                cause: e,
            })));
            const blockType = yield* chunkService.getBlock(chunk, lx, y, lz).pipe(Effect.mapError((e) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`,
                cause: e,
            })));
            if (blockType === 'AIR') {
                return yield* Effect.fail(new BlockServiceError({
                    operation: 'breakBlock',
                    reason: `No block at position (${position.x}, ${position.y}, ${position.z})`,
                }));
            }
            const selectedTool = yield* hotbarService.getSelectedBlockType();
            const selectedToolValue = Option.getOrElse(selectedTool, () => 'AIR');
            const shouldDrop = HashSet.has(PICKAXE_BLOCK_TYPES, selectedToolValue)
                ? canHarvestBlock(blockType, selectedTool)
                : canHarvestBlock(blockType, Option.none());
            if (HashSet.has(REQUIRES_PICKAXE_BLOCKS, blockType) && !shouldDrop) {
                return yield* Effect.fail(new BlockServiceError({
                    operation: 'breakBlock',
                    reason: `Block requires a stronger pickaxe: ${blockType}`,
                }));
            }
            if (blockType === 'FURNACE') {
                const dismantled = yield* furnaceService.dismantleFurnace(position);
                if (!dismantled) {
                    return yield* Effect.fail(new BlockServiceError({
                        operation: 'breakBlock',
                        reason: 'Cannot break furnace while its contents cannot fit in inventory',
                    }));
                }
            }
            yield* setBlockInChunk(chunk, lx, y, lz, 'AIR').pipe(
            /* c8 ignore next 4 */
            Effect.mapError((e) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
            })));
            yield* chunkManagerService.markChunkDirty(chunkCoord);
            if (blockType === 'WATER')
                yield* fluidService.removeWater(position);
            yield* fluidService.notifyBlockChanged(position);
            yield* Metric.counter('blocks_broken').pipe(Metric.increment);
            if (shouldDrop) {
                yield* inventoryService.addBlock(getInventoryDropForBlock(blockType), 1).pipe(Effect.catchAllCause(() => Effect.void));
            }
        }),
        placeBlock: (position, blockType, preferredInventorySlot) => Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToBlockLocal(position);
            const y = Math.floor(position.y);
            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
                cause: e,
            })));
            const existing = yield* chunkService.getBlock(chunk, lx, y, lz).pipe(Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`,
                cause: e,
            })));
            if (existing !== 'AIR') {
                return yield* Effect.fail(new BlockServiceError({
                    operation: 'placeBlock',
                    reason: `Block already exists at position (${position.x}, ${position.y}, ${position.z})`,
                }));
            }
            if (HashSet.has(NON_PLACEABLE_ITEM_TYPES, blockType)) {
                return yield* Effect.fail(new BlockServiceError({
                    operation: 'placeBlock',
                    reason: `${blockType} is an inventory item and cannot be placed in the world`,
                }));
            }
            const playerPos = yield* playerService.getPosition(DEFAULT_PLAYER_ID).pipe(Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Player position error: ${e.message}`,
                cause: e,
            })));
            if (blockOverlapsPlayer(position, playerPos)) {
                return yield* Effect.fail(new BlockServiceError({
                    operation: 'placeBlock',
                    reason: 'Cannot place block inside player',
                }));
            }
            yield* setBlockInChunk(chunk, lx, y, lz, blockType).pipe(
            /* c8 ignore next 4 */
            Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
            })));
            yield* inventoryService.removeBlock(blockType, 1, preferredInventorySlot).pipe(Effect.catchTag('InventoryError', () => setBlockInChunk(chunk, lx, y, lz, 'AIR').pipe(
            /* c8 ignore next 4 */
            Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Failed to restore block after inventory rollback: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
            })), Effect.andThen(Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: `No ${blockType} available in inventory`,
            }))))));
            yield* chunkManagerService.markChunkDirty(chunkCoord);
            yield* fluidService.notifyBlockChanged(position);
            if (blockType === 'WATER')
                yield* fluidService.seedWater(position);
            yield* Metric.counter('blocks_placed').pipe(Metric.increment);
        }),
    }))),
}) {
}
export const BlockServiceLive = BlockService.Default;
//# sourceMappingURL=block-service.js.map