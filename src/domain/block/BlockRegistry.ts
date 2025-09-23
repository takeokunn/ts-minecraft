import { Context, Effect, Option, HashMap, Array as EffectArray, pipe, Data, Layer, Match } from 'effect'
import type { BlockType, BlockCategory } from './BlockType'
import { allBlocks } from './blocks'

// エラー定義（Data.TaggedErrorを使用）
export interface BlockNotFoundError {
  readonly _tag: 'BlockNotFoundError'
  readonly blockId: string
}

export const BlockNotFoundError = (blockId: string): BlockNotFoundError => ({
  _tag: 'BlockNotFoundError',
  blockId,
})

export const isBlockNotFoundError = (error: unknown): error is BlockNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'BlockNotFoundError'

export interface BlockAlreadyRegisteredError {
  readonly _tag: 'BlockAlreadyRegisteredError'
  readonly blockId: string
}

export const BlockAlreadyRegisteredError = (blockId: string): BlockAlreadyRegisteredError => ({
  _tag: 'BlockAlreadyRegisteredError',
  blockId,
})

export const isBlockAlreadyRegisteredError = (error: unknown): error is BlockAlreadyRegisteredError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'BlockAlreadyRegisteredError'

// BlockRegistryサービスインターフェース
export interface BlockRegistry {
  readonly getBlock: (id: string) => Effect.Effect<BlockType, BlockNotFoundError>
  readonly getBlockOption: (id: string) => Effect.Effect<Option.Option<BlockType>>
  readonly getAllBlocks: () => Effect.Effect<readonly BlockType[]>
  readonly getBlocksByCategory: (category: BlockCategory) => Effect.Effect<readonly BlockType[]>
  readonly getBlocksByTag: (tag: string) => Effect.Effect<readonly BlockType[]>
  readonly searchBlocks: (query: string) => Effect.Effect<readonly BlockType[]>
  readonly registerBlock: (block: BlockType) => Effect.Effect<void, BlockAlreadyRegisteredError>
  readonly isBlockRegistered: (id: string) => Effect.Effect<boolean>
}

// BlockRegistryサービスタグ
export const BlockRegistry = Context.GenericTag<BlockRegistry>('@minecraft/BlockRegistry')

// BlockRegistryの実装
export const BlockRegistryLive = Layer.effect(
  BlockRegistry,
  Effect.gen(function* () {
    // ブロックを格納するHashMap
    let blockMap = HashMap.fromIterable(allBlocks.map((block) => [block.id, block] as const))

    // カテゴリー別のインデックス
    const categoryIndex = new Map<BlockCategory, Set<string>>()

    // タグ別のインデックス
    const tagIndex = new Map<string, Set<string>>()

    // インデックスの初期化
    const initializeIndexes = () => {
      // カテゴリーインデックスの構築
      allBlocks.forEach((block) => {
        pipe(
          Match.value(categoryIndex.has(block.category)),
          Match.when(false, () => {
            categoryIndex.set(block.category, new Set())
          }),
          Match.orElse(() => {})
        )
        categoryIndex.get(block.category)!.add(block.id)
      })

      // タグインデックスの構築
      allBlocks.forEach((block) => {
        block.tags.forEach((tag) => {
          pipe(
            Match.value(tagIndex.has(tag)),
            Match.when(false, () => {
              tagIndex.set(tag, new Set())
            }),
            Match.orElse(() => undefined)
          )
          tagIndex.get(tag)!.add(block.id)
        })
      })
    }

    // 初期化実行
    initializeIndexes()

    return {
      getBlock: (id: string) =>
        pipe(
          HashMap.get(blockMap, id),
          Option.match({
            onNone: () => Effect.fail(BlockNotFoundError(id)),
            onSome: (block) => Effect.succeed(block),
          })
        ),

      getBlockOption: (id: string) => Effect.succeed(HashMap.get(blockMap, id)),

      getAllBlocks: () => Effect.succeed(pipe(blockMap, HashMap.values, EffectArray.fromIterable)),

      getBlocksByCategory: (category: BlockCategory) =>
        Effect.gen(function* () {
          const blockIds = categoryIndex.get(category) ?? new Set()

          return pipe(
            EffectArray.fromIterable(Array.from(blockIds)),
            EffectArray.filterMap((id) =>
              pipe(
                HashMap.get(blockMap, id),
                Option.match({
                  onNone: () => Option.none(),
                  onSome: (block) => Option.some(block),
                })
              )
            )
          )
        }),

      getBlocksByTag: (tag: string) =>
        Effect.gen(function* () {
          const blockIds = tagIndex.get(tag) ?? new Set()

          return pipe(
            EffectArray.fromIterable(Array.from(blockIds)),
            EffectArray.filterMap((id) =>
              pipe(
                HashMap.get(blockMap, id),
                Option.match({
                  onNone: () => Option.none(),
                  onSome: (block) => Option.some(block),
                })
              )
            )
          )
        }),

      searchBlocks: (query: string) =>
        Effect.gen(function* () {
          const lowerQuery = query.toLowerCase()

          return pipe(
            blockMap,
            HashMap.values,
            EffectArray.fromIterable,
            EffectArray.filter(
              (block: BlockType) =>
                block.id.toLowerCase().includes(lowerQuery) ||
                block.name.toLowerCase().includes(lowerQuery) ||
                block.category.toLowerCase().includes(lowerQuery) ||
                block.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
            )
          )
        }),

      registerBlock: (block: BlockType) =>
        Effect.gen(function* () {
          const exists = HashMap.has(blockMap, block.id)

          if (exists) {
            return yield* Effect.fail(BlockAlreadyRegisteredError(block.id))
          }

          // ブロックマップに追加
          blockMap = HashMap.set(blockMap, block.id, block)

          // カテゴリーインデックスに追加
          yield* pipe(
            Match.value(!categoryIndex.has(block.category)),
            Match.when(true, () => Effect.sync(() => categoryIndex.set(block.category, new Set()))),
            Match.orElse(() => Effect.void)
          )
          categoryIndex.get(block.category)!.add(block.id)

          // タグインデックスに追加
          block.tags.forEach((tag) => {
            if (!tagIndex.has(tag)) {
              tagIndex.set(tag, new Set())
            }
            tagIndex.get(tag)!.add(block.id)
          })
        }),

      isBlockRegistered: (id: string) => Effect.succeed(HashMap.has(blockMap, id)),
    } satisfies BlockRegistry
  })
)

// ヘルパー関数

// ブロックIDでブロックを取得
export const getBlock = (id: string) =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.getBlock(id)
  })

// 全ブロックを取得
export const getAllBlocks = () =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.getAllBlocks()
  })

// カテゴリー別にブロックを取得
export const getBlocksByCategory = (category: BlockCategory) =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.getBlocksByCategory(category)
  })

// タグでブロックを検索
export const getBlocksByTag = (tag: string) =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.getBlocksByTag(tag)
  })

// クエリでブロックを検索
export const searchBlocks = (query: string) =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.searchBlocks(query)
  })

// 新しいブロックを登録
export const registerBlock = (block: BlockType) =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.registerBlock(block)
  })

// ブロックが登録済みか確認
export const isBlockRegistered = (id: string) =>
  Effect.gen(function* () {
    const registry = yield* BlockRegistry
    return yield* registry.isBlockRegistered(id)
  })
