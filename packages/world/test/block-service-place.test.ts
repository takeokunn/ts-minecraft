import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { BlockService } from '@ts-minecraft/world'
import { InventoryError } from '@ts-minecraft/inventory/domain/errors'
import { Position } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { FluidService } from '@ts-minecraft/world'
import {
  createFluidRecorder,
  createMockChunkManagerService,
  createMockInventoryService,
  createMockPlayerService,
  createTestLayer,
} from './block-service-test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TARGET_POS: Position = { x: 0, y: 64, z: 0 }
const FAR_PLAYER_POS: Position = { x: 100, y: 100, z: 100 }

const makePlaceLayer = (opts: {
  existingBlock?: BlockType
  playerPos?: Position
  removeBlockFails?: boolean
  fluidService?: FluidService
} = {}) => {
  const initialBlocks = opts.existingBlock && opts.existingBlock !== 'AIR'
    ? [{ pos: TARGET_POS, blockType: opts.existingBlock }]
    : undefined
  const chunkManager = createMockChunkManagerService(initialBlocks)
  const inventoryService = createMockInventoryService(opts.removeBlockFails
    ? {
        removeBlock: (itemType) =>
          Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `No ${itemType} available` })),
      }
    : undefined)

  return createTestLayer(
    chunkManager.service,
    createMockPlayerService(opts.playerPos ?? FAR_PLAYER_POS),
    opts.fluidService,
    inventoryService,
  )
}

const placeBlockEither = (
  layer: ReturnType<typeof createTestLayer>,
  position: Position,
  blockType: BlockType,
) =>
  Effect.gen(function* () {
    const svc = yield* BlockService
    return yield* Effect.either(svc.placeBlock(position, blockType))
  }).pipe(Effect.provide(layer))

describe('terrain/application/block-service placeBlock inventory rollback', () => {
  it.effect('placeBlock fails and rolls back when removeBlock fails', () => {
    const layer = makePlaceLayer({ removeBlockFails: true })
    return Effect.gen(function* () {
      const result = yield* placeBlockEither(layer, TARGET_POS, 'STONE')
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('placeBlock')
      expect(err.reason).toContain('No STONE available in inventory')
    })
  })

  it.effect('placeBlock on a non-air position fails with "Block already exists" error', () => {
    const layer = makePlaceLayer({ existingBlock: 'STONE' })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TARGET_POS, 'DIRT'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('Block already exists')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock with NON_PLACEABLE_BLOCK_TYPES fails', () => {
    const layer = makePlaceLayer()
    return Effect.gen(function* () {
      const result = yield* placeBlockEither(layer, TARGET_POS, 'DIAMOND')
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('cannot be placed')
    })
  })

  it.effect('placeBlock fails when block overlaps player position', () => {
    const layer = makePlaceLayer({ playerPos: TARGET_POS })
    return Effect.gen(function* () {
      const result = yield* placeBlockEither(layer, TARGET_POS, 'STONE')
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('inside player')
    })
  })

  it.effect('placeBlock WATER block triggers seedWater', () => {
    const fluid = createFluidRecorder()
    const layer = makePlaceLayer({ fluidService: fluid.service })
    return Effect.gen(function* () {
      const result = yield* placeBlockEither(layer, TARGET_POS, 'WATER')
      expect(Either.isRight(result)).toBe(true)
      expect(fluid.calls.seedWater).toEqual([TARGET_POS])
      expect(fluid.calls.seedLava).toEqual([])
    })
  })

  it.effect('placeBlock LAVA block triggers seedLava', () => {
    const fluid = createFluidRecorder()
    const layer = makePlaceLayer({ fluidService: fluid.service })
    return Effect.gen(function* () {
      const result = yield* placeBlockEither(layer, TARGET_POS, 'LAVA')
      expect(Either.isRight(result)).toBe(true)
      expect(fluid.calls.seedWater).toEqual([])
      expect(fluid.calls.seedLava).toEqual([TARGET_POS])
    })
  })
})
