// Parity property test: worker-pool sync-fallback output is byte-identical to
// main-thread `application/chunk/terrain/generator.generateTerrain` output.
//
// If this test fails, save corruption is the immediate consequence — every
// existing world's terrain would regenerate differently. Treat any regression
// here as a critical bug.
//
// Strategy: drive both paths with the same `(coord, seed)` and compare the
// `blocks` Uint8Array byte-for-byte.
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { BiomeService, NoiseService, NoiseServicePort, generateTerrain } from '@ts-minecraft/world'
import { TerrainWorkerPool } from '@ts-minecraft/worker'

// Bridge identical in shape to `src/layers.ts NoisePortLayer` so we can drive
// `BiomeService` + `generateTerrain` through the real Effect-side noise stack
// without dragging in `layers.ts`.
const BridgedNoisePortLayer = Layer.effect(
  NoiseServicePort,
  Effect.map(NoiseService, (noise) =>
    NoiseServicePort.of({
      _tag: '@minecraft/application/noise/NoiseServicePort' as const,
      noise2D: noise.noise2D,
      octaveNoise2D: noise.octaveNoise2D,
      setSeed: noise.setSeed,
      getSeed: Effect.succeed(0),
      octaveNoise2DBatch: noise.octaveNoise2DBatch,
      noise2DBatch: noise.noise2DBatch,
      octaveNoise2DBatchXY: noise.octaveNoise2DBatchXY,
      noise2DBatchXY: noise.noise2DBatchXY,
      noise3D: noise.noise3D,
      noise3DBatchXYZ: noise.noise3DBatchXYZ,
      continentalness: noise.continentalness,
      erosion: noise.erosion,
      weirdness: noise.weirdness,
      jaggedness: noise.jaggedness,
      sampleTerrainChannels: noise.sampleTerrainChannels,
    }),
  ),
).pipe(Layer.provide(NoiseService.Default))

const MainThreadLayer = Layer.mergeAll(
  ChunkService.Default,
  BiomeService.Default.pipe(Layer.provide(BridgedNoisePortLayer)),
  BridgedNoisePortLayer,
  NoiseService.Default,
)

// Run the main-thread `generateTerrain` exactly as `chunk-manager-service.ts`
// does today: seed the noise service, then invoke the pipeline.
const runMainThread = (
  coord: { x: number; z: number },
  seed: number,
): Uint8Array =>
  Effect.runSync(
    Effect.gen(function* () {
      const noise = yield* NoiseService
      yield* noise.setSeed(seed)
      const chunkService = yield* ChunkService
      const biome = yield* BiomeService
      const port = yield* NoiseServicePort
      const chunk = yield* generateTerrain(chunkService, biome, port, coord)
      return chunk.blocks
    }).pipe(Effect.provide(MainThreadLayer)),
  )

const runWorkerSync = (
  coord: { x: number; z: number },
  seed: number,
): Uint8Array =>
  Effect.runSync(
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      const result = yield* pool.generateTerrain(coord, {
        seaLevel: 48,
        lakeLevel: 62,
        seed,
      })
      return result.blocks
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

const compareByteIdentical = (a: Uint8Array, b: Uint8Array): void => {
  expect(a.byteLength).toBe(b.byteLength)
  // Cheap mismatch finder: scan first; if any differ, surface the offset.
  // `Arr.findFirst` over an index array beats the imperative loop pattern
  // discouraged in production code, and runs only once per case.
  const firstMismatch = Arr.findFirst(
    Arr.makeBy(a.byteLength, (i) => i),
    (i) => a[i]! !== b[i]!,
  )
  // Match.value would work too, but Option.match is the project-standard
  // discriminator for "found vs not-found" branching.
  expect(firstMismatch._tag).toBe('None')
}

describe('infrastructure/terrain/terrain-worker-pool — parity property test', () => {
  it('worker sync-fallback output equals main-thread generateTerrain output for 10 random (chunkX, chunkZ, seed) tuples', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -8, max: 8 }),
        fc.integer({ min: -8, max: 8 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (chunkX, chunkZ, seed) => {
          const coord = { x: chunkX, z: chunkZ }
          const main = runMainThread(coord, seed)
          const worker = runWorkerSync(coord, seed)
          compareByteIdentical(main, worker)
        },
      ),
      // 10 cases cover the byte-identical parity invariant well; each case
      // generates a full chunk through both pipelines (~64KB blocks + ~30k
      // noise samples). Runtime is dominated by dual generation, not fast-check
      // shrinking.
      { numRuns: 10 },
    )
  }, 180_000)
})
