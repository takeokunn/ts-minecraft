import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex, ChunkCoord, DEFAULT_WORLD_ID, Position } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world'
import { BlockService } from '@ts-minecraft/world'
import {
  buildIntegrationLayer,
  buildSecondSessionLayer,
  worldToLocal,
  readBlockFromArray,
} from './block-cycle-test-utils'

describe('integration/block-cycle', () => {
  describe('block state persists across ChunkManager sessions', () => {
    it('breakBlock → save → new session → load: block is AIR', () => {
      // Simulates: player breaks a block, game saves, game reloads, block is still AIR
      const { TestLayer, storage } = buildIntegrationLayer()
      const secondSessionLayer = buildSecondSessionLayer(storage)

      // Session 1: break a surface block and save
      const session1 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const coord: ChunkCoord = { x: 0, z: 0 }
        const chunk = yield* chunkManager.getChunk(coord)

        // Find the first solid block (terrain surface)
        // Scan from CHUNK_HEIGHT-1 down to 1 to handle all biome height ranges
        const surfaceBlockOpt = Arr.findFirst(
          Arr.flatMap(
            Arr.makeBy(CHUNK_SIZE, (lz) => lz),
            (lz) => Arr.flatMap(
              Arr.makeBy(CHUNK_SIZE, (lx) => lx),
              (lx) => Arr.makeBy(CHUNK_HEIGHT - 1, (i) => ({ lx, lz, y: CHUNK_HEIGHT - 1 - i }))
            )
          ),
          ({ lx, lz, y }) => {
            if (y < 1) return false
            const idx = Option.getOrNull(blockIndex(lx, y, lz))
            return idx !== null && chunk.blocks[idx] !== 0
          }
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

        yield* blockService.breakBlock(worldPos)
        yield* chunkManager.saveDirtyChunks()

        return { coord, surfaceLx, surfaceY: effectiveSurfaceY, surfaceLz }
      }).pipe(Effect.provide(TestLayer))

      const { coord: savedCoord, surfaceLx: savedSurfaceLx, surfaceY: savedSurfaceY, surfaceLz: savedSurfaceLz } = Effect.runSync(session1)

      // Session 2: load the same chunk from storage (new ChunkManagerService instance)
      const session2 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService

        // Storage has the saved data; getChunk should load from storage (not regenerate)
        const chunk = yield* chunkManager.getChunk(savedCoord)

        const blockType = readBlockFromArray(chunk.blocks, savedSurfaceLx, savedSurfaceY, savedSurfaceLz)
        return { blockType }
      }).pipe(Effect.provide(secondSessionLayer))

      const result = Effect.runSync(session2)
      expect(result.blockType).toBe('AIR')
    })

    it('placeBlock → save → new session → load: placed block is present', () => {
      const targetPos: Position = { x: 0, y: 200, z: 0 }
      const { TestLayer, storage } = buildIntegrationLayer()
      const secondSessionLayer = buildSecondSessionLayer(storage)

      const { coord, lx, lz, y } = worldToLocal(targetPos)

      // Session 1: place a WOOD block at a high altitude (guaranteed AIR) and save
      const session1 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        yield* chunkManager.getChunk(coord)
        yield* blockService.placeBlock(targetPos, 'WOOD')
        yield* chunkManager.saveDirtyChunks()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      Effect.runSync(session1)

      // Session 2: load chunk from storage and verify the WOOD block is there
      const session2 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService

        const chunk = yield* chunkManager.getChunk(coord)
        const blockType = readBlockFromArray(chunk.blocks, lx, y, lz)
        return { blockType }
      }).pipe(Effect.provide(secondSessionLayer))

      const result = Effect.runSync(session2)
      expect(result.blockType).toBe('WOOD')
    })

    it('clean chunk (no modifications) is NOT saved to storage after saveDirtyChunks', () => {
      const { TestLayer, storage } = buildIntegrationLayer()

      const result = Effect.runSync(
        Effect.gen(function* () {
          const chunkManager = yield* ChunkManagerService

          yield* chunkManager.getChunk({ x: 5, z: 5 })
          yield* chunkManager.saveDirtyChunks()

          const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 5, z: 5 })
          return { wasStored: Option.isSome(stored) }
        }).pipe(Effect.provide(TestLayer))
      )

      expect(result.wasStored).toBe(false)
    })

    it('unloadChunk auto-saves dirty chunk without explicit saveDirtyChunks', () => {
      const targetPos: Position = { x: 0, y: 200, z: 0 }
      const { TestLayer, storage } = buildIntegrationLayer()
      const { coord } = worldToLocal(targetPos)

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        yield* chunkManager.getChunk(coord)
        yield* blockService.placeBlock(targetPos, 'GLASS')

        // unloadChunk should auto-save the dirty chunk without calling saveDirtyChunks
        yield* chunkManager.unloadChunk(coord)

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        return { wasSaved: Option.isSome(stored) }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.wasSaved).toBe(true)
    })
  })
})
