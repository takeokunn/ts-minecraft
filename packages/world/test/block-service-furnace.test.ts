import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { BlockService } from '@ts-minecraft/world'
import {
  createMockChunkManagerService,
  createMockFurnaceService,
  createMockPlayerService,
  createTestLayer,
} from './block-service-test-utils'

const TARGET_POS = { x: 0, y: 64, z: 0 } as const
const PLAYER_POS = { x: 100, y: 100, z: 100 } as const

const makeFurnaceBreakLayer = (dismantleResult: boolean) => {
  const chunkManager = createMockChunkManagerService([{ pos: TARGET_POS, blockType: 'FURNACE' }])
  return createTestLayer(
    chunkManager.service,
    createMockPlayerService(PLAYER_POS),
    undefined,
    undefined,
    undefined,
    createMockFurnaceService({ dismantleFurnace: () => Effect.succeed(dismantleResult) }),
  )
}

const breakFurnaceEither = (dismantleResult: boolean) =>
  Effect.gen(function* () {
    const svc = yield* BlockService
    return yield* Effect.either(svc.breakBlock(TARGET_POS))
  }).pipe(Effect.provide(makeFurnaceBreakLayer(dismantleResult)))

describe('terrain/application/block-service breakBlock furnace', () => {
  it.effect('breakBlock on FURNACE succeeds when dismantleFurnace returns true', () =>
    Effect.gen(function* () {
      const result = yield* breakFurnaceEither(true)
      expect(Either.isRight(result)).toBe(true)
    }))

  it.effect('breakBlock on FURNACE fails when dismantleFurnace returns false', () =>
    Effect.gen(function* () {
      const result = yield* breakFurnaceEither(false)
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('breakBlock')
      expect(err.reason).toContain('Cannot break furnace')
    }))
})
