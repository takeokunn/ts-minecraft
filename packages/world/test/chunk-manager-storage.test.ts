import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { StorageServicePort } from '@ts-minecraft/world'
import { FLUID_BYTE_LENGTH } from '@ts-minecraft/world'
import {
  NoiseServicePort,
  NoiseService,
  BiomeService,
  ChunkManagerService,
} from '@ts-minecraft/world'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/worker'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { DEFAULT_WORLD_ID } from '@ts-minecraft/core'
import {
  makeInMemoryStorage,
  LightEngineNoopLayer,
  EXPECTED_BLOCKS_LENGTH,
} from './chunk-manager-test-utils'
import { storedChunkPayload } from '../application/chunk-manager-cache'

describe('storedChunkPayload', () => {
  it('returns current structured chunk payloads unchanged', () => {
    const blocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)
    const payload = storedChunkPayload({ blocks, fluid: undefined })

    expect(payload.blocks).toBe(blocks)
    expect(payload.fluid.byteLength).toBe(FLUID_BYTE_LENGTH)
  })
})

describe('application/chunk/chunk-manager-service (storage)', () => {
  // ---------------------------------------------------------------------------
  // storedFluidBuffer: a wrong-length fluid buffer is replaced with a fresh,
  // correctly-sized buffer before the chunk enters the cache.
  // ---------------------------------------------------------------------------

  describe('storedFluidBuffer — wrong-length fluid Uint8Array is replaced', () => {
    it.effect('getChunk returns a chunk with correct-length fluid when stored fluid has wrong byte length', () => {
      // Store a chunk as { blocks: validBlocks, fluid: wrongLengthFluid }.
      // storedFluidBuffer sees a byteLength !== FLUID_BYTE_LENGTH and replaces it.
      const storage = makeInMemoryStorage()
      const validBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)
      const wrongLengthFluid = new Uint8Array(4) // intentionally wrong size

      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseService.Default),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLayer),
      )

      return Effect.gen(function* () {
        // Save as structured { blocks, fluid } with a wrong-length fluid buffer
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 77, z: 3 }, { blocks: validBlocks, fluid: wrongLengthFluid })

        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 77, z: 3 })

        // Chunk must load successfully and the blocks must equal what we saved
        expect(chunk.blocks).toEqual(validBlocks)
        // The Option-wrapped fluid (if present) must be a properly-sized buffer
        const fluid = Option.getOrNull(chunk.fluid)
        if (fluid !== null) expect(fluid.byteLength).toBe(FLUID_BYTE_LENGTH)
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
      // Store a { blocks: wrongLengthBlocks, fluid } so the block-size guard exercises
      // the logWarning + generateAndInsert() branch.
      const storage = makeInMemoryStorage()
      const wrongLengthBlocks = new Uint8Array(16) // far too short
      const validFluid = new Uint8Array(FLUID_BYTE_LENGTH)

      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseService.Default),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLayer),
      )

      return Effect.gen(function* () {
        // Store wrong-length blocks in the structured format; the block-size guard
        // must reject the payload and regenerate the chunk.
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 55, z: 9 }, { blocks: wrongLengthBlocks, fluid: validFluid })

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
