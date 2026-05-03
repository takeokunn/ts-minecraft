import { describe,it } from '@effect/vitest'
import { BlockType,Position,SlotIndex } from '@ts-minecraft/kernel'
import {
BlockService,
BlockServiceError,
} from '@ts-minecraft/terrain'
import { Effect } from 'effect'
import { expect,vi } from 'vitest'
import {
assertLeft,
createFailingChunkManagerService,
createFailingPlayerService,
createFluidRecorder,
createMockChunkManagerService,
createMockInventoryService,
createMockPlayerService,
createTestLayer,
readBlock,
worldToLocal,
} from './block-service-test-utils'

describe('BlockService.placeBlock', () => {
  it.effect('writes the block type into chunk storage', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService()
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT'))
      expect(readBlock(chunk, lx, y, lz)).toBe('DIRT')
    }).pipe(Effect.provide(layer))
  })

  it.effect('calls seedWater and notifyBlockChanged when placing water', () => {
    const pos: Position = { x: 2, y: 3, z: 4 }
    const handle = createMockChunkManagerService()
    const fluid = createFluidRecorder()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), fluid.service)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'WATER'))
      expect(fluid.calls.seed).toEqual([pos])
      expect(fluid.calls.notify).toEqual([pos])
    }).pipe(Effect.provide(layer))
  })

  it.effect('calls removeBlock with blockType and count=1', () => {
    const pos: Position = { x: 6, y: 3, z: 4 }
    const spy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ removeBlock: spy }),
    )
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE'))
      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith('STONE', 1, undefined)
    }).pipe(Effect.provide(layer))
  })

  it.effect('passes preferred slot to removeBlock', () => {
    const pos: Position = { x: 8, y: 3, z: 4 }
    const spy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ removeBlock: spy }),
    )
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE', SlotIndex.make(31)))
      expect(spy).toHaveBeenCalledWith('STONE', 1, 31)
    }).pipe(Effect.provide(layer))
  })

  it.effect('rolls back and fails when inventory has no matching block', () => {
    const pos: Position = { x: 7, y: 3, z: 4 }
    const handle = createMockChunkManagerService()
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ removeBlock: () => Effect.succeed(false) }),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE')))
      expect(assertLeft(result).message).toContain('available in inventory')
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when position already has a block', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GRASS' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
      expect(err.message).toContain('Block already exists at position')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when position overlaps player AABB', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 0, y: 0, z: 0 }),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
      expect(err.message).toContain('Cannot place block inside player')
    }).pipe(Effect.provide(layer))
  })

  it.effect('succeeds when block is outside player AABB (2 blocks away on X)', () => {
    const pos: Position = { x: 2, y: 0, z: 0 }
    const handle = createMockChunkManagerService()
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 0, y: 0, z: 0 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'SAND'))
      expect(readBlock(chunk, lx, y, lz)).toBe('SAND')
    }).pipe(Effect.provide(layer))
  })

  it.effect('succeeds when block is 3+ blocks above player (Y separation)', () => {
    const pos: Position = { x: 0, y: 3, z: 0 }
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 0, y: 0, z: 0 }),
    )
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT'))
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when chunk manager fails', () => {
    const layer = createTestLayer(createFailingChunkManagerService(), createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock({ x: 0, y: 0, z: 0 }, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when player service fails', () => {
    const layer = createTestLayer(createMockChunkManagerService().service, createFailingPlayerService())
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock({ x: 0, y: 0, z: 0 }, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
      expect(err.message).toContain('Player position error')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails at y=-1 (out of bounds)', () => {
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock({ x: 0, y: -1, z: 0 }, 'STONE')))
      expect(assertLeft(result)).toBeInstanceOf(BlockServiceError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('places all common block types', () => {
    const blockTypes: ReadonlyArray<BlockType> = ['DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'LEAVES', 'GLASS']
    return Effect.forEach(blockTypes, (blockType, i) => {
      const pos: Position = { x: i * 2, y: 0, z: 0 }
      const handle = createMockChunkManagerService()
      const { lx, lz, y } = worldToLocal(pos)
      const chunk = handle.getChunkForPos(pos)
      const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
      return Effect.gen(function* () {
        yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, blockType))
        expect(readBlock(chunk, lx, y, lz)).toBe(blockType)
      }).pipe(Effect.provide(layer))
    }, { concurrency: 1, discard: true })
  })
})
