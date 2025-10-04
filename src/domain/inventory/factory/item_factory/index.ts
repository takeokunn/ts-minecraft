/**
 * ItemFactory - Unified Export Module
 *
 * DDD Factory PatternによるItemStack生成システムの統一エクスポート
 * Effect-TSの関数型パターンによる純粋関数ファクトリー
 */

// ===== Interface Exports =====
export type {
  EnchantmentDefinition,
  ItemBuilder,
  ItemBuilderConfig,
  ItemBuilderFactory,
  ItemCategory,
  ItemConfig,
  ItemFactory,
  ItemQuality,
  ItemRarity,
  StackingRules,
} from './interface'

export {
  defaultItemConfig,
  defaultStackingRules,
  ItemBuilderFactory as ItemBuilderFactoryTag,
  ItemCreationError,
  ItemFactory as ItemFactoryTag,
  ItemStackError,
  ItemValidationError,
} from './interface'

// ===== Factory Implementation Exports =====
export { ItemFactoryLayer, ItemFactoryLive } from './factory'

// ===== Builder Implementation Exports =====
export {
  armorItemBuilder,
  blockItemBuilder,
  createItemBuilder,
  customItemBuilder,
  enchantedItemBuilder,
  foodItemBuilder,
  ItemBuilderFactoryLayer,
  ItemBuilderFactoryLive,
  toolItemBuilder,
  weaponItemBuilder,
} from './builders'

// ===== Preset Implementation Exports =====
export {
  arrow,
  // プリセット情報
  availableItemPresets,
  // 特殊アイテムプリセット
  bow,
  // 食料プリセット
  bread,
  button,
  cobblestone,
  cookedBeef,
  createPresetItem,
  // ヘルパー関数
  customDurabilityItem,
  customEnchantedItem,
  diamondChestplate,
  diamondHelmet,
  diamondPickaxe,
  diamondSword,
  dirt,
  enchantedDiamondPickaxe,
  // エンチャント付きプリセット
  enchantedDiamondSword,
  enchantedGoldenApple,
  glass,
  goldenApple,
  ironChestplate,
  ironHelmet,
  ironPickaxe,
  ironSword,
  itemPresetInfo,
  leatherBoots,
  leatherChestplate,
  // 防具プリセット
  leatherHelmet,
  leatherLeggings,
  lever,
  oakPlanks,
  piston,
  redstone,
  redstoneTorch,
  stickyPiston,
  // ブロックプリセット
  stone,
  stoneAxe,
  stonePickaxe,
  stoneSword,
  woodenAxe,
  woodenHoe,
  woodenPickaxe,
  woodenShovel,
  // 基本ツールプリセット
  woodenSword,
  type ItemPresetName,
} from './presets'

// ===== 統一Layer Export（全ItemFactoryの組み合わせ） =====
import { Effect, Layer, Option, pipe } from 'effect'
import { ItemBuilderFactoryLayer } from './builders'
import { ItemFactoryLayer } from './factory'
import { ItemBuilderFactory, ItemCreationError, ItemFactory } from './interface'
import { parseDurability, parseItemId, parseItemQuantity } from '../../types'

/**
 * 全ItemFactoryサービスを統合したLayer
 * アプリケーション層で一度に全てのItemファクトリーを利用可能にする
 */
export const ItemFactoryAllLayer = Layer.mergeAll(
  Layer.effect(ItemFactory, ItemFactoryLayer),
  Layer.effect(ItemBuilderFactory, ItemBuilderFactoryLayer)
)

// ===== 便利なヘルパー関数（Function.flowパターン） =====

const toCreationError = (
  reason: string,
  invalidFields: ReadonlyArray<string>,
  context: Record<string, unknown>
) =>
  new ItemCreationError({
    reason,
    invalidFields: [...invalidFields],
    context,
  })

const decodeItemId = (itemId: string) =>
  parseItemId(itemId).pipe(
    Effect.mapError((error) =>
      toCreationError('itemId parsing failed', ['itemId'], { itemId, error })
    )
  )

const decodeOptionalCount = (count: number | undefined) =>
  pipe(
    Option.fromNullable(count),
    Option.match({
      onNone: () => Effect.succeed(Option.none<number>()),
      onSome: (value) =>
        parseItemQuantity(value).pipe(
          Effect.map(Option.some),
          Effect.mapError((error) =>
            toCreationError('count validation failed', ['count'], { count: value, error })
          )
        ),
    })
  )

const decodeOptionalDurability = (durability: number | undefined) =>
  pipe(
    Option.fromNullable(durability),
    Option.match({
      onNone: () => Effect.succeed(Option.none<number>()),
      onSome: (value) =>
        parseDurability(value).pipe(
          Effect.map(Option.some),
          Effect.mapError((error) =>
            toCreationError('durability validation failed', ['durability'], {
              durability: value,
              error,
            })
          )
        ),
    })
  )

const applyOptional = <A, B>(
  option: Option.Option<A>,
  onSome: (value: A) => B,
  onNone: () => B
) =>
  pipe(
    option,
    Option.match({
      onNone,
      onSome,
    })
  )

/**
 * 関数型ItemFactoryのワンライナー生成
 */
export const ItemFactoryHelpers = {
  // 最も一般的なユースケース
  createBasic: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const { factory, id, quantity } = yield* Effect.all({
        factory: ItemFactory,
        id: decodeItemId(itemId),
        quantity: decodeOptionalCount(count),
      })
      return yield* factory.createBasic(id, Option.getOrUndefined(quantity))
    }),

  createTool: (itemId: string, durability?: number) =>
    Effect.gen(function* () {
      const { factory, id, ratio } = yield* Effect.all({
        factory: ItemFactory,
        id: decodeItemId(itemId),
        ratio: decodeOptionalDurability(durability),
      })
      return yield* factory.createTool(id, Option.getOrUndefined(ratio))
    }),

  createWeapon: (itemId: string, durability?: number) =>
    Effect.gen(function* () {
      const { factory, id, ratio } = yield* Effect.all({
        factory: ItemFactory,
        id: decodeItemId(itemId),
        ratio: decodeOptionalDurability(durability),
      })
      return yield* factory.createWeapon(id, Option.getOrUndefined(ratio))
    }),

  createFood: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const { factory, id, quantity } = yield* Effect.all({
        factory: ItemFactory,
        id: decodeItemId(itemId),
        quantity: decodeOptionalCount(count),
      })
      return yield* factory.createFood(id, Option.getOrUndefined(quantity))
    }),

  createBlock: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const { factory, id, quantity } = yield* Effect.all({
        factory: ItemFactory,
        id: decodeItemId(itemId),
        quantity: decodeOptionalCount(count),
      })
      return yield* factory.createBlock(id, Option.getOrUndefined(quantity))
    }),

  // Builder Pattern ワンライナー
  buildTool: (itemId: string) =>
    Effect.gen(function* () {
      const { factory, id } = yield* Effect.all({
        factory: ItemBuilderFactory,
        id: decodeItemId(itemId),
      })
      return yield* factory.create().withItemId(id).withCategory('tool').build()
    }),

  buildWeapon: (itemId: string) =>
    Effect.gen(function* () {
      const { factory, id } = yield* Effect.all({
        factory: ItemBuilderFactory,
        id: decodeItemId(itemId),
      })
      return yield* factory.create().withItemId(id).withCategory('weapon').build()
    }),

  buildFood: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const { factory, id, quantity } = yield* Effect.all({
        factory: ItemBuilderFactory,
        id: decodeItemId(itemId),
        quantity: decodeOptionalCount(count),
      })
      const baseBuilder = factory.create().withItemId(id).withCategory('food')
      const configured = applyOptional(
        quantity,
        (value) => baseBuilder.withCount(value),
        () => baseBuilder
      )
      return yield* configured.build()
    }),

  buildBlock: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const { factory, id, quantity } = yield* Effect.all({
        factory: ItemBuilderFactory,
        id: decodeItemId(itemId),
        quantity: decodeOptionalCount(count),
      })
      const baseBuilder = factory.create().withItemId(id).withCategory('block')
      const configured = applyOptional(
        quantity,
        (value) => baseBuilder.withCount(value),
        () => baseBuilder
      )
      return yield* configured.build()
    }),
} as const
