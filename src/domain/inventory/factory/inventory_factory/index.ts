/**
 * InventoryFactory - Unified Export Module
 *
 * DDD Factory Patternによる統一されたInventory生成システム
 * Effect-TSの関数型パターンによる純粋関数ファクトリー
 */

// ===== Interface Exports =====
export type {
  InventoryBuilder,
  InventoryBuilderConfig,
  InventoryBuilderFactory,
  InventoryConfig,
  InventoryFactory,
  InventoryPermissions,
  InventoryType,
} from './interface'

export {
  defaultPermissions,
  InventoryBuilderFactory as InventoryBuilderFactoryTag,
  InventoryCreationError,
  InventoryFactory as InventoryFactoryTag,
  InventoryMergeError,
  InventoryValidationError,
} from './interface'

// ===== Factory Implementation Exports =====
export { InventoryFactoryLayer, InventoryFactoryLive } from './factory'

// ===== Builder Implementation Exports =====
export {
  createInventoryBuilder,
  creativeInventoryBuilder,
  customInventoryBuilder,
  InventoryBuilderFactoryLayer,
  InventoryBuilderFactoryLive,
  playerInventoryBuilder,
  survivalInventoryBuilder,
} from './builders'

// ===== Preset Implementation Exports =====
export {
  adventureInventory,
  // プリセット情報
  availablePresets,
  buildingInventory,
  createPresetInventory,
  creativeInventory,
  customSlotInventory,
  getPresetByType,
  // 特殊用途プリセット
  newPlayerInventory,
  presetInfo,
  pvpArenaInventory,
  redstoneInventory,

  // ヘルパー関数
  restrictedInventory,
  spectatorInventory,
  // 基本ゲームモードプリセット
  standardPlayerInventory,
  survivalInventory,
  type InventoryPresetName,
} from './presets'

// ===== 統一Layer Export（全ファクトリーの組み合わせ） =====
import { Effect, Layer } from 'effect'
import { InventoryBuilderFactoryLayer } from './builders'
import { InventoryFactoryLayer } from './factory'
import { InventoryBuilderFactory, InventoryFactory } from './interface'

/**
 * 全InventoryFactoryサービスを統合したLayer
 * アプリケーション層で一度に全てのファクトリーを利用可能にする
 */
export const InventoryFactoryAllLayer = Layer.mergeAll(
  Layer.effect(InventoryFactory, InventoryFactoryLayer),
  Layer.effect(InventoryBuilderFactory, InventoryBuilderFactoryLayer)
)

// ===== 便利なヘルパー関数（Function.flowパターン） =====

/**
 * 関数型ファクトリーのワンライナー生成
 */
export const InventoryFactoryHelpers = {
  // 最も一般的なユースケース
  createPlayer: (playerId: string) =>
    Effect.gen(function* () {
      const factory = yield* InventoryFactory
      return yield* factory.createPlayerInventory(playerId as any) // Brand typeへの変換
    }),

  createCreative: (playerId: string) =>
    Effect.gen(function* () {
      const factory = yield* InventoryFactory
      return yield* factory.createCreativeInventory(playerId as any)
    }),

  createSurvival: (playerId: string) =>
    Effect.gen(function* () {
      const factory = yield* InventoryFactory
      return yield* factory.createSurvivalInventory(playerId as any)
    }),

  // Builder Pattern ワンライナー
  buildPlayer: (playerId: string) =>
    Effect.gen(function* () {
      const builderFactory = yield* InventoryBuilderFactory
      const builder = builderFactory.create()
      return yield* builder
        .withPlayerId(playerId as any)
        .withType('player')
        .build()
    }),

  buildCustom: (playerId: string, type: InventoryType, slotCount?: number) =>
    Effect.gen(function* () {
      const builderFactory = yield* InventoryBuilderFactory
      const builder = builderFactory.create()
      let configuredBuilder = builder.withPlayerId(playerId as any).withType(type)

      if (slotCount) {
        configuredBuilder = configuredBuilder.withSlotCount(slotCount)
      }

      return yield* configuredBuilder.build()
    }),
} as const
