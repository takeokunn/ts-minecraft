import { Effect, Either, HashSet, Schema } from "effect";
import {
  BlockIndexError,
  BlockTypeSchema,
  type BlockType,
  type InventoryItem,
  type PlayerId,
  type Position,
  type SlotIndex,
} from "@ts-minecraft/core";
import type { ChunkCoord } from "@ts-minecraft/core";
import { InventoryServicePortError } from "../domain/block-service-ports";
import type { Chunk } from "../domain/chunk";
import { NON_PLACEABLE_ITEM_TYPES } from "./block-service.config";
import { BlockServiceError } from "./block-service-error";

export type ChunkManagerForPlace = {
  readonly getChunk: (
    coord: ChunkCoord,
  ) => Effect.Effect<Chunk, { readonly message: string }>;
  readonly markChunkDirty: (
    coord: ChunkCoord,
    dirtyVoxels?: ReadonlyArray<import("../domain/placed-block").DirtyVoxel>,
  ) => Effect.Effect<void, never>;
};

export type ChunkServiceForPlace = {
  readonly getBlock: (
    chunk: Chunk,
    lx: number,
    y: number,
    lz: number,
  ) => Effect.Effect<BlockType, { readonly message: string }>;
};

export type PlayerServiceForPlace = {
  readonly getPosition: (
    playerId: PlayerId,
  ) => Effect.Effect<Position, { readonly message: string }>;
};

export type InventoryServiceForPlace = {
  readonly removeBlock: (
    itemType: InventoryItem,
    count: number,
    preferredInventorySlot?: SlotIndex,
  ) => Effect.Effect<void, InventoryServicePortError>;
};

export type FluidServiceForPlace = {
  readonly notifyBlockChanged: (
    position: Position,
  ) => Effect.Effect<void, never>;
  readonly seedWater: (position: Position) => Effect.Effect<void, never>;
  readonly seedLava: (position: Position) => Effect.Effect<void, never>;
};

export type PlaceBlockDeps = {
  readonly chunkManagerService: ChunkManagerForPlace;
  readonly chunkService: ChunkServiceForPlace;
  readonly playerService: PlayerServiceForPlace;
  readonly inventoryService: InventoryServiceForPlace;
  readonly fluidService: FluidServiceForPlace;
};

export type PlacementContext = {
  readonly chunkService: ChunkServiceForPlace;
  readonly chunk: Chunk;
  readonly position: Position;
  readonly lx: number;
  readonly y: number;
  readonly lz: number;
  readonly blockType: BlockType;
  readonly operation: string;
};

export const mapChunkLoadError =
  (chunkCoord: ChunkCoord, operation: string) =>
  (e: { readonly message: string }) =>
    new BlockServiceError({
      operation,
      reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
      cause: e,
    });

export const mapBlockReadError =
  (operation: string, reason: string) => (e: { readonly message: string }) =>
    new BlockServiceError({
      operation,
      reason: `${reason}: ${e.message}`,
      cause: e,
    });

export const mapIndexError =
  (operation: string, reason: string) => (e: BlockIndexError) =>
    new BlockServiceError({
      operation,
      reason: `${reason}: (${e.x}, ${e.y}, ${e.z})`,
      cause: e,
    });

export const validateBlockType = (
  itemType: InventoryItem,
  operation: string,
): Effect.Effect<BlockType, BlockServiceError> => {
  if (HashSet.has(NON_PLACEABLE_ITEM_TYPES, itemType)) {
    return Effect.fail(
      new BlockServiceError({
        operation,
        reason: `${itemType} is an inventory item and cannot be placed in the world`,
      }),
    );
  }

  const decodedBlockType =
    Schema.decodeUnknownEither(BlockTypeSchema)(itemType);
  if (Either.isLeft(decodedBlockType)) {
    return Effect.fail(
      new BlockServiceError({
        operation,
        reason: `${itemType} cannot be placed in the world`,
      }),
    );
  }

  return Effect.succeed(decodedBlockType.right);
};
