import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { StorageServicePort } from '@ts-minecraft/terrain'
import type { ChunkStorageValue } from '@ts-minecraft/terrain'
import { FLUID_BYTE_LENGTH } from '@ts-minecraft/world-state'
import {
  NoiseServicePort,
  NoiseServiceLive,
  BiomeServiceLive,
  ChunkManagerService,
  ChunkManagerServiceLive,
} from '@ts-minecraft/terrain'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/app'
import { ChunkServiceLive } from '../domain/chunk'
import { DEFAULT_WORLD_ID } from '@ts-minecraft/kernel'
import {
  makeInMemoryStorage,
  LightEngineNoopLive,
  EXPECTED_BLOCKS_LENGTH,
} from './chunk-manager-test-utils'

describe('application/chunk/chunk-manager-service (storage)', () => {
  // ---------------------------------------------------------------------------
  // normalizeFluidBuffer and normalizeChunkStorageValue (lines 31-46)
  //
  // normalizeFluidBuffer: called with a Uint8Array of wrong length → returns
  //   a fresh createFluidBuffer() instead of the stored value.
  // normalizeChunkStorageValue: called with a legacy raw Uint8Array (no .blocks
  //   field) → exercises the `stored instanceof Uint8Array` branch that calls
  //   hydrateLegacyFluidBufferFromBlocks.
  // ---------------------------------------------------------------------------

  describe('normalizeFluidBuffer — wrong-length fluid Uint8Array is replaced', () => {
    it.effect('getChunk returns a chunk with correct-length fluid when stored fluid has wrong byte length', () => {
      // Store a chunk as { blocks: validBlocks, fluid: wrongLengthFluid }.
      // normalizeFluidBuffer sees a Uint8Array whose byteLength !== FLUID_BYTE_LENGTH
      // and replaces it with createFluidBuffer(). This covers lines 31-35.
      const storage = makeInMemoryStorage()
      const validBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)
      const wrongLengthFluid = new Uint8Array(4) // intentionally wrong size

      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseServiceLive),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLive),
      )

      return Effect.gen(function* () {
        // Save as structured { blocks, fluid } with a wrong-length fluid buffer
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 77, z: 3 }, { blocks: validBlocks, fluid: wrongLengthFluid } as unknown as ChunkStorageValue)

        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 77, z: 3 })

        // Chunk must load successfully and the blocks must equal what we saved
        expect(chunk.blocks).toEqual(validBlocks)
        // The Option-wrapped fluid (if present) must be a properly-sized buffer
        Option.match(chunk.fluid, {
          onNone: () => { /* fluid was discarded entirely — also valid */ },
          onSome: (f) => { expect(f.byteLength).toBe(FLUID_BYTE_LENGTH) },
        })
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('normalizeChunkStorageValue — legacy raw Uint8Array (no blocks field)', () => {
    it.effect('getChunk handles a legacy raw-Uint8Array chunk stored before the { blocks, fluid } format', () => {
      // Store the chunk as a plain Uint8Array (the old format before the
      // structured { blocks, fluid } value was introduced). This exercises
      // the `stored instanceof Uint8Array` branch of normalizeChunkStorageValue
      // (lines 37-42) which calls hydrateLegacyFluidBufferFromBlocks.
      const storage = makeInMemoryStorage()
      const legacyBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH).fill(2) // all STONE

      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseServiceLive),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLive),
      )

      return Effect.gen(function* () {
        // Store as a raw Uint8Array — the legacy format
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 88, z: 5 }, legacyBlocks)

        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 88, z: 5 })

        // Must load successfully; blocks must match the raw stored data
        expect(chunk.blocks).toEqual(legacyBlocks)
        expect(chunk.coord.x).toBe(88)
        expect(chunk.coord.z).toBe(5)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // Buffer length mismatch → regenerate path (lines 232-234)
  //
  // When loadChunk returns a { blocks, fluid } value whose blocks buffer has a
  // wrong length (not CHUNK_SIZE × CHUNK_SIZE × CHUNK_HEIGHT), the service
  // discards it and re-generates the chunk from scratch.
  // ---------------------------------------------------------------------------

  describe('buffer length mismatch causes chunk to be regenerated (lines 232-234)', () => {
    it.effect('getChunk regenerates and returns a valid chunk when stored blocks have wrong length', () => {
      // Store a { blocks: wrongLengthBlocks, fluid } so that normalizeChunkStorageValue
      // returns blocks.byteLength !== EXPECTED_LENGTH. This exercises the logWarning +
      // generateAndInsert() branch at lines 232-234.
      const storage = makeInMemoryStorage()
      const wrongLengthBlocks = new Uint8Array(16) // far too short
      const validFluid = new Uint8Array(FLUID_BYTE_LENGTH)

      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseServiceLive),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLive),
      )

      return Effect.gen(function* () {
        // Store wrong-length blocks (structured format, so normalizeChunkStorageValue
        // takes the blocks branch and returns the truncated buffer)
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 55, z: 9 }, { blocks: wrongLengthBlocks, fluid: validFluid } as unknown as ChunkStorageValue)

        const service = yield* ChunkManagerService
        // getChunk must NOT fail — it detects the length mismatch, logs a warning,
        // and falls back to terrain generation.
        const chunk = yield* service.getChunk({ x: 55, z: 9 })

        // The regenerated chunk must have the correct block buffer length
        expect(chunk.blocks.byteLength).toBe(EXPECTED_BLOCKS_LENGTH)
        expect(chunk.coord.x).toBe(55)
        expect(chunk.coord.z).toBe(9)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
