import { Effect, HashMap, Ref } from "effect";
import {
  chunkCoordsForPosition,
  enqueue,
} from "@ts-minecraft/block";
import type { FluidCell, FluidState, FluidType } from "@ts-minecraft/block";
import { ChunkCacheKey, type Position } from "@ts-minecraft/core";
import type { BlockType } from "@ts-minecraft/core";
import {
  setFluidBlockIfLoaded,
  setAirBlockIfLoaded,
  setSolidBlockIfLoaded,
} from "./fluid-chunk-ops";
import { removeCell, setCell } from "./fluid-state-ops";
import { cacheFromChunks, type LoadedChunkCache } from "./fluid-service-helpers";
import { makeSyncLoadedChunks } from "./fluid-service-sync";
import { makeTick } from "./fluid-service-tick";
import type { ChunkManagerService } from "./chunk-manager-service";
import type { Chunk } from "../domain/chunk";

export type FluidServiceWrite = {
  readonly writeFluid: (
    loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
    position: Position,
    cell: FluidCell,
  ) => Effect.Effect<void, never>;
  readonly writeAir: (
    loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
    position: Position,
  ) => Effect.Effect<void, never>;
  readonly writeSolid: (
    loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
    position: Position,
    blockType: BlockType,
  ) => Effect.Effect<void, never>;
};

export type FluidServiceRuntimeDeps = {
  readonly chunkManagerService: ChunkManagerService;
  readonly stateRef: Ref.Ref<FluidState>;
  readonly loadedCacheRef: Ref.Ref<LoadedChunkCache>;
};

export const normalizePosition = (position: Position): Position => ({
  x: Math.floor(position.x),
  y: Math.floor(position.y),
  z: Math.floor(position.z),
});

export const makeGetLoaded = (
  chunkManagerService: ChunkManagerService,
  loadedCacheRef: Ref.Ref<LoadedChunkCache>,
): Effect.Effect<LoadedChunkCache, never> =>
  Effect.gen(function* () {
    const cached = yield* Ref.get(loadedCacheRef);
    if (HashMap.size(cached) > 0) return cached;
    const chunks = yield* chunkManagerService.getLoadedChunks();
    return cacheFromChunks(chunks);
  });

export const makeWriteFluid =
  (
    chunkManagerService: ChunkManagerService,
  ): FluidServiceWrite["writeFluid"] =>
  (loaded, position, cell) =>
    setFluidBlockIfLoaded(
      HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
      position,
      cell,
      chunkManagerService,
    );

export const makeWriteAir =
  (
    chunkManagerService: ChunkManagerService,
  ): FluidServiceWrite["writeAir"] =>
  (loaded, position) =>
    setAirBlockIfLoaded(
      HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
      position,
      chunkManagerService,
    );

export const makeWriteSolid =
  (
    chunkManagerService: ChunkManagerService,
  ): FluidServiceWrite["writeSolid"] =>
  (loaded, position, blockType) =>
    setSolidBlockIfLoaded(
      HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
      position,
      blockType,
      chunkManagerService,
    );

export const makeSeedFluid =
  (
    getLoaded: Effect.Effect<LoadedChunkCache, never>,
    stateRef: Ref.Ref<FluidState>,
    writeFluid: FluidServiceWrite["writeFluid"],
  ) =>
  (type: FluidType) =>
  (position: Position): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const normalized = normalizePosition(position);
      const loaded = yield* getLoaded;
      const cell: FluidCell = { level: 0, source: true, type };

      yield* Ref.update(stateRef, (state) => ({
        ...setCell(state, normalized, cell),
        frontier: enqueue(state.frontier, normalized),
      }));

      yield* writeFluid(loaded, normalized, cell);
    });

export const makeRemoveFluid =
  (
    getLoaded: Effect.Effect<LoadedChunkCache, never>,
    stateRef: Ref.Ref<FluidState>,
    writeAir: FluidServiceWrite["writeAir"],
  ) =>
  (position: Position): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const normalized = normalizePosition(position);
      const loaded = yield* getLoaded;

      yield* Ref.update(stateRef, (state) => ({
        ...removeCell(state, normalized),
        frontier: enqueue(state.frontier, normalized),
      }));

      yield* writeAir(loaded, normalized);
    });

export const makeFluidServiceRuntime = (
  deps: FluidServiceRuntimeDeps,
): {
  readonly notifyBlockChanged: (position: Position) => Effect.Effect<void, never>;
  readonly seedWater: (position: Position) => Effect.Effect<void, never>;
  readonly seedLava: (position: Position) => Effect.Effect<void, never>;
  readonly removeWater: (position: Position) => Effect.Effect<void, never>;
  readonly removeLava: (position: Position) => Effect.Effect<void, never>;
  readonly syncLoadedChunks: (chunks: ReadonlyArray<Chunk>) => Effect.Effect<void, never>;
  readonly tick: () => Effect.Effect<void, never>;
} => {
  const getLoaded = makeGetLoaded(deps.chunkManagerService, deps.loadedCacheRef);
  const writeFluid = makeWriteFluid(deps.chunkManagerService);
  const writeAir = makeWriteAir(deps.chunkManagerService);
  const writeSolid = makeWriteSolid(deps.chunkManagerService);

  return {
    notifyBlockChanged: (position) =>
      Effect.gen(function* () {
        const normalized = normalizePosition(position);
        yield* Ref.update(deps.stateRef, (state) => ({
          ...state,
          frontier: enqueue(state.frontier, normalized),
        }));
      }),
    seedWater: makeSeedFluid(getLoaded, deps.stateRef, writeFluid)("water"),
    seedLava: makeSeedFluid(getLoaded, deps.stateRef, writeFluid)("lava"),
    removeWater: makeRemoveFluid(getLoaded, deps.stateRef, writeAir),
    removeLava: makeRemoveFluid(getLoaded, deps.stateRef, writeAir),
    syncLoadedChunks: makeSyncLoadedChunks(deps.stateRef, deps.loadedCacheRef),
    tick: makeTick(deps.stateRef, deps.loadedCacheRef, writeFluid, writeSolid),
  };
};
