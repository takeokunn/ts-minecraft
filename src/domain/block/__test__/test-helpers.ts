import { Effect, Exit, pipe } from 'effect'
import { expect } from 'vitest'
import type { BlockType } from '../BlockType'

// Effect-TS用の共通テストヘルパー - 最新理想系パターン
export const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect)

export const runSuccessful = <A, E = never>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)

export const expectSuccess = async <A, E = never>(effect: Effect.Effect<A, E>) => {
  const result = await runEffect(effect)
  expect(Exit.isSuccess(result)).toBe(true)
  return Exit.isSuccess(result) ? result.value : undefined
}

export const expectFailure = async <E>(effect: Effect.Effect<unknown, E>) => {
  const result = await runEffect(effect)
  expect(Exit.isFailure(result)).toBe(true)
  return Exit.isFailure(result) ? result.cause : undefined
}

// ブロック関連の共通テストヘルパー
// 直接的なブロックファクトリー関数
export const createTestBlock = (overrides: Partial<BlockType> = {}): BlockType => ({
  id: 'test_block',
  name: 'Test Block',
  category: 'natural',
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
  tool: 'none',
  minToolLevel: 0,
  drops: [],
  sound: {
    break: 'block.stone.break',
    place: 'block.stone.place',
    step: 'block.stone.step',
  },
  stackSize: 64,
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

// Effect-TS パターンでのテストランナー - 改善版
export const runTestEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromiseExit(effect).then(exit =>
    Exit.isSuccess(exit) ? exit.value : Promise.reject(exit.cause)
  )

export const runTestSuite = <E>(effects: Effect.Effect<unknown, E>[]) =>
  Effect.runPromiseExit(Effect.all(effects)).then(exit =>
    Exit.isSuccess(exit) ? exit.value : Promise.reject(exit.cause)
  )
