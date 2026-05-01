/**
 * Pure synchronous terrain generation for off-thread workers.
 *
 * `generateTerrainBlocks` produces byte-identical output to the main-thread
 * `application/chunk/terrain/generator.generateTerrain` pipeline given the
 * same `(coord, seed, seaLevel, lakeLevel)` inputs. This is enforced by
 * `infrastructure/terrain/terrain-worker-pool.parity.property.test.ts`.
 *
 * Strategy: build pure-function `NoiseServicePort` and `BiomeService` /
 * `ChunkService` impls backed by `shared/noise/primitives.ts`, then run the
 * existing `generateTerrain` Effect through `Effect.runSync`. No new terrain
 * logic is duplicated — the single source of truth remains `generator.ts`.
 */
import { Array as Arr, Effect, Layer, Schema } from 'effect'
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  ChunkCoordSchema,
  ChunkService,
} from '@/domain/chunk'
import type { ChunkCoord } from '@/domain/chunk'
import { LIGHT_BYTE_LENGTH, computeBlockLight, computeSkyLight } from '@/domain/light'
import { BiomeService } from '@/application/biome/biome-service'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { generateTerrain } from '@/application/chunk/terrain/generator'
import {
  computeTerrainChannels,
  createNoisePrimitives,
  noise2DBatch as primitivesNoise2DBatch,
  noise2DBatchXY as primitivesNoise2DBatchXY,
  noise3DBatchXYZ as primitivesNoise3DBatchXYZ,
  octaveNoise2DBatch as primitivesOctaveNoise2DBatch,
  octaveNoise2DBatchXY as primitivesOctaveNoise2DBatchXY,
  type NoisePrimitives,
} from '@/shared/noise/primitives'

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

// ---------------------------------------------------------------------------
// Pure NoiseServicePort implementation backed by a fixed seed. All methods
// are `Effect.sync` over the seeded primitives — no mutable state, no setSeed
// (the seed is fixed by the layer constructor).
// ---------------------------------------------------------------------------
const buildPureNoisePort = (primitives: NoisePrimitives) => ({
  noise2D: (x: number, z: number): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.noise2D(x, z)),
  octaveNoise2D: (
    x: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity)),
  // setSeed is a no-op: the layer baked the seed in at construction time.
  // Returning Effect.void preserves the port shape; any call inside generator
  // would be a logic bug (we never re-seed mid-chunk).
  setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
  noise3D: (x: number, y: number, z: number): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.noise3D(x, y, z)),
  noise3DBatchXYZ: (
    xs: ReadonlyArray<number>,
    ys: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
  ): Effect.Effect<ReadonlyArray<number>, never> =>
    Effect.sync(() => primitivesNoise3DBatchXYZ(primitives, xs, ys, zs)),
  octaveNoise2DBatch: (
    points: ReadonlyArray<readonly [number, number]>,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ): Effect.Effect<ReadonlyArray<number>, never> =>
    Effect.sync(() =>
      primitivesOctaveNoise2DBatch(primitives, points, octaves, persistence, lacunarity),
    ),
  noise2DBatch: (
    points: ReadonlyArray<readonly [number, number]>,
  ): Effect.Effect<ReadonlyArray<number>, never> =>
    Effect.sync(() => primitivesNoise2DBatch(primitives, points)),
  octaveNoise2DBatchXY: (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ): Effect.Effect<ReadonlyArray<number>, never> =>
    Effect.sync(() =>
      primitivesOctaveNoise2DBatchXY(primitives, xs, zs, octaves, persistence, lacunarity),
    ),
  noise2DBatchXY: (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
  ): Effect.Effect<ReadonlyArray<number>, never> =>
    Effect.sync(() => primitivesNoise2DBatchXY(primitives, xs, zs)),
  continentalness: (x: number, z: number): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.continentalnessAt(x, z)),
  erosion: (x: number, z: number): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.erosionAt(x, z)),
  weirdness: (x: number, z: number): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.weirdnessAt(x, z)),
  jaggedness: (x: number, z: number): Effect.Effect<number, never> =>
    Effect.sync(() => primitives.jaggednessAt(x, z)),
  sampleTerrainChannels: (xStart: number, zStart: number) =>
    Effect.sync(() =>
      computeTerrainChannels(
        primitives.continentalness,
        primitives.erosion,
        primitives.weirdness,
        primitives.jaggedness,
        xStart,
        zStart,
      ),
    ),
})

const makePureNoisePortLayer = (seed: number): Layer.Layer<NoiseServicePort> =>
  Layer.succeed(
    NoiseServicePort,
    // Same `as unknown as NoiseServicePort` cast as `layers.ts NoisePortLayer`
    // — the plain-object impl matches the structural shape but cannot carry
    // the `_tag` discriminant Effect.Service tags onto its instances.
    buildPureNoisePort(createNoisePrimitives(seed)) as unknown as NoiseServicePort,
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

/**
 * Build the chunk-generation program for a given coord. Exposed so the worker
 * entrypoint can pair it with a cached runtime built from `buildTerrainLayer`.
 */
export const buildTerrainProgram = (coord: ChunkCoord) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const biomeService = yield* BiomeService
    const noiseService = yield* NoiseServicePort
    return yield* generateTerrain(chunkService, biomeService, noiseService, coord)
  })

/**
 * Convert the program output (a `Chunk`) into the `ChunkBlocks` envelope the
 * worker protocol carries. Both light grids are fully BFS-propagated here so
 * the main thread can adopt them directly without re-running the lighting
 * engine — moving this work off the main thread is the primary cold-start
 * fix (see `computeInitialLightGrids` comment).
 */
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
// `application/constants` (`SEA_LEVEL=48`, `LAKE_LEVEL=62`). Keeping them in
// the input keeps the protocol forward-compatible if those constants ever
// become per-world configuration.
