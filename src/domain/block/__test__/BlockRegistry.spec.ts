import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Option, Either, pipe, Match, Exit } from 'effect'
import {
  BlockNotFoundError,
  BlockAlreadyRegisteredError,
  BlockRegistryLive,
  type BlockRegistry,
} from '../BlockRegistry'
import type { BlockType } from '../BlockType'
import { createDefaultPhysics, createDefaultSound } from '../BlockType'

// Effect-TS用のテストヘルパー
const runEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.either(effect))

const runSuccessful = <A, E = never>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect)

const expectSuccess = async <A, E = never>(effect: Effect.Effect<A, E>) => {
  const result = await runEffect(effect)
  expect(Either.isRight(result)).toBe(true)
  return Either.isRight(result) ? result.right : undefined
}

const expectFailure = async <E>(effect: Effect.Effect<unknown, E>) => {
  const result = await runEffect(effect)
  expect(Either.isLeft(result)).toBe(true)
  return Either.isLeft(result) ? result.left : undefined
}

// 共通テストデータ
const createTestBlock = (id: string, category: BlockType['category'], tags: string[] = []): BlockType => ({
  id,
  name: `Test ${id}`,
  category,
  texture: id,
  physics: createDefaultPhysics(),
  tool: 'none',
  minToolLevel: 0,
  drops: [],
  sound: createDefaultSound(),
  stackSize: 64,
  tags,
})

describe('BlockRegistry', () => {
  let registry: BlockRegistry

  beforeEach(async () => {
    registry = await runSuccessful(BlockRegistryLive)
  })

  describe('getBlock', () => {
    it('登録されているブロックを取得できる', async () => {
      const block = await expectSuccess(registry.getBlock('stone'))
      expect(block?.id).toBe('stone')
      expect(block?.name).toBe('Stone')
    })

    it('存在しないブロックIDでエラーを返す', async () => {
      const error = await expectFailure(registry.getBlock('non_existent_block'))
      expect(error?._tag).toBe('BlockNotFoundError')

      pipe(
        error,
        Match.value,
        Match.when(
          (e): e is BlockNotFoundError => e?._tag === 'BlockNotFoundError',
          (e) => expect(e.blockId).toBe('non_existent_block')
        ),
        Match.orElse(() => expect.fail('BlockNotFoundErrorが期待される'))
      )
    })
  })

  describe('getBlockOption', () => {
    it('登録されているブロックをSomeで返す', async () => {
      const result = await runSuccessful(registry.getBlockOption('stone'))

      pipe(
        result,
        Option.match({
          onNone: () => expect.fail('ブロックが見つかるべき'),
          onSome: (block) => {
            expect(block.id).toBe('stone')
          }
        })
      )
    })

    it('存在しないブロックでNoneを返す', async () => {
      const result = await runSuccessful(registry.getBlockOption('non_existent_block'))
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('getAllBlocks', () => {
    it('全てのブロックを取得できる', async () => {
      const blocks = await runSuccessful(registry.getAllBlocks())
      expect(blocks.length).toBe(53) // 53種類のブロック

      const hasBlock = (id: string) => blocks.some(b => b.id === id)
      expect(hasBlock('stone')).toBe(true)
      expect(hasBlock('dirt')).toBe(true)
      expect(hasBlock('grass_block')).toBe(true)
    })
  })

  describe('getBlocksByCategory', () => {
    it('カテゴリーでブロックをフィルタリングできる', async () => {
      const naturalBlocks = await runSuccessful(registry.getBlocksByCategory('natural'))
      expect(naturalBlocks.length).toBeGreaterThan(0)
      expect(naturalBlocks.every(b => b.category === 'natural')).toBe(true)

      const buildingBlocks = await runSuccessful(registry.getBlocksByCategory('building'))
      expect(buildingBlocks.length).toBeGreaterThan(0)
      expect(buildingBlocks.every(b => b.category === 'building')).toBe(true)
    })

    it('該当するブロックがない場合は空配列を返す', async () => {
      const blocks = await runSuccessful(registry.getBlocksByCategory('transportation'))
      expect(blocks).toEqual([])
    })
  })

  describe('getBlocksByTag', () => {
    it('初期状態では全ブロックがタグなし', async () => {
      const blocks = await runSuccessful(registry.getBlocksByTag('mineable'))
      expect(blocks).toEqual([])
    })

    it('新しいブロックを登録した後、タグで検索できる', async () => {
      const testBlock1 = createTestBlock('test_stone', 'natural', ['mineable', 'stone'])
      const testBlock2 = createTestBlock('test_wood', 'building', ['mineable', 'wood', 'flammable'])

      await runSuccessful(registry.registerBlock(testBlock1))
      await runSuccessful(registry.registerBlock(testBlock2))

      const mineableBlocks = await runSuccessful(registry.getBlocksByTag('mineable'))
      expect(mineableBlocks.length).toBe(2)
      expect(mineableBlocks.some(b => b.id === 'test_stone')).toBe(true)
      expect(mineableBlocks.some(b => b.id === 'test_wood')).toBe(true)

      const stoneBlocks = await runSuccessful(registry.getBlocksByTag('stone'))
      expect(stoneBlocks.length).toBe(1)
      expect(stoneBlocks[0]?.id).toBe('test_stone')
    })
  })

  describe('searchBlocks', () => {
    it('IDで検索できる', async () => {
      const blocks = await runSuccessful(registry.searchBlocks('stone'))
      expect(blocks.some(b => b.id === 'stone')).toBe(true)
      expect(blocks.some(b => b.id === 'cobblestone')).toBe(true)
      expect(blocks.some(b => b.id === 'redstone_ore')).toBe(true)
    })

    it('名前で検索できる', async () => {
      const blocks = await runSuccessful(registry.searchBlocks('Oak'))
      expect(blocks.some(b => b.name === 'Oak Log')).toBe(true)
      expect(blocks.some(b => b.name === 'Oak Planks')).toBe(true)
    })

    it('カテゴリーで検索できる', async () => {
      const blocks = await runSuccessful(registry.searchBlocks('decoration'))
      expect(blocks.every(b => b.category === 'decoration')).toBe(true)
    })

    it('大文字小文字を区別しない', async () => {
      const blocks1 = await runSuccessful(registry.searchBlocks('STONE'))
      const blocks2 = await runSuccessful(registry.searchBlocks('stone'))
      const blocks3 = await runSuccessful(registry.searchBlocks('StOnE'))

      expect(blocks1.length).toBe(blocks2.length)
      expect(blocks1.length).toBe(blocks3.length)
    })

    it('該当するブロックがない場合は空配列を返す', async () => {
      const blocks = await runSuccessful(registry.searchBlocks('xyz123'))
      expect(blocks).toEqual([])
    })
  })

  describe('registerBlock', () => {
    it('新しいブロックを登録できる', async () => {
      const testBlock = createTestBlock('test_new', 'natural')

      await expectSuccess(registry.registerBlock(testBlock))
      const block = await expectSuccess(registry.getBlock('test_new'))
      expect(block?.id).toBe('test_new')
    })

    it('同じIDのブロックを登録しようとするとエラーを返す', async () => {
      const testBlock = createTestBlock('test_duplicate', 'natural')

      await expectSuccess(registry.registerBlock(testBlock))
      const error = await expectFailure(registry.registerBlock(testBlock))

      expect(error?._tag).toBe('BlockAlreadyRegisteredError')
      pipe(
        error,
        Match.value,
        Match.when(
          (e): e is BlockAlreadyRegisteredError => e?._tag === 'BlockAlreadyRegisteredError',
          (e) => expect(e.blockId).toBe('test_duplicate')
        ),
        Match.orElse(() => expect.fail('BlockAlreadyRegisteredErrorが期待される'))
      )
    })

    it('既存のブロックと同じIDは拒否する', async () => {
      const duplicateStone = createTestBlock('stone', 'natural')
      const error = await expectFailure(registry.registerBlock(duplicateStone))
      expect(error?._tag).toBe('BlockAlreadyRegisteredError')
    })

    it('登録後はカテゴリーインデックスに反映される', async () => {
      const testBlock = createTestBlock('test_category', 'natural')
      await runSuccessful(registry.registerBlock(testBlock))

      const naturalBlocks = await runSuccessful(registry.getBlocksByCategory('natural'))
      expect(naturalBlocks.some(b => b.id === 'test_category')).toBe(true)
    })

    it('登録後はタグインデックスに反映される', async () => {
      const testBlock = createTestBlock('test_tags', 'natural', ['custom', 'test'])
      await runSuccessful(registry.registerBlock(testBlock))

      const customBlocks = await runSuccessful(registry.getBlocksByTag('custom'))
      expect(customBlocks.some(b => b.id === 'test_tags')).toBe(true)

      const testBlocks = await runSuccessful(registry.getBlocksByTag('test'))
      expect(testBlocks.some(b => b.id === 'test_tags')).toBe(true)
    })
  })

  describe('isBlockRegistered', () => {
    it('登録されているブロックでtrueを返す', async () => {
      const result = await runSuccessful(registry.isBlockRegistered('stone'))
      expect(result).toBe(true)
    })

    it('登録されていないブロックでfalseを返す', async () => {
      const result = await runSuccessful(registry.isBlockRegistered('non_existent'))
      expect(result).toBe(false)
    })

    it('新規登録後はtrueを返す', async () => {
      const testBlock = createTestBlock('test_registered', 'natural')

      const before = await runSuccessful(registry.isBlockRegistered('test_registered'))
      expect(before).toBe(false)

      await runSuccessful(registry.registerBlock(testBlock))

      const after = await runSuccessful(registry.isBlockRegistered('test_registered'))
      expect(after).toBe(true)
    })
  })

  describe('Initial blocks validation', () => {
    it('初期状態で53種類のブロックが登録されている', async () => {
      const blocks = await runSuccessful(registry.getAllBlocks())
      expect(blocks.length).toBe(53)
    })

    it('主要なブロックが全て登録されている', async () => {
      const essentialBlocks = [
        'stone', 'dirt', 'grass_block', 'cobblestone',
        'sand', 'gravel', 'bedrock', 'oak_log',
        'oak_planks', 'glass', 'iron_ore', 'diamond_ore',
        'water', 'lava', 'torch', 'crafting_table',
        'furnace', 'chest',
      ]

      await Effect.runPromise(
        Effect.all(
          essentialBlocks.map(blockId =>
            pipe(
              registry.isBlockRegistered(blockId),
              Effect.map(registered => expect(registered).toBe(true))
            )
          )
        )
      )
    })

    it('カテゴリー分布が適切', async () => {
      const categories = ['natural', 'building', 'decoration', 'redstone', 'miscellaneous', 'food'] as const

      await Effect.runPromise(
        Effect.all(
          categories.map(category =>
            pipe(
              registry.getBlocksByCategory(category),
              Effect.map(blocks => expect(blocks.length).toBeGreaterThanOrEqual(0))
            )
          )
        )
      )

      const naturalBlocks = await runSuccessful(registry.getBlocksByCategory('natural'))
      expect(naturalBlocks.length).toBeGreaterThanOrEqual(10)

      const buildingBlocks = await runSuccessful(registry.getBlocksByCategory('building'))
      expect(buildingBlocks.length).toBeGreaterThanOrEqual(10)
    })
  })

  describe('Edge cases', () => {
    it('空文字列で検索すると全ブロックが返る', async () => {
      const blocks = await runSuccessful(registry.searchBlocks(''))
      const allBlocks = await runSuccessful(registry.getAllBlocks())
      expect(blocks.length).toBe(allBlocks.length)
    })

    it('特殊文字を含む検索クエリを処理できる', async () => {
      const blocks = await runSuccessful(registry.searchBlocks('!@#$%'))
      expect(blocks).toEqual([])
    })

    it('複数のタグを持つブロックが各タグで検索可能', async () => {
      const multiTagBlock = createTestBlock('multi_tag', 'natural', ['tag1', 'tag2', 'tag3'])
      await runSuccessful(registry.registerBlock(multiTagBlock))

      const tag1Blocks = await runSuccessful(registry.getBlocksByTag('tag1'))
      const tag2Blocks = await runSuccessful(registry.getBlocksByTag('tag2'))
      const tag3Blocks = await runSuccessful(registry.getBlocksByTag('tag3'))

      expect(tag1Blocks.some(b => b.id === 'multi_tag')).toBe(true)
      expect(tag2Blocks.some(b => b.id === 'multi_tag')).toBe(true)
      expect(tag3Blocks.some(b => b.id === 'multi_tag')).toBe(true)
    })
  })
})