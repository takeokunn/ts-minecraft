import { Effect, Either, pipe } from 'effect'
import { expect } from 'vitest'
import type { BlockType } from '../BlockType'

// Effect-TS用の共通テストヘルパー
export const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.either(effect))

export const runSuccessful = <A, E = never>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)

export const expectSuccess = async <A, E = never>(effect: Effect.Effect<A, E>) => {
  const result = await runEffect(effect)
  expect(Either.isRight(result)).toBe(true)
  return Either.isRight(result) ? result.right : undefined
}

export const expectFailure = async <E>(effect: Effect.Effect<unknown, E>) => {
  const result = await runEffect(effect)
  expect(Either.isLeft(result)).toBe(true)
  return Either.isLeft(result) ? result.left : undefined
}

// ブロック関連の共通テストヘルパー
export const createTestBlock = (overrides: Partial<BlockType> = {}): BlockType => ({
  id: 'test_block',
  name: 'Test Block',
  category: 'natural',
  stackSize: 64,
  texture: 'test_texture',
  physics: {
    hardness: 1.0,
    resistance: 1.0,
    luminance: 0,
    opacity: 15,
    flammable: false,
    gravity: false,
    solid: true,
    replaceable: false,
    waterloggable: false,
  },
  tool: {
    type: 'none',
    level: 0,
  },
  sound: {
    group: 'stone',
    volume: 1.0,
    pitch: 1.0,
  },
  drops: [],
  tags: [],
  ...overrides,
})

// Effect-TS パターンでのアサーション関数
export const assertBlockExists = (blocks: readonly BlockType[], id: string) =>
  pipe(
    blocks.find((block) => block.id === id),
    (found) => (found ? Effect.succeed(found) : Effect.fail(new Error(`Block with id '${id}' not found`)))
  )

export const assertBlockCount = (blocks: readonly BlockType[], expectedCount: number) =>
  blocks.length === expectedCount
    ? Effect.succeed(blocks)
    : Effect.fail(new Error(`Expected ${expectedCount} blocks, got ${blocks.length}`))

export const assertBlockCategory = (block: BlockType, expectedCategory: BlockType['category']) =>
  block.category === expectedCategory
    ? Effect.succeed(block)
    : Effect.fail(new Error(`Expected category '${expectedCategory}', got '${block.category}'`))

// 型安全なテストマッチャー
export const expectBlockToMatch = (actual: BlockType, expected: Partial<BlockType>) => {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual[key as keyof BlockType]).toEqual(value)
  })
}

// Effect-TS パターンでのテストランナー
export const runTestEffect = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect)

export const runTestSuite = (effects: Effect.Effect<unknown>[]) => Effect.runPromise(Effect.all(effects))
