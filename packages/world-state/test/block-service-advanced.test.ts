import { describe, it } from '@effect/vitest'
import { vi, expect } from 'vitest'
import { Array as Arr, Effect, Layer, Metric, Option } from 'effect'
import { ChunkCoord, Position } from '@ts-minecraft/kernel'
import { BlockService, BlockServiceError } from '@ts-minecraft/terrain'
import { DEFAULT_WORLD_ID, DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import {
  assertLeft,
  createMockChunkManagerService,
  createMockPlayerService,
  createMockInventoryService,
  createMockHotbarService,
  createTestLayer,
} from './block-service-test-utils'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import type { ChunkManagerError } from '@ts-minecraft/terrain'
import { StorageError } from '../domain/errors'
import { ChunkServiceLive } from '@ts-minecraft/terrain'
import { BlockServiceLive } from '@ts-minecraft/terrain'
import { FluidService, InventoryService, HotbarService } from '@ts-minecraft/terrain'
import type { FurnaceService } from '@ts-minecraft/inventory'

const createLayerWithDirtyTracker = (pos: Position, dirtyFn: (...args: unknown[]) => unknown) => {
  const chunkHandle = createMockChunkManagerService()
  const markChunkDirtySpy = vi.fn(() => Effect.void)
  const serviceWithSpy = {
    ...chunkHandle.service,
    markChunkDirty: markChunkDirtySpy,
  } as unknown as ChunkManagerService
  const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
  return { layer, markChunkDirtySpy, chunkHandle }
}

describe('BlockService — Effect.Metric counters', () => {
  it.effect('blocks_broken counter increments when a block is broken', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    const counter = Metric.counter('blocks_broken')
    return Effect.gen(function* () {
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      const after = yield* Metric.value(counter)
      expect(after.count > before.count).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('blocks_placed counter increments when a block is placed', () => {
    const pos: Position = { x: 5, y: 0, z: 5 }
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    const counter = Metric.counter('blocks_placed')
    return Effect.gen(function* () {
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE'))
      const after = yield* Metric.value(counter)
      expect(after.count > before.count).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking multiple blocks increments the counter multiple times', () => {
    const positions: Position[] = [
      { x: 10, y: 0, z: 0 },
      { x: 11, y: 0, z: 0 },
      { x: 12, y: 0, z: 0 },
    ]
    const handle = createMockChunkManagerService(positions.map(p => ({ pos: p, blockType: 'DIRT' as const })))
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    const counter = Metric.counter('blocks_broken')
    return Effect.gen(function* () {
      const before = yield* Metric.value(counter)
      yield* Effect.forEach(positions, (pos) =>
        Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos)),
        { concurrency: 1 }
      )
      const after = yield* Metric.value(counter)
      expect(Number(after.count - before.count)).toBe(3)
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — catchTag', () => {
  it.effect('breakBlock on empty position is catchable via Effect.catchTag', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const tag = yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos)).pipe(
        Effect.catchTag('BlockServiceError', (e) => Effect.succeed(e._tag))
      )
      expect(tag).toBe('BlockServiceError')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock on occupied position is catchable via Effect.catchTag', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GRASS' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const tag = yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT')).pipe(
        Effect.catchTag('BlockServiceError', (e) => Effect.succeed(e._tag))
      )
      expect(tag).toBe('BlockServiceError')
    }).pipe(Effect.provide(layer))
  })

  it.effect('caught BlockServiceError has a non-empty message', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const msg = yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos)).pipe(
        Effect.catchTag('BlockServiceError', (e) => Effect.succeed(e.message))
      )
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — markChunkDirty integration', () => {
  it.effect('breakBlock calls markChunkDirty after success', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const markChunkDirtySpy = vi.fn(() => Effect.void)
    const serviceWithSpy = { ...handle.service, markChunkDirty: markChunkDirtySpy } as unknown as ChunkManagerService
    const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(markChunkDirtySpy).toHaveBeenCalledOnce()
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock calls markChunkDirty after success', () => {
    const pos: Position = { x: 3, y: 0, z: 3 }
    const handle = createMockChunkManagerService()
    const markChunkDirtySpy = vi.fn(() => Effect.void)
    const serviceWithSpy = { ...handle.service, markChunkDirty: markChunkDirtySpy } as unknown as ChunkManagerService
    const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE'))
      expect(markChunkDirtySpy).toHaveBeenCalledOnce()
    }).pipe(Effect.provide(layer))
  })

  it.effect('failed breakBlock does NOT call markChunkDirty', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService()
    const markChunkDirtySpy = vi.fn(() => Effect.void)
    const serviceWithSpy = { ...handle.service, markChunkDirty: markChunkDirtySpy } as unknown as ChunkManagerService
    const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos)))
      expect(markChunkDirtySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })
})

describe('Constants', () => {
  it('DEFAULT_WORLD_ID is "world-1"', () => {
    expect(DEFAULT_WORLD_ID).toBe('world-1')
  })

  it('DEFAULT_PLAYER_ID is "player-1"', () => {
    expect(DEFAULT_PLAYER_ID).toBe('player-1')
  })
})
