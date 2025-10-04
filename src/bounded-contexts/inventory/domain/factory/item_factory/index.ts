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
import { Effect, Layer } from 'effect'
import { ItemBuilderFactoryLayer } from './builders'
import { ItemFactoryLayer } from './factory'
import { ItemBuilderFactory, ItemFactory } from './interface'

/**
 * 全ItemFactoryサービスを統合したLayer
 * アプリケーション層で一度に全てのItemファクトリーを利用可能にする
 */
export const ItemFactoryAllLayer = Layer.mergeAll(
  Layer.effect(ItemFactory, ItemFactoryLayer),
  Layer.effect(ItemBuilderFactory, ItemBuilderFactoryLayer)
)

// ===== 便利なヘルパー関数（Function.flowパターン） =====

/**
 * 関数型ItemFactoryのワンライナー生成
 */
export const ItemFactoryHelpers = {
  // 最も一般的なユースケース
  createBasic: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const factory = yield* ItemFactory
      return yield* factory.createBasic(itemId as any, count) // Brand typeへの変換
    }),

  createTool: (itemId: string, durability?: number) =>
    Effect.gen(function* () {
      const factory = yield* ItemFactory
      return yield* factory.createTool(itemId as any, durability)
    }),

  createWeapon: (itemId: string, durability?: number) =>
    Effect.gen(function* () {
      const factory = yield* ItemFactory
      return yield* factory.createWeapon(itemId as any, durability)
    }),

  createFood: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const factory = yield* ItemFactory
      return yield* factory.createFood(itemId as any, count)
    }),

  createBlock: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const factory = yield* ItemFactory
      return yield* factory.createBlock(itemId as any, count)
    }),

  // Builder Pattern ワンライナー
  buildTool: (itemId: string) =>
    Effect.gen(function* () {
      const builderFactory = yield* ItemBuilderFactory
      const builder = builderFactory.create()
      return yield* builder
        .withItemId(itemId as any)
        .withCategory('tool')
        .build()
    }),

  buildWeapon: (itemId: string) =>
    Effect.gen(function* () {
      const builderFactory = yield* ItemBuilderFactory
      const builder = builderFactory.create()
      return yield* builder
        .withItemId(itemId as any)
        .withCategory('weapon')
        .build()
    }),

  buildFood: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const builderFactory = yield* ItemBuilderFactory
      const builder = builderFactory.create()
      let configuredBuilder = builder.withItemId(itemId as any).withCategory('food')

      if (count) {
        configuredBuilder = configuredBuilder.withCount(count)
      }

      return yield* configuredBuilder.build()
    }),

  buildBlock: (itemId: string, count?: number) =>
    Effect.gen(function* () {
      const builderFactory = yield* ItemBuilderFactory
      const builder = builderFactory.create()
      let configuredBuilder = builder.withItemId(itemId as any).withCategory('block')

      if (count) {
        configuredBuilder = configuredBuilder.withCount(count)
      }

      return yield* configuredBuilder.build()
    }),
} as const
