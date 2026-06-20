import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { BlockService, BlockServiceError, FluidService } from '@ts-minecraft/world'
import { Position } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import {
  createFluidRecorder,
  createMockChunkManagerService,
  createMockPlayerService,
  createTestLayer,
} from './block-service-test-utils'

const TARGET_POS: Position = { x: 0, y: 64, z: 0 }
const PLAYER_POS: Position = { x: 100, y: 100, z: 100 }

const buildLayer = (blockType: BlockType = 'AIR', fluidService?: FluidService) => {
  const initialBlocks = blockType === 'AIR' ? [] : [{ pos: TARGET_POS, blockType }]
  const chunkManager = createMockChunkManagerService(initialBlocks)
  return createTestLayer(chunkManager.service, createMockPlayerService(PLAYER_POS), fluidService)
}

describe('terrain/application/block-service fluid placement hooks', () => {
  it.effect('placeBlock LAVA block triggers seedLava', () => {
    const fluid = createFluidRecorder()
    const layer = buildLayer('AIR', fluid.service)
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(Either.isRight(yield* Effect.either(svc.placeBlock(TARGET_POS, 'LAVA')))).toBe(true)
      expect(fluid.calls.seedLava).toEqual([TARGET_POS])
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on WATER block triggers removeWater', () => {
    const fluid = createFluidRecorder()
    const layer = buildLayer('WATER', fluid.service)
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(Either.isRight(yield* Effect.either(svc.breakBlock(TARGET_POS)))).toBe(true)
      expect(fluid.calls.removeWater).toEqual([TARGET_POS])
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on LAVA block triggers removeLava', () => {
    const fluid = createFluidRecorder()
    const layer = buildLayer('LAVA', fluid.service)
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(Either.isRight(yield* Effect.either(svc.breakBlock(TARGET_POS)))).toBe(true)
      expect(fluid.calls.removeLava).toEqual([TARGET_POS])
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on AIR fails with "No block" error', () => Effect.gen(function* () {
    const svc = yield* BlockService
    const result = yield* Effect.either(svc.breakBlock(TARGET_POS))
    expect(Either.isLeft(result)).toBe(true)
    expect(Option.getOrThrow(Either.getLeft(result)).reason).toContain('No block at position')
  }).pipe(Effect.provide(buildLayer())))
})

describe('BlockServiceError', () => {
  it('formats optional causes', () => {
    expect(new BlockServiceError({ operation: 'breakBlock', reason: 'failed', cause: new Error('inner') }).message).toContain('inner')
    expect(new BlockServiceError({ operation: 'breakBlock', reason: 'failed', cause: 'raw cause' }).message).toContain('raw cause')
    expect(new BlockServiceError({ operation: 'breakBlock', reason: 'no cause' }).message).toContain('breakBlock')
  })
})
