// Pure synchronous terrain generation for off-thread workers.
// Output is byte-identical to main-thread generator.generateTerrain for the same inputs;
// enforced by terrain-worker-pool.parity.property.test.ts.
// No logic duplication — single source of truth remains generator.ts.
import { Effect, Layer, Metric, MetricBoundaries, Schema } from "effect";
import { CHUNK_HEIGHT, ChunkCoordSchema } from "@ts-minecraft/core";
import { ChunkService } from "./chunk-service";
import type { ChunkCoord } from "@ts-minecraft/core";
import { BiomeService } from "./biome-service";
import { NoiseServicePort } from "../domain/noise-service-port";
import { generateTerrain } from "../domain/terrain/generator";
import {
  DEFAULT_TERRAIN_LEVELS,
  type TerrainLevels,
} from "../domain/terrain/generator-types";
import { generateNetherTerrain } from "../domain/terrain/nether-generator";
import { generateEndTerrain } from "../domain/terrain/end-generator";
import { createNoisePrimitives } from "../domain/noise-primitives";
import { buildNoisePortFromPrimitives } from "./noise-port-factory";
import {
  type ChunkBlocks,
  toChunkBlocks,
} from "../domain/terrain/terrain-generation-utils";

// Chunk load duration histogram: 20 linear buckets 0–1000ms (width=50ms).
export const chunkLoadHistogram = Metric.histogram(
  "chunk_load_ms",
  MetricBoundaries.linear({ start: 0, width: 50, count: 20 }),
  "Chunk load duration in milliseconds",
);

// ---------------------------------------------------------------------------
// Public input / output shapes (mirrored by the worker protocol so a request
// envelope can be passed straight through).
// ---------------------------------------------------------------------------
export const TerrainGenerationInputSchema = Schema.Struct({
  coord: ChunkCoordSchema,
  seaLevel: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, CHUNK_HEIGHT - 1),
  ),
  lakeLevel: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, CHUNK_HEIGHT - 1),
  ),
  seed: Schema.Number.pipe(Schema.int()),
});
export type TerrainGenerationInput = Schema.Schema.Type<
  typeof TerrainGenerationInputSchema
>;

const makePureNoisePortLayer = (seed: number): Layer.Layer<NoiseServicePort> =>
  Layer.succeed(
    NoiseServicePort,
    buildNoisePortFromPrimitives(createNoisePrimitives(seed), seed),
  );

// ChunkService.Default and BiomeService.Default are already pure (BiomeService
// only depends on NoiseServicePort, which we satisfy with the pure port). We
// chain Layer.provide to feed the pure port into BiomeService.
//
// Exported so the worker entrypoint can build a Runtime once per seed and
// reuse it across messages, avoiding the Layer-init cost on every chunk
// generation (BiomeService.Default + ChunkService.Default + NoisePort).
export const buildTerrainLayer = (
  seed: number,
): Layer.Layer<ChunkService | BiomeService | NoiseServicePort> => {
  const noisePort = makePureNoisePortLayer(seed);
  return Layer.mergeAll(
    ChunkService.Default,
    BiomeService.Default.pipe(Layer.provide(noisePort)),
    noisePort,
  );
};

export type { ChunkBlocks } from "../domain/terrain/terrain-generation-utils";
export {
  createTerrainNoiseCoordinates,
  toChunkBlocks,
} from "../domain/terrain/terrain-generation-utils";

// ---------------------------------------------------------------------------
// Public API. Synchronous: `Effect.runSync` is safe because every Effect in
// the pipeline is `Effect.sync` / `Effect.succeed` — no async boundary.
// ---------------------------------------------------------------------------

// Exposed so worker entrypoint pairs with a cached runtime from buildTerrainLayer (avoids Layer-init cost per chunk).
export const buildTerrainProgram = (
  coord: ChunkCoord,
  terrainLevels: TerrainLevels = DEFAULT_TERRAIN_LEVELS,
) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService;
    const biomeService = yield* BiomeService;
    const noiseService = yield* NoiseServicePort;
    return yield* generateTerrain(
      chunkService,
      biomeService,
      noiseService,
      coord,
      terrainLevels,
    );
  });

// Nether terrain program — reuses the same Layer as buildTerrainProgram (BiomeService unused here,
// but sharing the Layer avoids a second per-seed initialization cost in the worker runtime cache).
export const buildNetherProgram = (coord: ChunkCoord) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService;
    const noiseService = yield* NoiseServicePort;
    return yield* generateNetherTerrain(chunkService, noiseService, coord);
  });

// End terrain program — static island generation, no noise required.
export const buildEndProgram = (coord: ChunkCoord) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService;
    return yield* generateEndTerrain(chunkService, coord);
  });

export const generateTerrainBlocks = (
  input: TerrainGenerationInput,
): ChunkBlocks => {
  const layer = buildTerrainLayer(input.seed);
  const chunk = Effect.runSync(
    buildTerrainProgram(input.coord, {
      seaLevel: input.seaLevel,
      lakeLevel: input.lakeLevel,
    }).pipe(Effect.provide(layer)),
  );
  // Expand the generated blocks into the transfer buffers expected by workers.
  return toChunkBlocks(chunk);
};
