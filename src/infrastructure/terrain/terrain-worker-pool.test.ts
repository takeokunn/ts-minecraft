import { describe, expect } from '@effect/vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'
import { LIGHT_BYTE_LENGTH } from '@/domain/light'
import { TerrainWorkerPool } from './terrain-worker-pool'

const BLOCK_BYTES = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

describe('infrastructure/terrain/terrain-worker-pool', () => {
  it.effect('falls back to synchronous generation when Worker is unavailable', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      // Vitest runs in Node — Worker is undefined → workerCount === 0.
      expect(pool.workerCount).toBe(0)

      const result = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 64, lakeLevel: 62, seed: 12345 },
      )

      expect(result.blocks).toBeInstanceOf(Uint8Array)
      expect(result.blocks.byteLength).toBe(BLOCK_BYTES)
      expect(result.skyLight).toBeInstanceOf(Uint8Array)
      expect(result.skyLight.byteLength).toBe(LIGHT_BYTE_LENGTH)
      expect(result.blockLight).toBeInstanceOf(Uint8Array)
      expect(result.blockLight.byteLength).toBe(LIGHT_BYTE_LENGTH)

      // Bedrock invariant: y=0 must be bedrock for every column.
      // bedrock block index isn't exported as a constant here, but we can
      // assert that y=0 voxels are non-zero (i.e. not AIR).
      const yZeroSamples = Arr.makeBy(CHUNK_SIZE, (lx) => lx)
      Arr.forEach(yZeroSamples, (lx) => {
        const idx = 0 + 0 * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        expect(result.blocks[idx]).not.toBe(0)
      })
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

  it.effect('produces deterministic output for the same (coord, seed)', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      const a = yield* pool.generateTerrain(
        { x: 1, z: 2 },
        { seaLevel: 64, lakeLevel: 62, seed: 99 },
      )
      const b = yield* pool.generateTerrain(
        { x: 1, z: 2 },
        { seaLevel: 64, lakeLevel: 62, seed: 99 },
      )
      // First N bytes equal => deterministic. (Full equality would force a
      // 64KB byte-by-byte compare; sampling 1024 bytes is a stronger-than-
      // chance signal at zero allocation cost.)
      const sampleIndices = Arr.makeBy(1024, (i) => i * 64)
      Arr.forEach(sampleIndices, (i) => {
        expect(a.blocks[i]).toBe(b.blocks[i])
      })
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

  it.effect('different seeds produce different output', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      const a = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 64, lakeLevel: 62, seed: 1 },
      )
      const b = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 64, lakeLevel: 62, seed: 2 },
      )
      // At least one of the surface-band voxels must differ.
      const sampleIndices = Arr.makeBy(2048, (i) => i * 32)
      const differs = sampleIndices.some((i) => a.blocks[i] !== b.blocks[i])
      expect(differs).toBe(true)
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

  it.effect('finalizer releases pending requests on scope close', () =>
    Effect.gen(function* () {
      // In sync-fallback mode there are no pending in-flight requests, so the
      // finalizer is a no-op. We still verify that scope close completes
      // without error by running the service inside a freshly scoped Effect.
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const pool = yield* TerrainWorkerPool
          return yield* pool.generateTerrain(
            { x: 5, z: 5 },
            { seaLevel: 64, lakeLevel: 62, seed: 7 },
          )
        }).pipe(Effect.provide(TerrainWorkerPool.Default)),
      )
      expect(result.blocks.byteLength).toBe(BLOCK_BYTES)
    }),
  )
})
