import { HashMap, HashSet, Option } from "effect";
import type { Chunk } from "../domain/chunk";
import {
  FLUID_TICK_BUDGET,
  chunkCoordsForPosition,
  parseKey,
} from "@ts-minecraft/block";
import type {
  FluidCell,
  FluidKey,
  FluidState,
} from "@ts-minecraft/block";
import { ChunkCacheKey } from "@ts-minecraft/core";
import type { LoadedChunkCache } from "./fluid-service-helpers";
import { cacheFromChunks } from "./fluid-service-helpers";
import { hydrateChunk } from "./fluid-state-ops";
import type { WorkItem } from "./fluid-tick-budget";

export type SyncLoadedChunksPlan = Readonly<{
  readonly nextState: FluidState;
  readonly nextCache: LoadedChunkCache;
}>;

const pruneDepartedChunks = (
  state: FluidState,
  departed: HashSet.HashSet<ChunkCacheKey>,
): FluidState => {
  if (HashSet.size(departed) === 0) return state;

  let nextCells = HashMap.empty<FluidKey, FluidCell>();
  for (const [key, cell] of state.cells) {
    const chunkKey = ChunkCacheKey.make(chunkCoordsForPosition(parseKey(key)));
    if (!HashSet.has(departed, chunkKey)) {
      nextCells = HashMap.set(nextCells, key, cell);
    }
  }

  let nextFrontier = HashSet.empty<FluidKey>();
  for (const key of state.frontier) {
    const chunkKey = ChunkCacheKey.make(chunkCoordsForPosition(parseKey(key)));
    if (!HashSet.has(departed, chunkKey)) {
      nextFrontier = HashSet.add(nextFrontier, key);
    }
  }

  return {
    ...state,
    cells: nextCells,
    frontier: nextFrontier,
  };
};

export const buildSyncedFluidState = (
  state: FluidState,
  prevCache: LoadedChunkCache,
  chunks: ReadonlyArray<Chunk>,
): SyncLoadedChunksPlan => {
  const nextCache = cacheFromChunks(chunks);
  const newChunks: Array<Chunk> = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!;
    if (!HashMap.has(prevCache, ChunkCacheKey.make(chunk.coord))) {
      newChunks.push(chunk);
    }
  }

  let departed = HashSet.empty<ChunkCacheKey>();
  for (const [key] of prevCache) {
    if (!HashMap.has(nextCache, key)) departed = HashSet.add(departed, key);
  }

  let nextState = state;
  for (let idx = 0; idx < newChunks.length; idx++) {
    nextState = hydrateChunk(nextState, newChunks[idx]!);
  }

  return {
    nextState: pruneDepartedChunks(nextState, departed),
    nextCache,
  };
};

export const collectTickWork = (
  state: FluidState,
  lavaTickActive: boolean,
): ReadonlyArray<WorkItem> => {
  const halfBudget = Math.floor(FLUID_TICK_BUDGET / 2);
  const lavaCap = lavaTickActive ? FLUID_TICK_BUDGET : 0;
  const collected: WorkItem[] = [];
  let waterCollected = 0;
  let lavaCollected = 0;

  for (const key of state.frontier) {
    const cellOpt = HashMap.get(state.cells, key);
    if (Option.isNone(cellOpt)) continue;

    const cell = cellOpt.value;
    if (cell.type === "water") {
      if (waterCollected < halfBudget) {
        collected.push({ key, cell });
        waterCollected++;
      }
    } else if (cell.type === "lava") {
      if (lavaCollected < lavaCap) {
        collected.push({ key, cell });
        lavaCollected++;
      }
    }

    if (waterCollected >= halfBudget && lavaCollected >= lavaCap) break;
  }

  return collected;
};

export const removeWorkFromFrontier = (
  frontier: HashSet.HashSet<FluidKey>,
  work: ReadonlyArray<WorkItem>,
): HashSet.HashSet<FluidKey> =>
  work.reduce((acc, item) => HashSet.remove(acc, item.key), frontier);
