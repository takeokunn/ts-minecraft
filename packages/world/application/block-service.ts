import { Context, Effect } from "effect";
import { ChunkManagerService } from "./chunk-manager-service";
import { FluidService } from "./fluid-service";
import { ChunkService } from "./chunk-service";
import { PlayerService } from "@ts-minecraft/entity/application/player-service";
import { InventoryService } from "@ts-minecraft/inventory/application/inventory-service";
import { HotbarService } from "@ts-minecraft/inventory/application/hotbar-service";
import type { ChestService } from "@ts-minecraft/inventory/application/chest-service";
import type { FurnaceService } from "@ts-minecraft/inventory/application/furnace-service";
import { makeBreakBlock } from "./block-service-break";
import { makeForceSetBlock } from "./block-service-force-set";
import { makePlaceBlock } from "./block-service-place";

const FurnaceServiceTag = Context.GenericTag<FurnaceService>(
  "@minecraft/application/FurnaceService",
);
const ChestServiceTag = Context.GenericTag<ChestService>(
  "@minecraft/application/ChestService",
);

export { BlockServiceError } from "./block-service-error";

// ─── Service ─────────────────────────────────────────────────────────────────

export class BlockService extends Effect.Service<BlockService>()(
  "@minecraft/application/BlockService",
  {
    effect: Effect.gen(function* () {
      const chunkManagerService = yield* ChunkManagerService;
      const chunkService = yield* ChunkService;
      const fluidService = yield* FluidService;
      const playerService = yield* PlayerService;
      const inventoryService = yield* InventoryService;
      const hotbarService = yield* HotbarService;
      const furnaceService = yield* FurnaceServiceTag;
      const chestService = yield* ChestServiceTag;

      return {
        breakBlock: makeBreakBlock({
          chunkManagerService,
          chunkService,
          fluidService,
          hotbarService,
          inventoryService,
          containers: {
            dismantleFurnace: furnaceService.dismantleFurnace,
            dismantleChest: chestService.dismantleChest,
          },
        }),
        placeBlock: makePlaceBlock({
          chunkManagerService,
          chunkService,
          playerService,
          inventoryService,
          fluidService,
        }),
        forceSetBlock: makeForceSetBlock({
          chunkManagerService,
          chunkService,
        }),
      };
    }),
  },
) {}
