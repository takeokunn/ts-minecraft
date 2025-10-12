import { Effect, Either, Match, pipe, ReadonlyArray, Schema } from 'effect'
import { ItemIdSchema, ItemNameSchema, NamespaceSchema } from './schema'
import {
  ItemCategory,
  ItemComparison,
  ItemId,
  ItemIdError,
  ItemName,
  ItemRarity,
  ItemSearchCriteria,
  makeUnsafeItemName,
  makeUnsafeNamespace,
  Namespace,
} from './types'

/**
 * ItemId ファクトリー関数
 */
export const createItemId = (input: string): Effect.Effect<ItemId, ItemIdError> =>
  pipe(
    Schema.decodeUnknown(ItemIdSchema)(input),
    Effect.mapError(() =>
      ItemIdError.InvalidFormat({
        input,
        expected: 'namespace:name',
      })
    )
  )

/**
 * 名前空間とアイテム名からItemIdを作成
 */
export const createItemIdFromParts = (namespace: string, name: string): Effect.Effect<ItemId, ItemIdError> =>
  Effect.gen(function* () {
    const validNamespace = yield* pipe(
      Schema.decodeUnknown(NamespaceSchema)(namespace),
      Effect.mapError(() =>
        ItemIdError.InvalidNamespace({
          namespace,
          pattern: '^[a-z0-9._-]+$',
        })
      )
    )

    const validName = yield* pipe(
      Schema.decodeUnknown(ItemNameSchema)(name),
      Effect.mapError(() =>
        ItemIdError.InvalidItemName({
          name,
          pattern: '^[a-z0-9/_-]+$',
        })
      )
    )

    return yield* createItemId(`${validNamespace}:${validName}`)
  })

/**
 * ItemIdから名前空間を抽出
 */
export const getNamespace = (itemId: ItemId): Namespace => {
  const parts = (itemId as string).split(':')
  return makeUnsafeNamespace(parts[0])
}

/**
 * ItemIdからアイテム名を抽出
 */
export const getItemName = (itemId: ItemId): ItemName => {
  const parts = (itemId as string).split(':')
  return makeUnsafeItemName(parts[1])
}

/**
 * ItemIdを分解
 */
export const parseItemId = (itemId: ItemId): { namespace: Namespace; name: ItemName } => ({
  namespace: getNamespace(itemId),
  name: getItemName(itemId),
})

/**
 * Minecraftのバニラアイテムかどうかを判定
 */
export const isVanillaItem = (itemId: ItemId): boolean => getNamespace(itemId) === 'minecraft'

/**
 * MODアイテムかどうかを判定
 */
export const isModItem = (itemId: ItemId): boolean => getNamespace(itemId) !== 'minecraft'

/**
 * アイテムIDの比較
 */
export const compareItemIds = (itemId1: ItemId, itemId2: ItemId): ItemComparison => {
  return pipe(
    Match.value({ itemId1, itemId2 }),
    Match.when(
      ({ itemId1, itemId2 }) => itemId1 === itemId2,
      ({ itemId1 }) => ItemComparison.Same({ itemId: itemId1 })
    ),
    Match.orElse(({ itemId1, itemId2 }) => {
      const namespace1 = getNamespace(itemId1)
      const namespace2 = getNamespace(itemId2)
      const name1 = getItemName(itemId1)
      const name2 = getItemName(itemId2)

      return pipe(
        Match.value({ namespace1, namespace2 }),
        Match.when(
          ({ namespace1, namespace2 }) => namespace1 === namespace2,
          () =>
            ItemComparison.SameNamespace({
              namespace: namespace1,
              differentNames: [name1, name2],
            })
        ),
        Match.orElse(() =>
          ItemComparison.Different({
            item1: itemId1,
            item2: itemId2,
          })
        )
      )
    })
  )
}

/**
 * アイテムIDのバリデーション
 */
export const validateItemId = (input: string): Effect.Effect<boolean, ItemIdError> =>
  pipe(
    createItemId(input),
    Effect.map(() => true),
    Effect.catchAll((error) => Effect.fail(error))
  )

/**
 * アイテムカテゴリからデフォルトレアリティを取得
 */
export const getDefaultRarity = (category: ItemCategory): ItemRarity =>
  pipe(
    category,
    Match.value,
    Match.tag('Block', () => ItemRarity.Common({ color: '#FFFFFF' })),
    Match.tag('Tool', (tool) =>
      tool.toolType === 'sword' || tool.toolType === 'bow' || tool.toolType === 'crossbow'
        ? ItemRarity.Uncommon({ color: '#55FF55' })
        : ItemRarity.Common({ color: '#FFFFFF' })
    ),
    Match.tag('Armor', () => ItemRarity.Uncommon({ color: '#55FF55' })),
    Match.tag('Food', () => ItemRarity.Common({ color: '#FFFFFF' })),
    Match.tag('Material', (material) =>
      pipe(
        material.rarity,
        Match.value,
        Match.when('common', () => ItemRarity.Common({ color: '#FFFFFF' })),
        Match.when('uncommon', () => ItemRarity.Uncommon({ color: '#55FF55' })),
        Match.when('rare', () => ItemRarity.Rare({ color: '#5555FF' })),
        Match.when('epic', () => ItemRarity.Epic({ color: '#AA00AA' })),
        Match.when('legendary', () => ItemRarity.Legendary({ color: '#FFAA00' })),
        Match.exhaustive
      )
    ),
    Match.tag('Potion', () => ItemRarity.Rare({ color: '#5555FF' })),
    Match.tag('Misc', () => ItemRarity.Common({ color: '#FFFFFF' })),
    Match.exhaustive
  )

/**
 * アイテムIDからカテゴリを推定
 */
export const inferCategory = (itemId: ItemId): Effect.Effect<ItemCategory, ItemIdError> => {
  const name = getItemName(itemId)
  const nameStr = name as string

  // ツール判定
  return pipe(
    Match.value(nameStr),
    Match.when(
      (n) => n.includes('sword'),
      () => Effect.succeed(ItemCategory.Tool({ toolType: 'sword' }))
    ),
    Match.when(
      (n) => n.includes('pickaxe'),
      () => Effect.succeed(ItemCategory.Tool({ toolType: 'pickaxe' }))
    ),
    Match.when(
      (n) => n.includes('axe') && !n.includes('pickaxe'),
      () => Effect.succeed(ItemCategory.Tool({ toolType: 'axe' }))
    ),
    Match.when(
      (n) => n.includes('shovel'),
      () => Effect.succeed(ItemCategory.Tool({ toolType: 'shovel' }))
    ),
    Match.when(
      (n) => n.includes('hoe'),
      () => Effect.succeed(ItemCategory.Tool({ toolType: 'hoe' }))
    ),
    Match.when(
      (n) => n.includes('bow'),
      () => Effect.succeed(ItemCategory.Tool({ toolType: 'bow' }))
    ),
    // 防具判定
    Match.when(
      (n) => n.includes('helmet'),
      () => Effect.succeed(ItemCategory.Armor({ slot: 'helmet' }))
    ),
    Match.when(
      (n) => n.includes('chestplate'),
      () => Effect.succeed(ItemCategory.Armor({ slot: 'chestplate' }))
    ),
    Match.when(
      (n) => n.includes('leggings'),
      () => Effect.succeed(ItemCategory.Armor({ slot: 'leggings' }))
    ),
    Match.when(
      (n) => n.includes('boots'),
      () => Effect.succeed(ItemCategory.Armor({ slot: 'boots' }))
    ),
    // 食べ物判定
    Match.when(
      (n) => {
        const foodItems = ['bread', 'apple', 'carrot', 'potato', 'beef', 'pork', 'chicken', 'fish', 'cookie', 'cake']
        return foodItems.some((food) => n.includes(food))
      },
      () => Effect.succeed(ItemCategory.Food({ nutrition: 4, saturation: 0.3 }))
    ),
    // ブロック判定
    Match.when(
      (n) => n.includes('block') || n.includes('stone') || n.includes('wood'),
      () => Effect.succeed(ItemCategory.Block({ subtype: 'building' }))
    ),
    // ポーション判定
    Match.when(
      (n) => n.includes('potion'),
      () => Effect.succeed(ItemCategory.Potion({ effects: [], duration: 180 }))
    ),
    // その他（デフォルト）
    Match.orElse(() => Effect.succeed(ItemCategory.Misc({ description: 'Miscellaneous item' })))
  )
}

/**
 * アイテム検索
 */
export const searchItems = (
  items: readonly ItemId[],
  criteria: ItemSearchCriteria
): Effect.Effect<readonly ItemId[], ItemIdError> =>
  Effect.succeed(
    pipe(
      items,
      // 名前空間フィルタ
      (items) => (criteria.namespace ? items.filter((item) => getNamespace(item) === criteria.namespace) : items),
      // 名前パターンフィルタ
      (items) =>
        pipe(
          Option.fromNullable(criteria.namePattern),
          Option.match({
            onNone: () => items,
            onSome: (pattern) => items.filter((item) => pattern.test(getItemName(item) as string)),
          })
        )
    )
  )

/**
 * 一般的なMinecraftアイテムのファクトリー関数
 */
export const createMinecraftItem = (name: string): Effect.Effect<ItemId, ItemIdError> =>
  createItemIdFromParts('minecraft', name)

/**
 * アイテムIDの正規化（小文字化、無効文字の除去）
 */
export const normalizeItemId = (input: string): Effect.Effect<ItemId, ItemIdError> => {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  return createItemId(normalized)
}

/**
 * アイテムIDの短縮表示（名前空間がminecraftの場合は省略）
 */
export const getDisplayName = (itemId: ItemId): string => {
  const namespace = getNamespace(itemId)
  const name = getItemName(itemId)

  return pipe(
    Match.value(namespace),
    Match.when((value) => value === 'minecraft', () => name as string),
    Match.orElse(() => itemId as string)
  )
}

/**
 * 複数のアイテムIDの一括検証
 */
export const validateItemIds = (inputs: readonly string[]): Effect.Effect<readonly ItemId[], readonly ItemIdError[]> =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(inputs, (input) => pipe(createItemId(input), Effect.either), {
      concurrency: 4,
    })

    const { errors, validItems } = pipe(
      results,
      ReadonlyArray.partitionMap((result) =>
        result._tag === 'Left' ? Either.left(result.left) : Either.right(result.right)
      )
    )

    return yield* pipe(
      Match.value(errors.length),
      Match.when(
        (count) => count > 0,
        () => Effect.fail(errors)
      ),
      Match.orElse(() => Effect.succeed(validItems))
    )
  })
