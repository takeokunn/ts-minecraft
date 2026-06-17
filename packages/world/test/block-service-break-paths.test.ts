import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { CHUNK_HEIGHT, type BlockType, type InventoryItem, type Position } from '@ts-minecraft/core'
import { InventoryError } from '@ts-minecraft/inventory/domain/errors'
import { BlockService } from '../application/block-service'
import { FluidService } from '../application/fluid-service'
import type { ChunkService } from '../application/chunk-service'
import { BlockServiceError } from '../application/block-service-error'
import { removeUnsupportedCascade } from '../application/block-service-support'
import { worldPositionFor } from '../domain/chunk-coord-utils'
import { makeBreakBlock } from '../application/block-service-break'
import {
  assertLeft,
  createFailingChunkManagerService,
  createMockChunkManagerService,
  createMockInventoryService,
  createMockPlayerService,
  createTestLayer,
  makeEmptyChunk,
  readBlock,
  writeBlock,
  worldToLocal,
} from './block-service-test-utils'

const playerPosition: Position = { x: 100, y: 70, z: 100 }

const makeFluidRecorder = () => {
  const calls = {
    notify: [] as Position[],
    removeLava: [] as Position[],
    removeWater: [] as Position[],
  }
  const service = FluidService.of({
    _tag: '@minecraft/application/FluidService' as const,
    notifyBlockChanged: (pos: Position) => Effect.sync(() => { calls.notify.push(pos) }),
    seedWater: () => Effect.void,
    seedLava: () => Effect.void,
    removeWater: (pos: Position) => Effect.sync(() => { calls.removeWater.push(pos) }),
    removeLava: (pos: Position) => Effect.sync(() => { calls.removeLava.push(pos) }),
    syncLoadedChunks: () => Effect.void,
    tick: () => Effect.void,
  })
  return { calls, service }
}

const makeDirectBreakBlock = (chunkService: ChunkService) => {
  const chunk = makeEmptyChunk({ x: 0, z: 0 })
  const markedDirty: Array<ReadonlyArray<{ readonly lx: number; readonly y: number; readonly lz: number }> | undefined> = []
  const breakBlock = makeBreakBlock({
    chunkManagerService: {
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: (_coord, dirtyVoxels) => Effect.sync(() => { markedDirty.push(dirtyVoxels) }),
    },
    chunkService,
    fluidService: {
      notifyBlockChanged: () => Effect.void,
      removeLava: () => Effect.void,
      removeWater: () => Effect.void,
    },
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(Option.none<InventoryItem>()),
    },
    inventoryService: {
      addBlock: () => Effect.void,
    },
    containers: {
      dismantleChest: () => Effect.succeed(true),
      dismantleFurnace: () => Effect.succeed(true),
    },
  })

  return { breakBlock, chunk, markedDirty }
}

describe('BlockService breakBlock focused paths', () => {
  it.effect('maps chunk loading failure to a block service error', () => {
    const layer = createTestLayer(
      createFailingChunkManagerService(),
      createMockPlayerService(playerPosition),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(
        (yield* BlockService).breakBlock({ x: 1, y: 64, z: 1 }),
      )

      const error = assertLeft(result)
      expect(error).toBeInstanceOf(BlockServiceError)
      expect(error.operation).toBe('breakBlock')
      expect(error.reason).toContain('Failed to load chunk')
    }).pipe(Effect.provide(layer))
  })

  it.effect('reports air blocks as absent targets', () => {
    const manager = createMockChunkManagerService()
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(
        (yield* BlockService).breakBlock({ x: 1, y: 64, z: 1 }),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('No block at position')
    }).pipe(Effect.provide(layer))
  })

  it.effect('removes the lower half when breaking an upper door block', () => {
    const lower: Position = { x: 2, y: 64, z: 2 }
    const upper: Position = { x: 2, y: 65, z: 2 }
    const manager = createMockChunkManagerService([
      { pos: lower, blockType: 'DOOR' },
      { pos: upper, blockType: 'DOOR' },
    ])
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
    )
    return Effect.gen(function* () {
      yield* (yield* BlockService).breakBlock(upper)

      const chunk = manager.getChunkForPos(lower)
      const lowerLocal = worldToLocal(lower)
      const upperLocal = worldToLocal(upper)
      expect(readBlock(chunk, lowerLocal.lx, lowerLocal.y, lowerLocal.lz)).toBe('AIR')
      expect(readBlock(chunk, upperLocal.lx, upperLocal.y, upperLocal.lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('removes lava sources and notifies every removed support-dependent block', () => {
    const lava: Position = { x: 3, y: 64, z: 3 }
    const torch: Position = { x: 3, y: 65, z: 3 }
    const manager = createMockChunkManagerService([
      { pos: lava, blockType: 'LAVA' },
      { pos: torch, blockType: 'TORCH' },
    ])
    const fluid = makeFluidRecorder()
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
      fluid.service,
    )
    return Effect.gen(function* () {
      yield* (yield* BlockService).breakBlock(lava)

      expect(fluid.calls.removeLava).toEqual([lava])
      expect(fluid.calls.removeWater).toEqual([])
      expect(fluid.calls.notify).toEqual([lava, torch])
    }).pipe(Effect.provide(layer))
  })

  it.effect('removes water sources and notifies the changed block', () => {
    const water: Position = { x: 6, y: 64, z: 6 }
    const manager = createMockChunkManagerService([{ pos: water, blockType: 'WATER' }])
    const fluid = makeFluidRecorder()
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
      fluid.service,
    )
    return Effect.gen(function* () {
      yield* (yield* BlockService).breakBlock(water)

      expect(fluid.calls.removeWater).toEqual([water])
      expect(fluid.calls.removeLava).toEqual([])
      expect(fluid.calls.notify).toEqual([water])
    }).pipe(Effect.provide(layer))
  })

  it.effect('maps target block read failures', () => {
    const manager = createMockChunkManagerService()
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(
        (yield* BlockService).breakBlock({ x: 1, y: -1, z: 1 }),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('Failed to read block')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaks a single door block when no matching partner is present', () => {
    const door: Position = { x: 7, y: 64, z: 7 }
    const above: Position = { x: 7, y: 65, z: 7 }
    const manager = createMockChunkManagerService([{ pos: door, blockType: 'DOOR' }])
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
    )
    return Effect.gen(function* () {
      yield* (yield* BlockService).breakBlock(door)

      const chunk = manager.getChunkForPos(door)
      const doorLocal = worldToLocal(door)
      const aboveLocal = worldToLocal(above)
      expect(readBlock(chunk, doorLocal.lx, doorLocal.y, doorLocal.lz)).toBe('AIR')
      expect(readBlock(chunk, aboveLocal.lx, aboveLocal.y, aboveLocal.lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('maps upper door partner read failures', () =>
    Effect.gen(function* () {
      const chunkService = {
        getBlock: (_chunk: unknown, _lx: number, y: number) =>
          y === 64
            ? Effect.succeed('DOOR' as BlockType)
            : Effect.fail({ message: 'upper read failed' }),
      } as unknown as ChunkService
      const { breakBlock } = makeDirectBreakBlock(chunkService)

      const result = yield* Effect.either(
        breakBlock({ x: 0, y: 64, z: 0 }, false, { dropItems: false }),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('Failed to read upper door block')
    }),
  )

  it.effect('maps lower door partner read failures', () =>
    Effect.gen(function* () {
      const chunkService = {
        getBlock: (_chunk: unknown, _lx: number, y: number) => {
          if (y === 64) return Effect.succeed('DOOR' as BlockType)
          if (y === 65) return Effect.succeed('STONE' as BlockType)
          return Effect.fail({ message: 'lower read failed' })
        },
      } as unknown as ChunkService
      const { breakBlock } = makeDirectBreakBlock(chunkService)

      const result = yield* Effect.either(
        breakBlock({ x: 0, y: 64, z: 0 }, false, { dropItems: false }),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('Failed to read lower door block')
    }),
  )

  it.effect('keeps succeeding when a drop cannot be added back to inventory', () => {
    const target: Position = { x: 4, y: 64, z: 4 }
    const manager = createMockChunkManagerService([{ pos: target, blockType: 'DIRT' }])
    const inventory = createMockInventoryService({
      addBlock: () => Effect.fail(new InventoryError({ operation: 'addBlock', cause: 'full' })),
    })
    const layer = createTestLayer(
      manager.service,
      createMockPlayerService(playerPosition),
      makeFluidRecorder().service,
      inventory,
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(
        (yield* BlockService).breakBlock(target, false, { dropItems: true }),
      )

      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })
})

describe('block-service support helpers', () => {
  it('converts local removed block coordinates into world positions', () => {
    expect(worldPositionFor({ x: -2, z: 3 }, { lx: 5, y: 12, lz: 7 })).toEqual({
      x: -27,
      y: 12,
      z: 55,
    })
  })

  it.effect('maps dependent block read failures', () =>
    Effect.gen(function* () {
      const chunk = makeEmptyChunk({ x: 0, z: 0 })
      const chunkService = {
        getBlock: () => Effect.fail({ message: 'dependent read failed' }),
      } as unknown as ChunkService

      const result = yield* Effect.either(
        removeUnsupportedCascade(chunkService, chunk, [{ lx: 0, y: 64, lz: 0 }], 'test'),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('Failed to read dependent block')
    }),
  )

  it.effect('maps support block read failures', () =>
    Effect.gen(function* () {
      const chunk = makeEmptyChunk({ x: 0, z: 0 })
      const chunkService = {
        getBlock: (_chunk: unknown, _lx: number, y: number) =>
          y === 65
            ? Effect.succeed('TORCH' as BlockType)
            : Effect.fail({ message: 'support read failed' }),
      } as unknown as ChunkService

      const result = yield* Effect.either(
        removeUnsupportedCascade(chunkService, chunk, [{ lx: 0, y: 64, lz: 0 }], 'test'),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('Failed to read support block')
    }),
  )

  it.effect('maps dependent block removal failures', () =>
    Effect.gen(function* () {
      const chunk = makeEmptyChunk({ x: 0, z: 0 })
      const chunkService = {
        getBlock: (_chunk: unknown, _lx: number, y: number) =>
          y === -1
            ? Effect.succeed('TORCH' as BlockType)
            : Effect.succeed('AIR' as BlockType),
      } as unknown as ChunkService

      const result = yield* Effect.either(
        removeUnsupportedCascade(chunkService, chunk, [{ lx: 0, y: -2, lz: 0 }], 'test'),
      )

      const error = assertLeft(result)
      expect(error.reason).toContain('Dependent block coordinates out of bounds')
    }),
  )

  it.effect('does not read above the chunk height', () =>
    Effect.gen(function* () {
      const chunk = makeEmptyChunk({ x: 0, z: 0 })
      const chunkService = {
        getBlock: () => Effect.fail({ message: 'unexpected read' }),
      } as unknown as ChunkService

      const result = yield* Effect.either(
        removeUnsupportedCascade(chunkService, chunk, [{ lx: 0, y: CHUNK_HEIGHT - 1, lz: 0 }], 'test'),
      )

      expect(Either.isRight(result)).toBe(true)
    }),
  )

  it.effect('keeps support-sensitive blocks that still have support', () =>
    Effect.gen(function* () {
      const chunk = makeEmptyChunk({ x: 0, z: 0 })
      writeBlock(chunk, 0, 64, 0, 'DIRT')
      writeBlock(chunk, 0, 65, 0, 'TORCH')
      const chunkService = {
        getBlock: (_chunk: unknown, lx: number, y: number, lz: number) =>
          Effect.sync(() => readBlock(chunk, lx, y, lz)),
      } as unknown as ChunkService

      const result = yield* Effect.either(
        removeUnsupportedCascade(chunkService, chunk, [{ lx: 0, y: 64, lz: 0 }], 'test'),
      )

      expect(Either.isRight(result)).toBe(true)
      expect(readBlock(chunk, 0, 65, 0)).toBe('TORCH')
    }),
  )
})
