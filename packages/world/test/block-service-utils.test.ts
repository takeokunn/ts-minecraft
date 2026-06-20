import { describe,it } from '@effect/vitest'
import { PLAYER_HALF_HEIGHT,PLAYER_HALF_WIDTH,Position } from '@ts-minecraft/core'
import {
blockOverlapsPlayer,
BlockService,
BlockServiceError,
worldToBlockLocal,
} from '@ts-minecraft/world'
import { Array as Arr,Effect,Option } from 'effect'
import { expect } from 'vitest'
import {
assertLeft,
createFailingChunkManagerService,
createFluidRecorder,
createMockChunkManagerService,
createMockHotbarService,
createMockPlayerService,
createTestLayer,
readBlock,
worldToLocal
} from './block-service-test-utils'

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('worldToBlockLocal', () => {
  it('positive coordinates map to correct chunk and local offsets', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: 17, y: 0, z: 5 })
    expect(chunkCoord).toEqual({ x: 1, z: 0 })
    expect(lx).toBe(1)   // 17 % 16 = 1
    expect(lz).toBe(5)   // 5 % 16 = 5
  })

  it('position at chunk boundary maps to lx=0', () => {
    const { chunkCoord, lx } = worldToBlockLocal({ x: 16, y: 0, z: 0 })
    expect(chunkCoord.x).toBe(1)
    expect(lx).toBe(0)
  })

  it('negative coordinates use double-modulo (no negative local offsets)', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: -1, y: 0, z: -1 })
    expect(chunkCoord).toEqual({ x: -1, z: -1 })
    expect(lx).toBe(15)  // (-1 % 16 + 16) % 16 = 15
    expect(lz).toBe(15)
  })

  it('world (0,0) maps to chunk (0,0) with lx=0 lz=0', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: 0, y: 0, z: 0 })
    expect(chunkCoord).toEqual({ x: 0, z: 0 })
    expect(lx).toBe(0)
    expect(lz).toBe(0)
  })
})

describe('blockOverlapsPlayer — AABB collision (pure)', () => {
  // Player AABB: half-width=0.3, half-height=0.9
  // Block AABB: unit cube, center = blockPos + 0.5

  it('overlaps when block center is within player AABB', () => {
    // Player feet at (0,0,0), player center = (0, 0.9, 0)
    // Block at (0,0,0): center = (0.5, 0.5, 0.5)
    expect(blockOverlapsPlayer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true)
  })

  it('does not overlap when block is far away on X axis', () => {
    // overlapX: |2.5 - 0| = 2.5 < 0.8 → false
    expect(blockOverlapsPlayer({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
  })

  it('does not overlap when block is 2 blocks above player (Y axis)', () => {
    // Player center Y = 0.9; block center Y = 3.5; |3.5 - 0.9| = 2.6 > 1.4 → false
    expect(blockOverlapsPlayer({ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
  })

  it('overlaps when all three axes overlap', () => {
    // Player at (5,0,5); block at (5,0,5): center=(5.5,0.5,5.5), playerCenter=(5,0.9,5)
    // X: |5.5-5|=0.5 < 0.8 ✓  Y: |0.5-0.9|=0.4 < 1.4 ✓  Z: |5.5-5|=0.5 < 0.8 ✓
    expect(blockOverlapsPlayer({ x: 5, y: 0, z: 5 }, { x: 5, y: 0, z: 5 })).toBe(true)
  })

  it('exported constants match physics-service expectations', () => {
    expect(PLAYER_HALF_WIDTH).toBe(0.3)
    expect(PLAYER_HALF_HEIGHT).toBe(0.9)
  })

  const axisTable: ReadonlyArray<readonly [string, Position, Position, boolean]> = [
    ['overlap on all 3 axes',                 { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true],
    ['separated on X',                        { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, false],
    ['separated on Z',                        { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 0 }, false],
    ['separated on Y (block above player)',   { x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 }, false],
    // blockCenterX=0.5, threshold=0.8 → player must be at x≥1.31 to NOT overlap.
    // Bracket the threshold from both sides so its LOCATION (0.8 = blockHalf +
    // PLAYER_HALF_WIDTH) is pinned — this is the suffocation guard's boundary:
    // a block flush against the player must stay placeable, one inside must not.
    ['X just beyond threshold (player at 1.31) → placeable', { x: 0, y: 0, z: 0 }, { x: 1.31, y: 0, z: 0 }, false],
    ['X just inside threshold (player at 1.29) → blocked', { x: 0, y: 0, z: 0 }, { x: 1.29, y: 0, z: 0 }, true],
  ] as const

  Arr.forEach(axisTable, ([desc, blockPos, playerPos, expected]) => {
    it(desc, () => {
      expect(blockOverlapsPlayer(blockPos, playerPos)).toBe(expected)
    })
  })
})

// ─── BlockServiceError ────────────────────────────────────────────────────────

describe('BlockServiceError', () => {
  it('includes operation and reason in message', () => {
    const err = new BlockServiceError({ operation: 'breakBlock', reason: 'Test error' })
    expect(err._tag).toBe('BlockServiceError')
    expect(err.message).toContain('breakBlock')
    expect(err.message).toContain('Test error')
  })

  it('appends cause message when present', () => {
    const cause = new Error('root cause')
    const err = new BlockServiceError({ operation: 'placeBlock', reason: 'failed', cause })
    expect(err.message).toContain('root cause')
  })

  it('is catchable with Effect.catchTag', () => {
    expect(new BlockServiceError({ operation: 'test', reason: 'msg' })._tag).toBe('BlockServiceError')
  })
})

// ─── BlockService integration tests ──────────────────────────────────────────

describe('BlockService — interface', () => {
  it.effect('exposes breakBlock and placeBlock', () => {
    const { service } = createMockChunkManagerService()
    const layer = createTestLayer(service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(typeof svc.breakBlock).toBe('function')
      expect(typeof svc.placeBlock).toBe('function')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService.breakBlock', () => {
  it.effect('sets the block to AIR in chunk storage', () => {
    const pos: Position = { x: 1, y: 2, z: 3 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('does not affect adjacent blocks', () => {
    const pos0: Position = { x: 0, y: 0, z: 0 }
    const pos1: Position = { x: 1, y: 0, z: 0 }
    const handle = createMockChunkManagerService([
      { pos: pos0, blockType: 'STONE' },
      { pos: pos1, blockType: 'DIRT' },
    ])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), undefined, undefined, createMockHotbarService(Option.some('WOODEN_PICKAXE')))
    const { lx: lx1, lz: lz1, y: y1 } = worldToLocal(pos1)
    const chunk1 = handle.getChunkForPos(pos1)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos0))
      expect(readBlock(chunk1, lx1, y1, lz1)).toBe('DIRT')
    }).pipe(Effect.provide(layer))
  })

  it.effect('calls removeWater and notifyBlockChanged when breaking water', () => {
    const pos: Position = { x: 1, y: 2, z: 3 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'WATER' }])
    const fluid = createFluidRecorder()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), fluid.service)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(fluid.calls.removeWater).toEqual([pos])
      expect(fluid.calls.notify).toEqual([pos])
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with "No block at position" when breaking AIR', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 5, y: 5, z: 5 })))
      const err = assertLeft(result)
      expect(err).toBeInstanceOf(BlockServiceError)
      expect(err.message).toContain('No block at position')
      expect(err.message).toContain('5')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with "No block at position" including coordinates', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 3, y: 7, z: 9 })))
      const err = assertLeft(result)
      expect(err.message).toContain('3')
      expect(err.message).toContain('7')
      expect(err.message).toContain('9')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when chunk manager fails', () => {
    const layer = createTestLayer(createFailingChunkManagerService(), createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: 0, z: 0 })))
      const err = assertLeft(result) as BlockServiceError
      expect(err).toBeInstanceOf(BlockServiceError)
      expect(err.operation).toBe('breakBlock')
    }).pipe(Effect.provide(layer))
  })

  it.effect('handles negative coordinates', () => {
    const pos: Position = { x: -3, y: 5, z: -7 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), undefined, undefined, createMockHotbarService(Option.some('WOODEN_PICKAXE')))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('handles y=255 (max height)', () => {
    const pos: Position = { x: 0, y: 255, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GLASS' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with BlockServiceError at y=256 (out of bounds)', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: 256, z: 0 })))
      expect(assertLeft(result)).toBeInstanceOf(BlockServiceError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with BlockServiceError at y=-1 (out of bounds)', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: -1, z: 0 })))
      expect(assertLeft(result)).toBeInstanceOf(BlockServiceError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('second break on the same position fails (block is now AIR)', () => {
    const pos: Position = { x: 5, y: 5, z: 5 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos)))
      expect(assertLeft(result).message).toContain('No block at position')
    }).pipe(Effect.provide(layer))
  })
})
