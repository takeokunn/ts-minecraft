import { Effect, HashMap, Ref } from "effect";
import { INITIAL_STATE } from "@ts-minecraft/block";
import { ChunkManagerService } from "./chunk-manager-service";
import { makeFluidServiceRuntime } from "./fluid-service-ops";
import type { FluidState } from "@ts-minecraft/block";
import { type LoadedChunkCache } from "./fluid-service-helpers";

export { resolveContact } from "../domain/fluid-contact";

export class FluidService extends Effect.Service<FluidService>()(
  "@minecraft/application/FluidService",
  {
    effect: Effect.gen(function* () {
      const chunkManagerService = yield* ChunkManagerService;
      const stateRef = yield* Ref.make<FluidState>(INITIAL_STATE);
      const loadedCacheRef = yield* Ref.make<LoadedChunkCache>(HashMap.empty());
      return makeFluidServiceRuntime({
        chunkManagerService,
        stateRef,
        loadedCacheRef,
      });
    }),
  },
) {}
