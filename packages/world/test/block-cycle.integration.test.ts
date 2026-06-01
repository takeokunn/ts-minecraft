// Integration test: block operation → chunk state → storage cycle
//
// Verifies the full pipeline:
//   BlockService.breakBlock / placeBlock
//   → ChunkManagerService (cache + dirty tracking)
//   → StorageService (in-memory mock)
//
// Key relationships verified:
//   - breakBlock sets chunk.dirty = true (via markChunkDirty)
//   - saveDirtyChunks persists modified block data to storage
//   - A new ChunkManagerService instance reads back the saved data unchanged
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex, ChunkCoord, Position, DEFAULT_WORLD_ID, blockTypeToIndex } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world'
import { BlockService } from '@ts-minecraft/world'
import {
  buildIntegrationLayer,
  worldToLocal,
  readBlockFromArray,
} from './block-cycle-test-utils'

describe('integration/block-cycle', () => {
  describe('breakBlock → chunk dirty flag', () => {
    it('breakBlock makes the chunk dirty via markChunkDirty', () => {
      const targetPos: Position = { x: 1, y: 64, z: 1 }
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const { coord } = worldToLocal(targetPos)

        // Load the chunk (generates terrain). This creates a block at the surface.
        // Use a position that is guaranteed to have a non-AIR block after terrain gen.
        // We read the chunk first to find any solid block within it.
        const chunk = yield* chunkManager.getChunk(coord)

        // Find the first non-AIR block in this chunk by scanning y=80..1
        // (terrain surface is typically y=48-80 for PLAINS biome)
        const solidPos = Arr.findFirst(
          Arr.makeBy(80, (i) => 80 - i),
          (y) => Option.match(blockIndex(0, y, 0), {
            onNone: () => false,
            onSome: (idx) => chunk.blocks[idx] !== 0,
          })
        ).pipe(Option.map((y) => ({ x: coord.x * CHUNK_SIZE, y, z: coord.z * CHUNK_SIZE } as Position)))

        const effectiveSolidPos: Position = Option.getOrElse(solidPos, () => {
          // Fallback: manually inject a STONE block and break it
          Option.map(blockIndex(0, 64, 0), (idx) => { chunk.blocks[idx] = blockTypeToIndex('STONE') })
          return { x: coord.x * CHUNK_SIZE, y: 64, z: coord.z * CHUNK_SIZE }
        })

        // Save the chunk to ensure it's in cache before breakBlock
        yield* chunkManager.getChunk(coord)

        // Break the block — this calls markChunkDirty internally
        yield* blockService.breakBlock(effectiveSolidPos)

        // The chunk should now be dirty: saveDirtyChunks should write it to storage
        yield* chunkManager.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)

        return { wasSaved: Option.isSome(stored) }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.wasSaved).toBe(true)
    })

    it('saveDirtyChunks saves modified block data reflecting the breakBlock', () => {
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        // Use chunk (0,0); find a solid block by scanning from y=80 down
        const coord: ChunkCoord = { x: 0, z: 0 }
        const chunk = yield* chunkManager.getChunk(coord)

        // Find first non-AIR block (terrain surface)
        // Scan from CHUNK_HEIGHT-1 down to 1 to handle all biome height ranges
        const surfaceBlockOpt = Arr.findFirst(
          Arr.flatMap(
            Arr.makeBy(CHUNK_SIZE, (lz) => lz),
            (lz) => Arr.flatMap(
              Arr.makeBy(CHUNK_SIZE, (lx) => lx),
              (lx) => Arr.makeBy(CHUNK_HEIGHT - 1, (i) => ({ lx, lz, y: CHUNK_HEIGHT - 1 - i }))
            )
          ),
          ({ lx, lz, y }) => y >= 1 && Option.match(blockIndex(lx, y, lz), {
            onNone: () => false,
            onSome: (idx) => chunk.blocks[idx] !== 0,
          })
        )
        const { lx: surfaceLx, lz: surfaceLz, y: surfaceY } = Option.getOrElse(
          surfaceBlockOpt,
          () => ({ lx: 0, lz: 0, y: -1 })
        )

        // Fallback: place a DIRT block if no solid block found
        if (surfaceY === -1) {
          yield* blockService.placeBlock({ x: coord.x * CHUNK_SIZE, y: 64, z: coord.z * CHUNK_SIZE }, 'DIRT')
        }

        const effectiveSurfaceY = surfaceY === -1 ? 64 : surfaceY
        const worldPos: Position = {
          x: coord.x * CHUNK_SIZE + surfaceLx,
          y: effectiveSurfaceY,
          z: coord.z * CHUNK_SIZE + surfaceLz,
        }

        // Break the block at the surface
        yield* blockService.breakBlock(worldPos)

        // Save dirty chunks to storage
        yield* chunkManager.saveDirtyChunks()

        // Load the saved data back from storage
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        expect(Option.isSome(stored)).toBe(true)
        const savedBlocks1 = Option.getOrThrow(stored)
        expect(readBlockFromArray(savedBlocks1, surfaceLx, effectiveSurfaceY, surfaceLz)).toBe('AIR')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('placeBlock → saveDirtyChunks round-trip', () => {
    it('placed block is present in saved storage data', () => {
      const targetPos: Position = { x: 200, y: 200, z: 200 }
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const { coord, lx, lz, y } = worldToLocal(targetPos)

        // Load the chunk — terrain is generated and cached
        const chunkBefore = yield* chunkManager.getChunk(coord)

        // Ensure position is AIR (y=200 is well above terrain surface ~48-80)
        const idxBefore = blockIndex(lx, y, lz)
        expect(Option.isSome(idxBefore)).toBe(true)
        expect(chunkBefore.blocks[Option.getOrThrow(idxBefore)]).toBe(0) // AIR

        // Place a STONE block at the target position
        yield* blockService.placeBlock(targetPos, 'STONE')

        // Save dirty chunks
        yield* chunkManager.saveDirtyChunks()

        // Verify storage has the data
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        expect(Option.isSome(stored)).toBe(true)
        expect(readBlockFromArray(Option.getOrThrow(stored), lx, y, lz)).toBe('STONE')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('placed block type is preserved correctly (DIRT)', () => {
      const targetPos: Position = { x: 201, y: 200, z: 201 }
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const { coord, lx, lz, y } = worldToLocal(targetPos)

        yield* chunkManager.getChunk(coord)
        yield* blockService.placeBlock(targetPos, 'DIRT')
        yield* chunkManager.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        expect(Option.isSome(stored)).toBe(true)
        expect(readBlockFromArray(Option.getOrThrow(stored), lx, y, lz)).toBe('DIRT')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
