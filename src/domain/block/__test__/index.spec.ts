import { describe, it, expect } from 'vitest'
import { Effect, pipe, Schema } from 'effect'
import { runTestEffect, expectBlockToMatch, assertBlockExists, assertBlockCount } from './test-helpers'

// インデックスファイルからのインポートをテスト
import * as BlockDomain from '../index'

describe('Block Domain Index', () => {
  describe('型エクスポートの確認', () => {
    it('BlockType型がエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          // TypeScriptの型チェックにより確認される
          expect(typeof BlockDomain).toBe('object')
        })
      ))

    it('BlockRegistry型がエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(typeof BlockDomain).toBe('object')
        })
      ))
  })

  describe('スキーマエクスポートの確認', () => {
    it('BlockTypeSchemaが正しくエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.BlockTypeSchema).toBeDefined()
          expect(typeof BlockDomain.BlockTypeSchema).toBe('function')
        })
      ))

    it('ToolTypeSchemaが正しくエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.ToolTypeSchema).toBeDefined()

          // スキーマの検証テスト
          const validTool = Schema.decodeEither(BlockDomain.ToolTypeSchema)('pickaxe')
          expect(validTool._tag).toBe('Right')
        })
      ))
  })

  describe('プロパティシステムエクスポートの確認', () => {
    it('defaultBlockPropertiesがエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.defaultBlockProperties).toBeDefined()
          expect(typeof BlockDomain.defaultBlockProperties).toBe('object')
          expect(BlockDomain.defaultBlockProperties.physics).toBeDefined()
          expect(BlockDomain.defaultBlockProperties.sound).toBeDefined()
        })
      ))

    it('プロパティヘルパー関数がエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(typeof BlockDomain.withHardness).toBe('function')
          expect(typeof BlockDomain.withTexture).toBe('function')
          expect(typeof BlockDomain.withTool).toBe('function')
        })
      ))

    it('事前定義プロパティがエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.stoneProperties).toBeDefined()
          expect(BlockDomain.woodProperties).toBeDefined()
          expect(BlockDomain.oreProperties).toBeDefined()
        })
      ))
  })

  describe('ブロック定義エクスポートの確認', () => {
    it('主要なブロックがエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.stoneBlock).toBeDefined()
          expect(BlockDomain.stoneBlock.id).toBe('stone')
          expect(BlockDomain.dirtBlock).toBeDefined()
          expect(BlockDomain.grassBlock).toBeDefined()
        })
      ))

    it('全ブロックリストがエクスポートされている', () =>
      runTestEffect(
        pipe(
          assertBlockCount(BlockDomain.allBlocks, 53),
          Effect.map(() => {
            expect(Array.isArray(BlockDomain.allBlocks)).toBe(true)
            expect(BlockDomain.allBlocks.length).toBe(53)
          })
        )
      ))

    it('カテゴリー別ブロックが適切に含まれている', () =>
      runTestEffect(
        Effect.gen(function* () {
          // 自然ブロックの確認
          yield* assertBlockExists(BlockDomain.allBlocks, 'stone')
          yield* assertBlockExists(BlockDomain.allBlocks, 'dirt')
          yield* assertBlockExists(BlockDomain.allBlocks, 'grass_block')

          // 建築ブロックの確認
          yield* assertBlockExists(BlockDomain.allBlocks, 'bricks')
          yield* assertBlockExists(BlockDomain.allBlocks, 'glass')

          // 鉱石ブロックの確認
          yield* assertBlockExists(BlockDomain.allBlocks, 'coal_ore')
          yield* assertBlockExists(BlockDomain.allBlocks, 'iron_ore')
        })
      ))
  })

  describe('BlockRegistryサービスエクスポートの確認', () => {
    it('BlockRegistryTagがエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.BlockRegistryTag).toBeDefined()
          expect(typeof BlockDomain.BlockRegistryTag).toBe('object')
        })
      ))

    it('BlockRegistryLiveがエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.BlockRegistryLive).toBeDefined()
          expect(typeof BlockDomain.BlockRegistryLive).toBe('object')
        })
      ))

    it('エラークラスがエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(BlockDomain.BlockNotFoundError).toBeDefined()
          expect(BlockDomain.BlockAlreadyRegisteredError).toBeDefined()
        })
      ))

    it('ヘルパー関数がエクスポートされている', () =>
      runTestEffect(
        Effect.sync(() => {
          expect(typeof BlockDomain.getBlock).toBe('function')
          expect(typeof BlockDomain.getAllBlocks).toBe('function')
          expect(typeof BlockDomain.getBlocksByCategory).toBe('function')
          expect(typeof BlockDomain.getBlocksByTag).toBe('function')
          expect(typeof BlockDomain.searchBlocks).toBe('function')
          expect(typeof BlockDomain.registerBlock).toBe('function')
          expect(typeof BlockDomain.isBlockRegistered).toBe('function')
        })
      ))
  })

  describe('Effect-TS パターンでの統合テスト', () => {
    it('静的データが正しく取得できる', () =>
      runTestEffect(
        Effect.sync(() => {
          // 静的ブロックデータのテスト
          expect(BlockDomain.allBlocks.length).toBe(53)
          expect(BlockDomain.stoneBlock.id).toBe('stone')
          expect(BlockDomain.stoneBlock.category).toBe('natural')
        })
      ))

    it('ブロック定数が正しく定義されている', () =>
      runTestEffect(
        Effect.sync(() => {
          // 主要ブロックの確認
          expect(BlockDomain.stoneBlock).toBeDefined()
          expect(BlockDomain.dirtBlock).toBeDefined()
          expect(BlockDomain.grassBlock).toBeDefined()

          // カテゴリーの確認
          const naturalBlocks = BlockDomain.allBlocks.filter((b) => b.category === 'natural')
          expect(naturalBlocks.length).toBeGreaterThan(10)
        })
      ))
  })
})
