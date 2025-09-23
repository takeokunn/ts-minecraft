import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option, Either, pipe } from 'effect'
import {
  BlockNotFoundError,
  BlockAlreadyRegisteredError,
  BlockRegistryLive,
  BlockRegistry,
  registerBlock,
  isBlockRegistered,
  searchBlocks,
  getBlocksByCategory,
  getBlocksByTag,
  getBlock,
  getAllBlocks,
} from '../BlockRegistry'
import type { BlockType } from '../BlockType'
import { createTestBlock } from './test-helpers'

describe('BlockRegistry', () => {
  describe('getBlock', () => {
    it.effect('登録されているブロックを取得できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const block = yield* registry.getBlock('stone')
        expect(block.id).toBe('stone')
        expect(block.name).toBe('Stone')
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('存在しないブロックIDでエラーを返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const result = yield* Effect.either(registry.getBlock('non_existent_block'))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(BlockNotFoundError)
          expect((result.left as BlockNotFoundError).blockId).toBe('non_existent_block')
        }
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('getBlockOption', () => {
    it.effect('登録されているブロックをSomeで返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const result = yield* registry.getBlockOption('stone')

        pipe(
          result,
          Option.match({
            onNone: () => expect.fail('ブロックが見つかるべき'),
            onSome: (block) => {
              expect(block.id).toBe('stone')
            },
          })
        )
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('存在しないブロックでNoneを返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const result = yield* registry.getBlockOption('non_existent_block')
        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('getAllBlocks', () => {
    it.effect('全てのブロックを取得できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.getAllBlocks()
        expect(blocks.length).toBe(53) // 53種類のブロック

        const hasBlock = (id: string) => blocks.some((b) => b.id === id)
        expect(hasBlock('stone')).toBe(true)
        expect(hasBlock('dirt')).toBe(true)
        expect(hasBlock('grass_block')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('getBlocksByCategory', () => {
    it.effect('カテゴリーでブロックをフィルタリングできる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const naturalBlocks = yield* registry.getBlocksByCategory('natural')
        expect(naturalBlocks.length).toBeGreaterThan(0)
        expect(naturalBlocks.every((b) => b.category === 'natural')).toBe(true)

        const buildingBlocks = yield* registry.getBlocksByCategory('building')
        expect(buildingBlocks.length).toBeGreaterThan(0)
        expect(buildingBlocks.every((b) => b.category === 'building')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('該当するブロックがない場合は空配列を返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.getBlocksByCategory('transportation')
        expect(blocks).toEqual([])
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('getBlocksByTag', () => {
    it.effect('初期状態では全ブロックがタグなし', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.getBlocksByTag('mineable')
        expect(blocks).toEqual([])
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('新しいブロックを登録した後、タグで検索できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock1 = createTestBlock({ id: 'test_stone', category: 'natural', tags: ['mineable', 'stone'] })
        const testBlock2 = createTestBlock({
          id: 'test_wood',
          category: 'building',
          tags: ['mineable', 'wood', 'flammable'],
        })

        yield* registry.registerBlock(testBlock1)
        yield* registry.registerBlock(testBlock2)

        const mineableBlocks = yield* registry.getBlocksByTag('mineable')
        expect(mineableBlocks.length).toBe(2)
        expect(mineableBlocks.some((b) => b.id === 'test_stone')).toBe(true)
        expect(mineableBlocks.some((b) => b.id === 'test_wood')).toBe(true)

        const stoneBlocks = yield* registry.getBlocksByTag('stone')
        expect(stoneBlocks.length).toBe(1)
        expect(stoneBlocks[0]?.id).toBe('test_stone')
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('searchBlocks', () => {
    it.effect('IDで検索できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.searchBlocks('stone')
        expect(blocks.some((b) => b.id === 'stone')).toBe(true)
        expect(blocks.some((b) => b.id === 'cobblestone')).toBe(true)
        expect(blocks.some((b) => b.id === 'redstone_ore')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('名前で検索できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.searchBlocks('Oak')
        expect(blocks.some((b) => b.name === 'Oak Log')).toBe(true)
        expect(blocks.some((b) => b.name === 'Oak Planks')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('カテゴリーで検索できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.searchBlocks('decoration')
        expect(blocks.every((b) => b.category === 'decoration')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('大文字小文字を区別しない', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks1 = yield* registry.searchBlocks('STONE')
        const blocks2 = yield* registry.searchBlocks('stone')
        const blocks3 = yield* registry.searchBlocks('StOnE')

        expect(blocks1.length).toBe(blocks2.length)
        expect(blocks1.length).toBe(blocks3.length)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('該当するブロックがない場合は空配列を返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.searchBlocks('xyz123')
        expect(blocks).toEqual([])
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('registerBlock', () => {
    it.effect('新しいブロックを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock = createTestBlock({ id: 'test_new', category: 'natural' })

        yield* registry.registerBlock(testBlock)
        const block = yield* registry.getBlock('test_new')
        expect(block.id).toBe('test_new')
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('同じIDのブロックを登録しようとするとエラーを返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock = createTestBlock({ id: 'test_duplicate', category: 'natural' })

        yield* registry.registerBlock(testBlock)
        const result = yield* Effect.either(registry.registerBlock(testBlock))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const error = result.left
          expect(error._tag).toBe('BlockAlreadyRegisteredError')
          expect((error as BlockAlreadyRegisteredError).blockId).toBe('test_duplicate')
        }
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('既存のブロックと同じIDは拒否する', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const duplicateStone = createTestBlock({ id: 'stone', category: 'natural' })
        const result = yield* Effect.either(registry.registerBlock(duplicateStone))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockAlreadyRegisteredError')
        }
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('登録後はカテゴリーインデックスに反映される', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock = createTestBlock({ id: 'test_category', category: 'natural' })
        yield* registry.registerBlock(testBlock)

        const naturalBlocks = yield* registry.getBlocksByCategory('natural')
        expect(naturalBlocks.some((b) => b.id === 'test_category')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('登録後はタグインデックスに反映される', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock = createTestBlock({ id: 'test_tags', category: 'natural', tags: ['custom', 'test'] })
        yield* registry.registerBlock(testBlock)

        const customBlocks = yield* registry.getBlocksByTag('custom')
        expect(customBlocks.some((b) => b.id === 'test_tags')).toBe(true)

        const testBlocks = yield* registry.getBlocksByTag('test')
        expect(testBlocks.some((b) => b.id === 'test_tags')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('isBlockRegistered', () => {
    it.effect('登録されているブロックでtrueを返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const result = yield* registry.isBlockRegistered('stone')
        expect(result).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('登録されていないブロックでfalseを返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const result = yield* registry.isBlockRegistered('non_existent')
        expect(result).toBe(false)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('新規登録後はtrueを返す', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock = createTestBlock({ id: 'test_registered', category: 'natural' })

        const before = yield* registry.isBlockRegistered('test_registered')
        expect(before).toBe(false)

        yield* registry.registerBlock(testBlock)

        const after = yield* registry.isBlockRegistered('test_registered')
        expect(after).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('Initial blocks validation', () => {
    it.effect('初期状態で53種類のブロックが登録されている', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.getAllBlocks()
        expect(blocks.length).toBe(53)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('主要なブロックが全て登録されている', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const essentialBlocks = [
          'stone',
          'dirt',
          'grass_block',
          'cobblestone',
          'sand',
          'gravel',
          'bedrock',
          'oak_log',
          'oak_planks',
          'glass',
          'iron_ore',
          'diamond_ore',
          'water',
          'lava',
          'torch',
          'crafting_table',
          'furnace',
          'chest',
        ]

        yield* Effect.all(
          essentialBlocks.map((blockId) =>
            Effect.gen(function* () {
              const registered = yield* registry.isBlockRegistered(blockId)
              expect(registered).toBe(true)
            })
          )
        )
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('カテゴリー分布が適切', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const categories = ['natural', 'building', 'decoration', 'redstone', 'miscellaneous', 'food'] as const

        yield* Effect.all(
          categories.map((category) =>
            Effect.gen(function* () {
              const blocks = yield* registry.getBlocksByCategory(category)
              expect(blocks.length).toBeGreaterThanOrEqual(0)
            })
          )
        )

        const naturalBlocks = yield* registry.getBlocksByCategory('natural')
        expect(naturalBlocks.length).toBeGreaterThanOrEqual(10)

        const buildingBlocks = yield* registry.getBlocksByCategory('building')
        expect(buildingBlocks.length).toBeGreaterThanOrEqual(10)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('外部API関数（行202-206, 209-213直接テスト）', () => {
    it.effect('外部API関数テスト - registerBlock（行202-206）とisBlockRegistered（行209-213）', () =>
      Effect.gen(function* () {
        /*
         * このテストケースは以下の未カバー関数をテストします：
         *
         * 行202-206: registerBlock外部API関数
         * export const registerBlock = (block: BlockType) =>
         *   Effect.gen(function* () {
         *     const registry = yield* BlockRegistry
         *     return yield* registry.registerBlock(block)
         *   })
         *
         * 行209-213: isBlockRegistered外部API関数
         * export const isBlockRegistered = (id: string) =>
         *   Effect.gen(function* () {
         *     const registry = yield* BlockRegistry
         *     return yield* registry.isBlockRegistered(id)
         *   })
         */

        const testBlock = createTestBlock({ id: 'api_coverage_test', category: 'natural' })

        // registerBlock外部API関数（行202-206）を直接テスト
        yield* registerBlock(testBlock)

        // isBlockRegistered外部API関数（行209-213）を直接テスト
        const isRegistered = yield* isBlockRegistered('api_coverage_test')
        expect(isRegistered).toBe(true)

        // 追加で別のブロックでも確認
        const testBlock2 = createTestBlock({ id: 'api_coverage_test_2', category: 'building' })
        yield* registerBlock(testBlock2)

        const isRegistered2 = yield* isBlockRegistered('api_coverage_test_2')
        expect(isRegistered2).toBe(true)

        // 存在しないブロックの確認
        const doesNotExist = yield* isBlockRegistered('non_existent_api_coverage_test')
        expect(doesNotExist).toBe(false)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('registerBlock関数でブロックを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const testBlock = createTestBlock({ id: 'api_test_block', category: 'natural' })

        // レガシー外部API関数を使用
        yield* registry.registerBlock(testBlock)

        // 登録されたかを確認
        const isRegistered = yield* registry.isBlockRegistered('api_test_block')
        expect(isRegistered).toBe(true)

        const block = yield* registry.getBlock('api_test_block')
        expect(block.id).toBe('api_test_block')
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('isBlockRegistered関数で存在チェックができる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        // 存在しないブロック
        const notExists = yield* registry.isBlockRegistered('non_existent_api_test')
        expect(notExists).toBe(false)

        // 存在するブロック
        const exists = yield* registry.isBlockRegistered('stone')
        expect(exists).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('searchBlocks関数で検索ができる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const results = yield* registry.searchBlocks('stone')
        expect(results.length).toBeGreaterThan(0)
        expect(results.some((b) => b.id === 'stone')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('getBlocksByCategory関数でカテゴリー検索ができる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const naturalBlocks = yield* registry.getBlocksByCategory('natural')
        expect(naturalBlocks.length).toBeGreaterThan(0)
        expect(naturalBlocks.every((b) => b.category === 'natural')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('getBlocksByTag関数でタグ検索ができる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        // タグ付きブロックを登録
        const taggedBlock = createTestBlock({ id: 'api_tagged_block', category: 'natural', tags: ['api_test'] })
        yield* registry.registerBlock(taggedBlock)

        const taggedBlocks = yield* registry.getBlocksByTag('api_test')
        expect(taggedBlocks.length).toBe(1)
        expect(taggedBlocks[0]?.id).toBe('api_tagged_block')
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    // Module-level helper functions testing with Layer pattern
    it.effect('module-level registerBlock function works', () =>
      Effect.gen(function* () {
        const testBlock = createTestBlock({ id: 'module_register_test', category: 'natural' })
        const result = yield* registerBlock(testBlock)
        expect(result).toBeUndefined()
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('module-level isBlockRegistered function works', () =>
      Effect.gen(function* () {
        const result = yield* isBlockRegistered('stone')
        expect(result).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('module-level searchBlocks function works', () =>
      Effect.gen(function* () {
        const results = yield* searchBlocks('stone')
        expect(results.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('module-level getBlocksByCategory function works', () =>
      Effect.gen(function* () {
        const results = yield* getBlocksByCategory('natural')
        expect(results.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('module-level getBlocksByTag function works', () =>
      Effect.gen(function* () {
        // First register a block with a specific tag
        const taggedBlock = createTestBlock({ id: 'module_tag_test', category: 'natural', tags: ['module_test'] })
        yield* registerBlock(taggedBlock)

        const results = yield* getBlocksByTag('module_test')
        expect(results.length).toBe(1)
        expect(results[0]?.id).toBe('module_tag_test')
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('Edge cases', () => {
    it.effect('空文字列で検索すると全ブロックが返る', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.searchBlocks('')
        const allBlocks = yield* registry.getAllBlocks()
        expect(blocks.length).toBe(allBlocks.length)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('特殊文字を含む検索クエリを処理できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const blocks = yield* registry.searchBlocks('!@#$%')
        expect(blocks).toEqual([])
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('複数のタグを持つブロックが各タグで検索可能', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const multiTagBlock = createTestBlock({ id: 'multi_tag', category: 'natural', tags: ['tag1', 'tag2', 'tag3'] })
        yield* registry.registerBlock(multiTagBlock)

        const tag1Blocks = yield* registry.getBlocksByTag('tag1')
        const tag2Blocks = yield* registry.getBlocksByTag('tag2')
        const tag3Blocks = yield* registry.getBlocksByTag('tag3')

        expect(tag1Blocks.some((b) => b.id === 'multi_tag')).toBe(true)
        expect(tag2Blocks.some((b) => b.id === 'multi_tag')).toBe(true)
        expect(tag3Blocks.some((b) => b.id === 'multi_tag')).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('新しいカテゴリー登録のカバレッジ改善（行146-147）', () => {
    it.effect('完全に新しいカテゴリーでブロックを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        // 新しいカテゴリー「experiment」でブロックを作成
        const experimentalBlock = createTestBlock({
          id: 'experimental_block',
          category: 'experiment' as any, // 新しいカテゴリー
          tags: ['experimental', 'new_category'],
        })

        // registerBlock内でcategoryIndex.set()が呼ばれる（行146-147）
        yield* registry.registerBlock(experimentalBlock)

        // 新しいカテゴリーで検索できることを確認
        const experimentBlocks = yield* registry.getBlocksByCategory('experiment' as any)
        expect(experimentBlocks.length).toBe(1)
        expect(experimentBlocks[0]?.id).toBe('experimental_block')

        // 登録されたブロックの詳細確認
        const registeredBlock = yield* registry.getBlock('experimental_block')
        expect(registeredBlock.category).toBe('experiment')
        expect(registeredBlock.tags).toContain('experimental')
        expect(registeredBlock.tags).toContain('new_category')
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('複数の新しいカテゴリーでブロックを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        // 複数の新カテゴリーでブロックを作成
        const techBlock = createTestBlock({
          id: 'tech_block',
          category: 'technology' as any,
        })

        const magicBlock = createTestBlock({
          id: 'magic_block',
          category: 'magic' as any,
          tags: ['magical', 'rare'],
        })

        // 各ブロックの登録（新しいカテゴリーインデックス作成）
        yield* registry.registerBlock(techBlock)
        yield* registry.registerBlock(magicBlock)

        // 各カテゴリーで検索できることを確認
        const techBlocks = yield* registry.getBlocksByCategory('technology' as any)
        expect(techBlocks.length).toBe(1)
        expect(techBlocks[0]?.id).toBe('tech_block')

        const magicBlocks = yield* registry.getBlocksByCategory('magic' as any)
        expect(magicBlocks.length).toBe(1)
        expect(magicBlocks[0]?.id).toBe('magic_block')

        // タグ検索も正しく動作することを確認
        const magicalBlocks = yield* registry.getBlocksByTag('magical')
        expect(magicalBlocks.length).toBe(1)
        expect(magicalBlocks[0]?.id).toBe('magic_block')
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('エクスポートされた関数のカバレッジ改善', () => {
    it.effect('エクスポートされた getBlock 関数が正しく動作する（行168-171）', () =>
      Effect.gen(function* () {
        // モジュールレベルのgetBlock関数を使用
        const stoneBlock = yield* getBlock('stone')
        expect(stoneBlock).toBeDefined()
        expect(stoneBlock.id).toBe('stone')
        expect(stoneBlock.name).toBe('Stone')

        // エラー系：存在しないブロックの取得
        const result = yield* Effect.either(getBlock('nonexistent_export_test'))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(BlockNotFoundError)
        }
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('エクスポートされた getAllBlocks 関数が正しく動作する（行175-178）', () =>
      Effect.gen(function* () {
        // モジュールレベルのgetAllBlocks関数を使用
        const blocks = yield* getAllBlocks()

        // 基本的な検証
        expect(Array.isArray(blocks)).toBe(true)
        expect(blocks.length).toBe(53) // 53種類のブロック

        // 主要なブロックが含まれていることを確認
        const blockIds = blocks.map((b) => b.id)
        expect(blockIds).toContain('stone')
        expect(blockIds).toContain('dirt')
        expect(blockIds).toContain('grass_block')
        expect(blockIds).toContain('oak_log')

        // 各ブロックが正しい構造を持っていることを確認
        blocks.forEach((block) => {
          expect(block.id).toBeDefined()
          expect(block.name).toBeDefined()
          expect(block.category).toBeDefined()
          expect(block.physics).toBeDefined()
        })
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('エクスポートされた getBlocksByCategory 関数の完全なテスト（行181-185）', () =>
      Effect.gen(function* () {
        // モジュールレベルのgetBlocksByCategory関数を使用
        const buildingBlocks = yield* getBlocksByCategory('building')
        const decorationBlocks = yield* getBlocksByCategory('decoration')
        const naturalBlocks = yield* getBlocksByCategory('natural')

        // 各カテゴリーにブロックが存在することを確認
        expect(buildingBlocks.length).toBeGreaterThan(0)
        expect(decorationBlocks.length).toBeGreaterThan(0)
        expect(naturalBlocks.length).toBeGreaterThan(0)

        // カテゴリーが正しく設定されていることを確認
        buildingBlocks.forEach((block) => {
          expect(block.category).toBe('building')
        })

        decorationBlocks.forEach((block) => {
          expect(block.category).toBe('decoration')
        })

        naturalBlocks.forEach((block) => {
          expect(block.category).toBe('natural')
        })
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })
})
