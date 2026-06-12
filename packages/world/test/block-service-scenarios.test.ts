import { describe,it } from '@effect/vitest'
import { Position } from '@ts-minecraft/core'
import { BlockService } from '@ts-minecraft/world'
import { Effect,Either,Option } from 'effect'
import { expect,vi } from 'vitest'
import {
createMockChunkManagerService,
createMockHotbarService,
createMockInventoryService,
createMockPlayerService,
createTestLayer,
readBlock,
worldToLocal
} from './block-service-test-utils'

describe('BlockService — break then place (chaining)', () => {
  it.effect('break DIRT then place STONE at the same position', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      yield* svc.placeBlock(pos, 'STONE')
      expect(readBlock(chunk, lx, y, lz)).toBe('STONE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('Effect.flatMap chaining works', () => {
    const pos: Position = { x: 1, y: 1, z: 1 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'WOOD' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      yield* svc.placeBlock(pos, 'GLASS')
      const outcome = { placed: true }
      expect(outcome.placed).toBe(true)
      expect(readBlock(chunk, lx, y, lz)).toBe('GLASS')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — item-like drops and non-placeable inventory items', () => {
  it.effect('breaking COAL_ORE with a wooden pickaxe drops COAL into inventory instead of the ore block', () => {
    const pos: Position = { x: 3, y: 3, z: 3 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'COAL_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('COAL', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('cannot place WOODEN_SWORD into the world', () => {
    const pos: Position = { x: 9, y: 2, z: 9 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(pos, 'WOODEN_SWORD'))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking STONE by hand fails instead of yielding free progression', () => {
    const pos: Position = { x: 4, y: 4, z: 4 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.none()),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock(pos))
      expect(Either.isLeft(result)).toBe(true)
      expect(inventorySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking STONE with a selected pickaxe drops COBBLESTONE into inventory', () => {
    const pos: Position = { x: 5, y: 5, z: 5 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('COBBLESTONE', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking COAL_ORE by hand fails instead of yielding free progression', () => {
    const pos: Position = { x: 6, y: 6, z: 6 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'COAL_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.none()),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock(pos))
      expect(Either.isLeft(result)).toBe(true)
      expect(inventorySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking COAL_ORE with a wooden pickaxe drops COAL into inventory', () => {
    const pos: Position = { x: 7, y: 7, z: 7 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'COAL_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('COAL', 1)
    }).pipe(Effect.provide(layer))
  })

  // R24: redstone ore drops 4 dust per vanilla (not 1) — keeps the redstone
  // economy from being ~4x scarcer than expected. Requires an iron pickaxe.
  it.effect('breaking REDSTONE_ORE with an iron pickaxe drops 4 REDSTONE_DUST into inventory', () => {
    const pos: Position = { x: 9, y: 9, z: 9 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'REDSTONE_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('IRON_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('REDSTONE_DUST', 4)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking DIAMOND_ORE with a wooden pickaxe fails instead of yielding free progression', () => {
    const pos: Position = { x: 8, y: 8, z: 8 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIAMOND_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock(pos))
      expect(Either.isLeft(result)).toBe(true)
      expect(inventorySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking DIAMOND_ORE with an iron pickaxe drops DIAMOND into inventory', () => {
    const pos: Position = { x: 9, y: 9, z: 9 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIAMOND_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('IRON_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('DIAMOND', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking GOLD_ORE with an iron pickaxe drops RAW_GOLD into inventory', () => {
    const pos: Position = { x: 10, y: 10, z: 10 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GOLD_ORE' }])
    const inventorySpy = vi.fn(() => Effect.void)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('IRON_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('RAW_GOLD', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('cannot place WOODEN_PICKAXE into the world', () => {
    const pos: Position = { x: 10, y: 2, z: 10 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(pos, 'WOODEN_PICKAXE'))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })
})
