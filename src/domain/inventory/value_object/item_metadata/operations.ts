import { Effect, Array as EffectArray, Match, Option, pipe, ReadonlyArray, Schema } from 'effect'
import {
  CustomModelDataSchema,
  DisplayNameSchema,
  DurabilitySchema,
  EnchantmentSchema,
  ItemLoreSchema,
  ItemMetadataSchema,
} from './schema'
import {
  CustomModelData,
  DisplayName,
  Durability,
  Enchantment,
  EnchantmentEffect,
  ItemCondition,
  ItemLore,
  ItemMetadata,
  ItemMetadataError,
  MetadataComparison,
  MetadataOperation,
  NBTTag,
} from './types'

/**
 * 空のItemMetadata作成
 */
export const createEmptyMetadata = (): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(ItemMetadataSchema)({}),
    Effect.mapError(() =>
      ItemMetadataError.InvalidDisplayName({
        name: '',
        reason: 'Failed to create empty metadata',
      })
    )
  )

/**
 * Enchantment ファクトリー関数
 */
export const createEnchantment = (id: string, level: number): Effect.Effect<Enchantment, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(EnchantmentSchema)({ id, level }),
    Effect.mapError(() =>
      ItemMetadataError.InvalidEnchantment({
        enchantmentId: id,
        level,
        maxLevel: getMaxEnchantmentLevel(id),
      })
    )
  )

/**
 * Durability ファクトリー関数
 */
export const createDurability = (current: number, max: number): Effect.Effect<Durability, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(DurabilitySchema)({ current, max }),
    Effect.mapError(() =>
      ItemMetadataError.DurabilityOutOfRange({
        current,
        max,
      })
    )
  )

/**
 * DisplayName ファクトリー関数
 */
export const createDisplayName = (name: string): Effect.Effect<DisplayName, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(DisplayNameSchema)(name),
    Effect.mapError(() =>
      ItemMetadataError.InvalidDisplayName({
        name,
        reason: 'Name must be non-empty and max 256 characters',
      })
    )
  )

/**
 * ItemLore ファクトリー関数
 */
export const createItemLore = (lore: readonly string[]): Effect.Effect<ItemLore, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(ItemLoreSchema)(lore),
    Effect.mapError(() =>
      ItemMetadataError.InvalidLore({
        lore,
        reason: 'Lore must have max 20 lines, each max 256 characters',
      })
    )
  )

/**
 * CustomModelData ファクトリー関数
 */
export const createCustomModelData = (data: number): Effect.Effect<CustomModelData, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(CustomModelDataSchema)(data),
    Effect.mapError(() =>
      ItemMetadataError.InvalidDisplayName({
        name: data.toString(),
        reason: 'Custom model data must be positive integer',
      })
    )
  )

/**
 * ItemMetadata ファクトリー関数
 */
export const createItemMetadata = (
  metadata: Partial<{
    display?: {
      name?: DisplayName
      lore?: ItemLore
      color?: number
    }
    enchantments?: readonly Enchantment[]
    durability?: Durability
    customModelData?: CustomModelData
    customTags?: Record<string, NBTTag>
    hideFlags?: number
    unbreakable?: boolean
    canDestroy?: readonly string[]
    canPlaceOn?: readonly string[]
  }>
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  pipe(
    Schema.decodeUnknown(ItemMetadataSchema)(metadata),
    Effect.mapError(() =>
      ItemMetadataError.InvalidDisplayName({
        name: 'metadata',
        reason: 'Invalid metadata structure',
      })
    )
  )

/**
 * エンチャントを追加
 */
export const addEnchantment = (
  metadata: ItemMetadata,
  enchantment: Enchantment
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  Effect.gen(function* () {
    const currentEnchantments = metadata.enchantments ?? []

    // 競合エンチャント検出
    const conflictingEnchantment = ReadonlyArray.findFirst(currentEnchantments, (existing) =>
      isEnchantmentConflicting(existing.id, enchantment.id)
    )

    // バリデーション: 競合エンチャントが存在しないこと
    yield* Effect.succeed(conflictingEnchantment).pipe(
      Effect.filterOrFail(Option.isNone, () => {
        const conflict = Option.getOrThrow(conflictingEnchantment)
        return ItemMetadataError.ConflictingEnchantments({
          enchantment1: conflict.id,
          enchantment2: enchantment.id,
        })
      })
    )

    // 同じエンチャントを置き換え
    const updatedEnchantments = pipe(
      currentEnchantments,
      ReadonlyArray.filter((existing) => existing.id !== enchantment.id),
      ReadonlyArray.append(enchantment)
    )

    return yield* createItemMetadata({
      ...metadata,
      enchantments: updatedEnchantments,
    })
  })

/**
 * エンチャントを削除
 */
export const removeEnchantment = (
  metadata: ItemMetadata,
  enchantmentId: string
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  Effect.gen(function* () {
    const currentEnchantments = metadata.enchantments ?? []
    const updatedEnchantments = currentEnchantments.filter((e) => e.id !== enchantmentId)

    return yield* createItemMetadata({
      ...metadata,
      enchantments: updatedEnchantments.length > 0 ? updatedEnchantments : undefined,
    })
  })

/**
 * 表示名を設定
 */
export const setDisplayName = (
  metadata: ItemMetadata,
  name: DisplayName
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  createItemMetadata({
    ...metadata,
    display: {
      ...metadata.display,
      name,
    },
  })

/**
 * 説明文を設定
 */
export const setLore = (metadata: ItemMetadata, lore: ItemLore): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  createItemMetadata({
    ...metadata,
    display: {
      ...metadata.display,
      lore,
    },
  })

/**
 * 耐久値を更新
 */
export const updateDurability = (
  metadata: ItemMetadata,
  durability: Durability
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  createItemMetadata({
    ...metadata,
    durability,
  })

/**
 * 耐久値を減らす
 */
export const damageDurability = (
  metadata: ItemMetadata,
  damage: number
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  pipe(
    metadata.durability,
    Option.fromNullable,
    Match.value,
    Match.tag('None', () => Effect.succeed(metadata)),
    Match.tag('Some', ({ value }) =>
      pipe(
        createDurability(Math.max(0, value.current - damage), value.max),
        Effect.flatMap((newDurability) => updateDurability(metadata, newDurability))
      )
    ),
    Match.exhaustive
  )

/**
 * 耐久値を修復
 */
export const repairDurability = (
  metadata: ItemMetadata,
  repairAmount: number
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  pipe(
    metadata.durability,
    Option.fromNullable,
    Match.value,
    Match.tag('None', () => Effect.succeed(metadata)),
    Match.tag('Some', ({ value }) =>
      pipe(
        createDurability(Math.min(value.max, value.current + repairAmount), value.max),
        Effect.flatMap((newDurability) => updateDurability(metadata, newDurability))
      )
    ),
    Match.exhaustive
  )

/**
 * カスタムタグを設定
 */
export const setCustomTag = (
  metadata: ItemMetadata,
  key: string,
  value: NBTTag
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  createItemMetadata({
    ...metadata,
    customTags: {
      ...metadata.customTags,
      [key]: value,
    },
  })

/**
 * カスタムタグを削除
 */
export const removeCustomTag = (metadata: ItemMetadata, key: string): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  pipe(
    metadata.customTags,
    Option.fromNullable,
    Match.value,
    Match.tag('None', () => Effect.succeed(metadata)),
    Match.tag('Some', ({ value: tags }) =>
      pipe(
        Match.value(tags),
        Match.when((current) => !(key in current), () => Effect.succeed(metadata)),
        Match.when(
          () => true,
          (current) => {
            const { [key]: _, ...remainingTags } = current

            return createItemMetadata({
              ...metadata,
              customTags: pipe(
                Object.keys(remainingTags).length,
                Match.value,
                Match.when(0, () => undefined),
                Match.when(() => true, () => remainingTags),
                Match.exhaustive
              ),
            })
          }
        ),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )

/**
 * 非破壊フラグを設定
 */
export const setUnbreakable = (
  metadata: ItemMetadata,
  unbreakable: boolean
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  createItemMetadata({
    ...metadata,
    unbreakable: unbreakable ? unbreakable : undefined,
  })

/**
 * アイテムの状態を判定
 */
export const getItemCondition = (metadata: ItemMetadata): ItemCondition =>
  pipe(
    metadata.durability,
    Option.fromNullable,
    Match.value,
    Match.tag('None', () => ItemCondition.Perfect({ description: 'Brand new condition' })),
    Match.tag('Some', ({ value }) =>
      pipe(
        Match.value((value.current / value.max) * 100),
        Match.when(
          (percentage) => percentage === 100,
          () => ItemCondition.Perfect({ description: 'Brand new condition' })
        ),
        Match.when(
          (percentage) => percentage >= 80,
          (percentage) => ItemCondition.Excellent({ durabilityPercentage: percentage })
        ),
        Match.when(
          (percentage) => percentage >= 60,
          (percentage) => ItemCondition.Good({ durabilityPercentage: percentage })
        ),
        Match.when(
          (percentage) => percentage >= 40,
          (percentage) => ItemCondition.Fair({ durabilityPercentage: percentage })
        ),
        Match.when(
          (percentage) => percentage >= 20,
          (percentage) => ItemCondition.Poor({ durabilityPercentage: percentage })
        ),
        Match.when(() => true, () => ItemCondition.Broken({ canRepair: true })),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )

/**
 * エンチャントの競合をチェック
 */
export const isEnchantmentConflicting = (enchantment1: string, enchantment2: string): boolean => {
  const conflictGroups = [
    ['minecraft:sharpness', 'minecraft:smite', 'minecraft:bane_of_arthropods'],
    [
      'minecraft:protection',
      'minecraft:fire_protection',
      'minecraft:blast_protection',
      'minecraft:projectile_protection',
    ],
    ['minecraft:silk_touch', 'minecraft:fortune'],
    ['minecraft:infinity', 'minecraft:mending'],
  ]

  return conflictGroups.some(
    (group) => group.includes(enchantment1) && group.includes(enchantment2) && enchantment1 !== enchantment2
  )
}

/**
 * エンチャントの最大レベルを取得
 */
export const getMaxEnchantmentLevel = (enchantmentId: string): number => {
  const maxLevels: Record<string, number> = {
    'minecraft:sharpness': 5,
    'minecraft:smite': 5,
    'minecraft:bane_of_arthropods': 5,
    'minecraft:protection': 4,
    'minecraft:fire_protection': 4,
    'minecraft:blast_protection': 4,
    'minecraft:projectile_protection': 4,
    'minecraft:efficiency': 5,
    'minecraft:unbreaking': 3,
    'minecraft:fortune': 3,
    'minecraft:silk_touch': 1,
    'minecraft:power': 5,
    'minecraft:punch': 2,
    'minecraft:flame': 1,
    'minecraft:infinity': 1,
    'minecraft:mending': 1,
  }

  return maxLevels[enchantmentId] ?? 1
}

/**
 * メタデータのサイズを計算（概算）
 */
export const calculateMetadataSize = (metadata: ItemMetadata): number =>
  pipe(
    [
      pipe(
        Match.value(metadata.display?.name),
        Match.when(undefined, () => 0),
        Match.when(() => true, (name) => (name as string).length * 2),
        Match.exhaustive
      ),
      pipe(
        Match.value(metadata.display?.lore),
        Match.when(undefined, () => 0),
        Match.when(
          (lore): lore is readonly string[] => Array.isArray(lore),
          (lore) => pipe(lore, ReadonlyArray.reduce(0, (sum, line) => sum + line.length * 2))
        ),
        Match.orElse(() => 0),
        Match.exhaustive
      ),
      pipe(
        Match.value(metadata.enchantments),
        Match.when(undefined, () => 0),
        Match.when(
          (enchantments): enchantments is readonly Enchantment[] => Array.isArray(enchantments),
          (enchantments) => enchantments.length * 16
        ),
        Match.exhaustive
      ),
      pipe(
        Match.value(metadata.customTags),
        Match.when(undefined, () => 0),
        Match.when(() => true, (tags) => Object.keys(tags).length * 32),
        Match.exhaustive
      ),
    ],
    ReadonlyArray.reduce(0, (acc, value) => acc + value)
  )

/**
 * メタデータを比較
 */
export const compareMetadata = (metadata1: ItemMetadata, metadata2: ItemMetadata): MetadataComparison => {
  const differenceOptions = [
    pipe(
      Match.value(metadata1.display?.name === metadata2.display?.name),
      Match.when(true, () => Option.none<string>()),
      Match.when(() => true, () => Option.some('display name')),
      Match.exhaustive
    ),
    pipe(
      Match.value<[unknown, unknown]>([metadata1.display?.lore, metadata2.display?.lore]),
      Match.when(
        ([left, right]) => !EffectArray.isArray(left) && !EffectArray.isArray(right),
        () => Option.none<string>()
      ),
      Match.when(
        ([left, right]) => JSON.stringify(left) !== JSON.stringify(right),
        () => Option.some('lore')
      ),
      Match.orElse(() => Option.none<string>()),
      Match.exhaustive
    ),
    pipe(
      Match.value(JSON.stringify(metadata1.enchantments) === JSON.stringify(metadata2.enchantments)),
      Match.when(true, () => Option.none<string>()),
      Match.when(() => true, () => Option.some('enchantments')),
      Match.exhaustive
    ),
    pipe(
      Match.value(JSON.stringify(metadata1.durability) === JSON.stringify(metadata2.durability)),
      Match.when(true, () => Option.none<string>()),
      Match.when(() => true, () => Option.some('durability')),
      Match.exhaustive
    ),
  ] as const

  const differences = pipe(differenceOptions, ReadonlyArray.compact)

  return pipe(
    Match.value(differences.length),
    Match.when(0, () => MetadataComparison.Identical({})),
    Match.orElse(() => MetadataComparison.Different({ differences: [...differences] })),
    Match.exhaustive
  )
}

/**
 * メタデータ操作を実行
 */
export const executeMetadataOperation = (
  metadata: ItemMetadata,
  operation: MetadataOperation
): Effect.Effect<ItemMetadata, ItemMetadataError> =>
  pipe(
    operation,
    Match.value,
    Match.tag('SetDisplayName', (op) => setDisplayName(metadata, op.name)),
    Match.tag('SetLore', (op) => setLore(metadata, op.lore)),
    Match.tag('AddEnchantment', (op) => addEnchantment(metadata, op.enchantment)),
    Match.tag('RemoveEnchantment', (op) => removeEnchantment(metadata, op.enchantmentId)),
    Match.tag('UpdateDurability', (op) => updateDurability(metadata, op.durability)),
    Match.tag('SetCustomModelData', (op) => createItemMetadata({ ...metadata, customModelData: op.data })),
    Match.tag('SetCustomTag', (op) => setCustomTag(metadata, op.key, op.value)),
    Match.tag('RemoveCustomTag', (op) => removeCustomTag(metadata, op.key)),
    Match.tag('SetHideFlags', (op) => createItemMetadata({ ...metadata, hideFlags: op.flags })),
    Match.tag('SetUnbreakable', (op) => setUnbreakable(metadata, op.unbreakable)),
    Match.tag('AddCanDestroy', (op) =>
      createItemMetadata({
        ...metadata,
        canDestroy: [...(metadata.canDestroy ?? []), op.blockId],
      })
    ),
    Match.tag('AddCanPlaceOn', (op) =>
      createItemMetadata({
        ...metadata,
        canPlaceOn: [...(metadata.canPlaceOn ?? []), op.blockId],
      })
    ),
    Match.exhaustive
  )

/**
 * エンチャント効果を取得
 */
export const getEnchantmentEffect = (enchantment: Enchantment): EnchantmentEffect => {
  const { id, level } = enchantment

  return pipe(
    Match.value(id),
    Match.when('minecraft:sharpness', () => EnchantmentEffect.Sharpness({ damageBonus: level * 0.5 })),
    Match.when('minecraft:protection', () => EnchantmentEffect.Protection({ type: 'all' })),
    Match.when('minecraft:efficiency', () => EnchantmentEffect.Efficiency({ speedMultiplier: 1 + level * 0.3 })),
    Match.when('minecraft:fortune', () => EnchantmentEffect.Fortune({ dropMultiplier: 1 + level * 0.5 })),
    Match.when('minecraft:silk_touch', () => EnchantmentEffect.SilkTouch({})),
    Match.when('minecraft:unbreaking', () => EnchantmentEffect.Unbreaking({ durabilityMultiplier: 1 + level / 3 })),
    Match.when('minecraft:mending', () => EnchantmentEffect.Mending({})),
    Match.when('minecraft:infinity', () => EnchantmentEffect.Infinity({})),
    Match.orElse(() =>
      EnchantmentEffect.Custom({
        name: id,
        description: `Custom enchantment: ${id}`,
        effect: { level },
      })
    )
  )
}
