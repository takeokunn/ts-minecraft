import { Effect, HashMap, Ref } from "effect";
import {
  FLUID_TICK_BUDGET,
  LAVA_TICK_INTERVAL,
  parseKey,
} from "@ts-minecraft/block";
import type { FluidCell, FluidState } from "@ts-minecraft/block";
import type { ChunkCacheKey, Position } from "@ts-minecraft/core";
import type { BlockType } from "@ts-minecraft/core";
import type { Chunk } from "../domain/chunk";
import type { LoadedChunkCache } from "./fluid-service-helpers";
import { processFluidCell } from "./fluid-service-flow";
import { splitBudget } from "./fluid-tick-budget";
import {
  collectTickWork,
  removeWorkFromFrontier,
} from "./fluid-service-runtime-plan";

type FluidTickWrite = {
  readonly writeFluid: (
    loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
    position: Position,
    cell: FluidCell,
  ) => Effect.Effect<void, never>;
  readonly writeSolid: (
    loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
    position: Position,
    blockType: BlockType,
  ) => Effect.Effect<void, never>;
};

export const makeTick =
  (
    stateRef: Ref.Ref<FluidState>,
    loadedCacheRef: Ref.Ref<LoadedChunkCache>,
    writeFluid: FluidTickWrite["writeFluid"],
    writeSolid: FluidTickWrite["writeSolid"],
  ) =>
  (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const loaded = yield* Ref.get(loadedCacheRef);
      const state = yield* Ref.get(stateRef);
      const tickCounter = state.tickCounter + 1;
      const lavaTickActive = tickCounter % LAVA_TICK_INTERVAL === 0;

      // Collect this tick's work by lazily iterating the frontier. Water takes up to
      // half of the budget; lava only participates on its tick.
      const collected = collectTickWork(state, lavaTickActive);

      const { work } = splitBudget(
        collected,
        lavaTickActive,
        FLUID_TICK_BUDGET,
      );
      if (work.length === 0) {
        yield* Ref.update(stateRef, (s) => ({ ...s, tickCounter }));
        return;
      }

      const nextFrontier = removeWorkFromFrontier(state.frontier, work);
      const tickStateRef = yield* Ref.make<FluidState>({
        ...state,
        tickCounter,
        frontier: nextFrontier,
      });

      yield* Effect.forEach(
        work,
        ({ key, cell }) =>
          processFluidCell(
            { writeFluid, writeSolid },
            loaded,
            tickStateRef,
            parseKey(key),
            cell,
          ),
        { concurrency: 1 },
      );

      yield* Ref.set(stateRef, yield* Ref.get(tickStateRef));
    });
