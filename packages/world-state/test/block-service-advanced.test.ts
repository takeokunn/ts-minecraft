import { describe,it } from '@effect/vitest'
import { DEFAULT_PLAYER_ID,DEFAULT_WORLD_ID,Position } from '@ts-minecraft/kernel'
import { BlockService,ChunkManagerService } from '@ts-minecraft/terrain'
import { Effect,Either,Metric } from 'effect'
import { expect,vi } from 'vitest'
import {
createMockChunkManagerService,
createMockPlayerService,
createTestLayer
} from './block-service-test-utils'

describe('BlockService — Effect.Metric counters', () => {
  it.effect('blocks_broken counter increments when a block is broken', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    const counter = Metric.counter('blocks_broken')
    return Effect.gen(function* () {
      const blockService = yield* BlockService
      const before = yield* Metric.value(counter)
      yield* blockService.breakBlock(pos)
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
      const blockService = yield* BlockService
      const before = yield* Metric.value(counter)
      yield* blockService.placeBlock(pos, 'STONE')
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
      const blockService = yield* BlockService
      const before = yield* Metric.value(counter)
      yield* Effect.forEach(positions, (pos) =>
        blockService.breakBlock(pos),
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
      const result = yield* BlockService.pipe(Effect.flatMap((svc) => svc.breakBlock(pos)), Effect.either)
      const tag = Either.match(result, {
        onLeft: (error) => error._tag,
        onRight: () => 'unexpected-success',
      })
      expect(tag).toBe('BlockServiceError')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock on occupied position is catchable via Effect.catchTag', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GRASS' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* BlockService.pipe(Effect.flatMap((svc) => svc.placeBlock(pos, 'DIRT')), Effect.either)
      const tag = Either.match(result, {
        onLeft: (error) => error._tag,
        onRight: () => 'unexpected-success',
      })
      expect(tag).toBe('BlockServiceError')
    }).pipe(Effect.provide(layer))
  })

  it.effect('caught BlockServiceError has a non-empty message', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* BlockService.pipe(Effect.flatMap((svc) => svc.breakBlock(pos)), Effect.either)
      const msg = Either.match(result, {
        onLeft: (error) => error.message,
        onRight: () => '',
      })
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
    const serviceWithSpy = { ...handle.service, markChunkDirty: markChunkDirtySpy } satisfies ChunkManagerService
    const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const blockService = yield* BlockService
      yield* blockService.breakBlock(pos)
      expect(markChunkDirtySpy).toHaveBeenCalledOnce()
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock calls markChunkDirty after success', () => {
    const pos: Position = { x: 3, y: 0, z: 3 }
    const handle = createMockChunkManagerService()
    const markChunkDirtySpy = vi.fn(() => Effect.void)
    const serviceWithSpy = { ...handle.service, markChunkDirty: markChunkDirtySpy } satisfies ChunkManagerService
    const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const blockService = yield* BlockService
      yield* blockService.placeBlock(pos, 'STONE')
      expect(markChunkDirtySpy).toHaveBeenCalledOnce()
    }).pipe(Effect.provide(layer))
  })

  it.effect('failed breakBlock does NOT call markChunkDirty', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService()
    const markChunkDirtySpy = vi.fn(() => Effect.void)
    const serviceWithSpy = { ...handle.service, markChunkDirty: markChunkDirtySpy } satisfies ChunkManagerService
    const layer = createTestLayer(serviceWithSpy, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const blockService = yield* BlockService
      yield* Effect.either(blockService.breakBlock(pos))
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
