/**
 * ContainerFactory - Unified Export Module
 *
 * DDD Factory PatternによるContainer生成システムの統一エクスポート
 * Effect-TSの関数型パターンによる純粋関数ファクトリー
 */

// ===== Interface Exports =====
export type {
  Container,
  ContainerBuilder,
  ContainerBuilderConfig,
  ContainerBuilderFactory,
  ContainerConfig,
  ContainerFactory,
  ContainerPermissions,
  ContainerSlot,
  ContainerType,
  ContainerTypeSpec,
} from './interface'

export {
  ContainerBuilderFactory as ContainerBuilderFactoryTag,
  ContainerCreationError,
  ContainerFactory as ContainerFactoryTag,
  ContainerOperationError,
  containerTypeSpecs,
  ContainerValidationError,
  defaultContainerPermissions,
} from './interface'

// ===== Factory Implementation Exports =====
export { ContainerFactoryLayer, ContainerFactoryLive } from './factory'

// ===== Builder Implementation Exports =====
export {
  brewingStandContainerBuilder,
  chestContainerBuilder,
  ContainerBuilderFactoryLayer,
  ContainerBuilderFactoryLive,
  craftingTableContainerBuilder,
  createContainerBuilder,
  customContainerBuilder,
  furnaceContainerBuilder,
  hopperContainerBuilder,
  ownedContainerBuilder,
  positionedContainerBuilder,
  preloadedContainerBuilder,
  shulkerBoxContainerBuilder,
} from './builders'

// ===== Preset Implementation Exports =====
export {
  anvil,
  // プリセット情報
  availableContainerPresets,
  barrel,
  blastFurnace,
  brewingStand,
  buildingMaterialChest,
  coloredShulkerBox,
  containerPresetInfo,
  craftingTable,
  createPresetContainer,
  // ヘルパー関数
  customPermissionContainer,
  dispenser,
  doubleChest,
  dropper,
  enchantingTable,
  enderChest,
  foodCookingSmoker,
  // 特殊用途コンテナプリセット
  fueledFurnace,
  grindstone,

  // 自動化・レッドストーンコンテナプリセット
  hopper,
  lockedChest,

  // 専門用途コンテナプリセット
  oreSmeltingFurnace,
  // 位置ベースコンテナプリセット
  positionedChest,
  positionedFurnace,
  potionBrewingStand,
  // オーナーシップ付きコンテナプリセット
  privateChest,
  redstoneCircuitChest,
  sharedChest,
  smoker,
  // 基本ストレージコンテナプリセット
  standardChest,
  // 製作・加工コンテナプリセット
  standardFurnace,
  starterToolChest,
  type ContainerPresetName,
} from './presets'

// ===== 統一Layer Export（全ContainerFactoryの組み合わせ） =====
import { Effect, Layer } from 'effect'
import { ContainerBuilderFactoryLayer } from './builders'
import { ContainerFactoryLayer } from './factory'
import { ContainerBuilderFactory, ContainerFactory } from './interface'

/**
 * 全ContainerFactoryサービスを統合したLayer
 * アプリケーション層で一度に全てのContainerファクトリーを利用可能にする
 */
export const ContainerFactoryAllLayer = Layer.mergeAll(
  Layer.effect(ContainerFactory, ContainerFactoryLayer),
  Layer.effect(ContainerBuilderFactory, ContainerBuilderFactoryLayer)
)

// ===== 便利なヘルパー関数（Function.flowパターン） =====

/**
 * 関数型ContainerFactoryのワンライナー生成
 */
export const ContainerFactoryHelpers = {
  // 最も一般的なユースケース
  createChest: (id: string, size?: 'small' | 'large') =>
    Effect.gen(function* () {
      const factory = yield* ContainerFactory
      return yield* factory.createChest(id, size)
    }),

  createFurnace: (id: string, variant?: 'furnace' | 'blast_furnace' | 'smoker') =>
    Effect.gen(function* () {
      const factory = yield* ContainerFactory
      return yield* factory.createFurnace(id, variant)
    }),

  createHopper: (id: string) =>
    Effect.gen(function* () {
      const factory = yield* ContainerFactory
      return yield* factory.createHopper(id)
    }),

  createBrewingStand: (id: string) =>
    Effect.gen(function* () {
      const factory = yield* ContainerFactory
      return yield* factory.createBrewingStand(id)
    }),

  createCraftingTable: (id: string) =>
    Effect.gen(function* () {
      const factory = yield* ContainerFactory
      return yield* factory.createCraftingTable(id)
    }),

  createShulkerBox: (id: string, color?: string) =>
    Effect.gen(function* () {
      const factory = yield* ContainerFactory
      return yield* factory.createShulkerBox(id, color)
    }),

  // Builder Pattern ワンライナー
  buildChest: (id: string, size?: 'small' | 'large') =>
    Effect.gen(function* () {
      const builderFactory = yield* ContainerBuilderFactory
      const builder = builderFactory.create()
      return yield* builder
        .withId(id)
        .withType(size === 'large' ? 'large_chest' : 'chest')
        .build()
    }),

  buildFurnace: (id: string, variant?: 'furnace' | 'blast_furnace' | 'smoker') =>
    Effect.gen(function* () {
      const builderFactory = yield* ContainerBuilderFactory
      const builder = builderFactory.create()
      return yield* builder
        .withId(id)
        .withType(variant || 'furnace')
        .build()
    }),

  buildPositioned: (id: string, type: ContainerType, x: number, y: number, z: number) =>
    Effect.gen(function* () {
      const builderFactory = yield* ContainerBuilderFactory
      const builder = builderFactory.create()
      return yield* builder.withId(id).withType(type).withPosition(x, y, z).build()
    }),

  buildOwned: (id: string, type: ContainerType, owner: string, isPrivate = false) =>
    Effect.gen(function* () {
      const builderFactory = yield* ContainerBuilderFactory
      const builder = builderFactory.create()
      let configuredBuilder = builder.withId(id).withType(type).withOwner(owner)

      if (isPrivate) {
        configuredBuilder = configuredBuilder.withPermissions({ restrictedToOwner: true })
      }

      return yield* configuredBuilder.build()
    }),
} as const
