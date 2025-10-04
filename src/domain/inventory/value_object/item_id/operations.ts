import { Effect, Match, pipe, Schema } from 'effect'
import { ItemIdSchema, ItemNameSchema, NamespaceSchema } from './schema'
import {
  ItemCategory,
  ItemComparison,
  ItemId,
  ItemIdError,
  ItemName,
  ItemRarity,
  ItemSearchCriteria,
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
  return parts[0] as Namespace
}

/**
 * ItemIdからアイテム名を抽出
 */
export const getItemName = (itemId: ItemId): ItemName => {
  const parts = (itemId as string).split(':')
  return parts[1] as ItemName
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
  if (itemId1 === itemId2) {
    return ItemComparison.Same({ itemId: itemId1 })
  }

  const namespace1 = getNamespace(itemId1)
  const namespace2 = getNamespace(itemId2)
  const name1 = getItemName(itemId1)
  const name2 = getItemName(itemId2)

  if (namespace1 === namespace2) {
    return ItemComparison.SameNamespace({
      namespace: namespace1,
      differentNames: [name1, name2],
    })
  }

  return ItemComparison.Different({
    item1: itemId1,
    item2: itemId2,
  })
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
  if (nameStr.includes('sword')) {
    return Effect.succeed(ItemCategory.Tool({ toolType: 'sword' }))
  }
  if (nameStr.includes('pickaxe')) {
    return Effect.succeed(ItemCategory.Tool({ toolType: 'pickaxe' }))
  }
  if (nameStr.includes('axe') && !nameStr.includes('pickaxe')) {
    return Effect.succeed(ItemCategory.Tool({ toolType: 'axe' }))
  }
  if (nameStr.includes('shovel')) {
    return Effect.succeed(ItemCategory.Tool({ toolType: 'shovel' }))
  }
  if (nameStr.includes('hoe')) {
    return Effect.succeed(ItemCategory.Tool({ toolType: 'hoe' }))
  }
  if (nameStr.includes('bow')) {
    return Effect.succeed(ItemCategory.Tool({ toolType: 'bow' }))
  }

  // 防具判定
  if (nameStr.includes('helmet')) {
    return Effect.succeed(ItemCategory.Armor({ slot: 'helmet' }))
  }
  if (nameStr.includes('chestplate')) {
    return Effect.succeed(ItemCategory.Armor({ slot: 'chestplate' }))
  }
  if (nameStr.includes('leggings')) {
    return Effect.succeed(ItemCategory.Armor({ slot: 'leggings' }))
  }
  if (nameStr.includes('boots')) {
    return Effect.succeed(ItemCategory.Armor({ slot: 'boots' }))
  }

  // 食べ物判定
  const foodItems = ['bread', 'apple', 'carrot', 'potato', 'beef', 'pork', 'chicken', 'fish', 'cookie', 'cake']
  if (foodItems.some((food) => nameStr.includes(food))) {
    return Effect.succeed(ItemCategory.Food({ nutrition: 4, saturation: 0.3 }))
  }

  // ブロック判定（デフォルト）
  if (nameStr.includes('block') || nameStr.includes('stone') || nameStr.includes('wood')) {
    return Effect.succeed(ItemCategory.Block({ subtype: 'building' }))
  }

  // ポーション判定
  if (nameStr.includes('potion')) {
    return Effect.succeed(ItemCategory.Potion({ effects: [], duration: 180 }))
  }

  // その他
  return Effect.succeed(ItemCategory.Misc({ description: 'Miscellaneous item' }))
}

/**
 * アイテム検索
 */
export const searchItems = (
  items: readonly ItemId[],
  criteria: ItemSearchCriteria
): Effect.Effect<readonly ItemId[], ItemIdError> =>
  Effect.gen(function* () {
    let filteredItems = items

    // 名前空間フィルタ
    if (criteria.namespace) {
      filteredItems = filteredItems.filter((item) => getNamespace(item) === criteria.namespace)
    }

    // 名前パターンフィルタ
    if (criteria.namePattern) {
      filteredItems = filteredItems.filter((item) => criteria.namePattern!.test(getItemName(item) as string))
    }

    return filteredItems
  })

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

  if (namespace === 'minecraft') {
    return name as string
  }
  return itemId as string
}

/**
 * 複数のアイテムIDの一括検証
 */
export const validateItemIds = (inputs: readonly string[]): Effect.Effect<readonly ItemId[], readonly ItemIdError[]> =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(inputs, (input) => pipe(createItemId(input), Effect.either), {
      concurrency: 'unbounded',
    })

    const errors: ItemIdError[] = []
    const validItems: ItemId[] = []

    results.forEach((result) => {
      if (result._tag === 'Left') {
        errors.push(result.left)
      } else {
        validItems.push(result.right)
      }
    })

    if (errors.length > 0) {
      return yield* Effect.fail(errors)
    }

    return validItems
  })
