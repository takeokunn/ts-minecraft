import { Effect, Ref } from "effect";
import type { FluidState } from "@ts-minecraft/block";
import type { Chunk } from "../domain/chunk";
import type { LoadedChunkCache } from "./fluid-service-helpers";
import { buildSyncedFluidState } from "./fluid-service-runtime-plan";

export const makeSyncLoadedChunks =
  (stateRef: Ref.Ref<FluidState>, loadedCacheRef: Ref.Ref<LoadedChunkCache>) =>
  (chunks: ReadonlyArray<Chunk>): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const prevCache = yield* Ref.get(loadedCacheRef);
      const { nextState, nextCache } = buildSyncedFluidState(
        yield* Ref.get(stateRef),
        prevCache,
        chunks,
      );

      yield* Ref.set(stateRef, nextState);
      yield* Ref.set(loadedCacheRef, nextCache);
    });
