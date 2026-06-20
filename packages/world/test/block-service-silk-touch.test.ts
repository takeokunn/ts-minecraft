import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { BlockService } from '@ts-minecraft/world'
import {
  createMockChunkManagerService,
  createMockHotbarService,
  createMockInventoryService,
  createMockPlayerService,
  createTestLayer,
} from './block-service-test-utils'

const TARGET_POS = { x: 0, y: 64, z: 0 } as const
const PLAYER_POS = { x: 100, y: 100, z: 100 } as const
const DIAMOND_PICKAXE = 'DIAMOND_PICKAXE' as const

const makeDiamondOreBreakLayer = (addBlock: ReturnType<typeof vi.fn>) => {
  const chunkManager = createMockChunkManagerService([{ pos: TARGET_POS, blockType: 'DIAMOND_ORE' }])
  return createTestLayer(
    chunkManager.service,
    createMockPlayerService(PLAYER_POS),
    undefined,
    createMockInventoryService({ addBlock }),
    createMockHotbarService(Option.some(DIAMOND_PICKAXE)),
  )
}

const makeIceBreakLayer = (addBlock: ReturnType<typeof vi.fn>) => {
  const chunkManager = createMockChunkManagerService([{ pos: TARGET_POS, blockType: 'ICE' }])
  return createTestLayer(
    chunkManager.service,
    createMockPlayerService(PLAYER_POS),
    undefined,
    createMockInventoryService({ addBlock }),
    createMockHotbarService(Option.some(DIAMOND_PICKAXE)),
  )
}

const breakDiamondOre = (addBlock: ReturnType<typeof vi.fn>, silkTouch = false) =>
  Effect.gen(function* () {
    const svc = yield* BlockService
    yield* svc.breakBlock(TARGET_POS, silkTouch)
  }).pipe(Effect.provide(makeDiamondOreBreakLayer(addBlock)))

const breakIce = (addBlock: ReturnType<typeof vi.fn>, silkTouch = false) =>
  Effect.gen(function* () {
    const svc = yield* BlockService
    yield* svc.breakBlock(TARGET_POS, silkTouch)
  }).pipe(Effect.provide(makeIceBreakLayer(addBlock)))

describe('BlockService.breakBlock — SILK_TOUCH', () => {
  it.effect('drops DIAMOND_ORE itself when silkTouch=true, not DIAMOND', () =>
    Effect.gen(function* () {
      const addBlockSpy = vi.fn(() => Effect.void)
      yield* breakDiamondOre(addBlockSpy, true)
      expect(addBlockSpy).toHaveBeenCalledWith('DIAMOND_ORE', 1)
      expect(addBlockSpy).not.toHaveBeenCalledWith('DIAMOND', expect.anything())
    }))

  it.effect('drops DIAMOND (processed item) without silkTouch', () =>
    Effect.gen(function* () {
      const addBlockSpy = vi.fn(() => Effect.void)
      yield* breakDiamondOre(addBlockSpy)
      expect(addBlockSpy).toHaveBeenCalledWith('DIAMOND', 1)
      expect(addBlockSpy).not.toHaveBeenCalledWith('DIAMOND_ORE', expect.anything())
    }))

  it.effect('does not drop ICE without silkTouch', () =>
    Effect.gen(function* () {
      const addBlockSpy = vi.fn(() => Effect.void)
      yield* breakIce(addBlockSpy)
      expect(addBlockSpy).not.toHaveBeenCalled()
    }))

  it.effect('drops ICE itself when silkTouch=true', () =>
    Effect.gen(function* () {
      const addBlockSpy = vi.fn(() => Effect.void)
      yield* breakIce(addBlockSpy, true)
      expect(addBlockSpy).toHaveBeenCalledWith('ICE', 1)
    }))
})
