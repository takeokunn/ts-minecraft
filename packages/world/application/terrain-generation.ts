// Pure synchronous terrain generation for off-thread workers.
// Output is byte-identical to main-thread generator.generateTerrain for the same inputs;
// enforced by terrain-worker-pool.parity.property.test.ts.
// No logic duplication — single source of truth remains generator.ts.
import { Array as Arr, Effect, Layer, Metric, MetricBoundaries, Schema } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, ChunkCoordSchema } from '@ts-minecraft/core'
import { ChunkService } from './chunk-service'
import type { ChunkCoord } from '@ts-minecraft/core'
import { LIGHT_BYTE_LENGTH, computeBlockLight, computeSkyLight } from '@ts-minecraft/block'
import { BiomeService } from './biome-service'
import { NoiseServicePort } from '../domain/noise-service-port'
import { generateTerrain } from '../domain/terrain/generator'
import { generateNetherTerrain } from '../domain/terrain/nether-generator'
import { generateEndTerrain } from '../domain/terrain/end-generator'
import { createNoisePrimitives } from '../domain/noise-primitives'
import { buildNoisePortFromPrimitives } from './noise-port-factory'

// Chunk load duration histogram: 20 linear buckets 0–1000ms (width=50ms).
export const chunkLoadHistogram = Metric.histogram(
  'chunk_load_ms',
  MetricBoundaries.linear({ start: 0, width: 50, count: 20 }),
  'Chunk load duration in milliseconds'
)

// ---------------------------------------------------------------------------
// Public input / output shapes (mirrored by the worker protocol so a request
// envelope can be passed straight through).
// ---------------------------------------------------------------------------
export const TerrainGenerationInputSchema = Schema.Struct({
  coord: ChunkCoordSchema,
  seaLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_HEIGHT - 1)),
  lakeLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_HEIGHT - 1)),
  seed: Schema.Number.pipe(Schema.int()),
})
export type TerrainGenerationInput = Schema.Schema.Type<typeof TerrainGenerationInputSchema>

export type ChunkBlocks = Readonly<{
  blocks: Uint8Array
  skyLight: Uint8Array
  blockLight: Uint8Array
}>

const makePureNoisePortLayer = (seed: number): Layer.Layer<NoiseServicePort> =>
  Layer.succeed(
    NoiseServicePort,
    buildNoisePortFromPrimitives(createNoisePrimitives(seed), seed),
  )

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
  const noisePort = makePureNoisePortLayer(seed)
  return Layer.mergeAll(
    ChunkService.Default,
    BiomeService.Default.pipe(Layer.provide(noisePort)),
    noisePort,
  )
}

// ---------------------------------------------------------------------------
// Lighting: run the full sky+block BFS inside the worker so the main thread
// receives genuinely-lit grids. Re-uses the same `computeSkyLight` /
// `computeBlockLight` BFS implementations the main thread used to call via
// `LightEngineService.updateLight` — no logic duplication, just a relocation
// of the work to the worker side of the boundary.
//
// Performance impact (RD=2, 25 chunks): ~0.6-1.25s of main-thread blocking
// on cold start moves into N worker fibers running in parallel.
// ---------------------------------------------------------------------------
const computeInitialLightGrids = (blocks: Uint8Array): { skyLight: Uint8Array; blockLight: Uint8Array } => {
  const skyLight = new Uint8Array(LIGHT_BYTE_LENGTH)
  const blockLight = new Uint8Array(LIGHT_BYTE_LENGTH)
  // computeSkyLight / computeBlockLight are pure sync flood-fill BFS — they
  // mutate the passed-in buffer in place and return void.
  computeSkyLight(blocks, skyLight)
  computeBlockLight(blocks, blockLight)
  return { skyLight, blockLight }
}

// ---------------------------------------------------------------------------
// Pre-computed noise sample coordinates. Exposed for symmetry with the
// `application/chunk/terrain/generator.ts createColumnNoiseCoordinates` helper
// — useful for tests that want to assert the coord grid is identical to the
// main-thread side, and as a hook the integration agent can use to pre-batch
// noise calls in the future.
// ---------------------------------------------------------------------------
export type ColumnNoiseCoord = Readonly<{
  wx: number
  wz: number
}>

export const createTerrainNoiseCoordinates = (
  coord: ChunkCoord,
): ReadonlyArray<ColumnNoiseCoord> => {
  const baseX = coord.x * CHUNK_SIZE
  const baseZ = coord.z * CHUNK_SIZE
  return Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
    Arr.makeBy(CHUNK_SIZE, (lz) => ({ wx: baseX + lx, wz: baseZ + lz })),
  )
}

// ---------------------------------------------------------------------------
// Public API. Synchronous: `Effect.runSync` is safe because every Effect in
// the pipeline is `Effect.sync` / `Effect.succeed` — no async boundary.
// ---------------------------------------------------------------------------

// Exposed so worker entrypoint pairs with a cached runtime from buildTerrainLayer (avoids Layer-init cost per chunk).
export const buildTerrainProgram = (coord: ChunkCoord) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const biomeService = yield* BiomeService
    const noiseService = yield* NoiseServicePort
    return yield* generateTerrain(chunkService, biomeService, noiseService, coord)
  })

// Nether terrain program — reuses the same Layer as buildTerrainProgram (BiomeService unused here,
// but sharing the Layer avoids a second per-seed initialization cost in the worker runtime cache).
export const buildNetherProgram = (coord: ChunkCoord) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const noiseService = yield* NoiseServicePort
    return yield* generateNetherTerrain(chunkService, noiseService, coord)
  })

// End terrain program — static island generation, no noise required.
export const buildEndProgram = (coord: ChunkCoord) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    return yield* generateEndTerrain(chunkService, coord)
  })

// Light grids are fully BFS-propagated here so main thread adopts them directly — primary cold-start fix.
export const toChunkBlocks = (chunk: { blocks: Uint8Array }): ChunkBlocks => {
  const { skyLight, blockLight } = computeInitialLightGrids(chunk.blocks)
  return { blocks: chunk.blocks, skyLight, blockLight }
}

export const generateTerrainBlocks = (input: TerrainGenerationInput): ChunkBlocks => {
  const layer = buildTerrainLayer(input.seed)
  const chunk = Effect.runSync(buildTerrainProgram(input.coord).pipe(Effect.provide(layer)))
  // The generator only fills `blocks`; light buffers are produced here so the
  // worker can transfer all three buffers to the main thread in one message.
  return toChunkBlocks(chunk)
}

// `seaLevel` / `lakeLevel` are accepted in the input envelope (so the worker
// protocol can carry them) but ignored: the generator reads them from
// `kernel/constants` (`SEA_LEVEL=63`, `LAKE_LEVEL=SEA_LEVEL`). Keeping them in
// the input keeps the protocol explicit if those constants ever
// become per-world configuration.
