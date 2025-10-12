/**
 * InventoryBuilder - Function.flow Builder Pattern Implementation
 *
 * Effect-TSの関数型BuilderパターンによるInventory構築システム
 * class構文を使用せず、純粋関数とFunction.flowチェーンで実装
 */

import { Effect, Array as EffectArray, Function, Match, pipe } from 'effect'
import type { ItemStack, PlayerId } from '../../types'
import { InventoryFactoryLive } from './factory'
import type {
  defaultPermissions,
  InventoryBuilder,
  InventoryBuilderConfig,
  InventoryBuilderFactory,
  InventoryType,
  InventoryValidationError,
} from './interface'
import {
  asInventoryType,
  InventoryCreationError as CreationError,
  InventoryValidationError as ValidationError,
} from './interface'

// ===== Builder Configuration Helpers（Pure Functions） =====

// デフォルト設定取得（Match.valueパターン）
const getDefaultConfig = (type: InventoryType): InventoryBuilderConfig =>
  pipe(
    type,
    Match.value,
    Match.when('player', () => ({
      type: asInventoryType('player'),
      slotCount: 36,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      startingItems: [],
      permissions: defaultPermissions,
    })),
    Match.when('creative', () => ({
      type: asInventoryType('creative'),
      slotCount: 45,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      startingItems: [],
      permissions: {
        ...defaultPermissions,
        canAddItems: true,
        canRemoveItems: true,
      },
    })),
    Match.when('survival', () => ({
      type: asInventoryType('survival'),
      slotCount: 36,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      startingItems: [],
      permissions: defaultPermissions,
    })),
    Match.when('spectator', () => ({
      type: asInventoryType('spectator'),
      slotCount: 0,
      enableHotbar: false,
      enableArmor: false,
      enableOffhand: false,
      startingItems: [],
      permissions: {
        canAddItems: false,
        canRemoveItems: false,
        canModifyArmor: false,
        canUseHotbar: false,
        canUseOffhand: false,
      },
    })),
    Match.when('adventure', () => ({
      type: asInventoryType('adventure'),
      slotCount: 36,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      startingItems: [],
      permissions: {
        ...defaultPermissions,
        canModifyArmor: false,
      },
    })),
    Match.exhaustive
  )

// 設定の検証（Pure Function with Effect）
const validateBuilderConfig = (config: InventoryBuilderConfig): Effect.Effect<void, InventoryValidationError> =>
  Effect.gen(function* () {
    // playerId必須チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => !c.playerId,
        () =>
          Effect.fail(
            ValidationError.make({
              reason: 'playerId is required',
              missingFields: ['playerId'],
              context: { config },
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )

    // type必須チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => !c.type,
        () =>
          Effect.fail(
            ValidationError.make({
              reason: 'type is required',
              missingFields: ['type'],
              context: { config },
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )

    // slotCount範囲チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => c.slotCount !== undefined && (c.slotCount < 0 || c.slotCount > 54),
        () =>
          Effect.fail(
            ValidationError.make({
              reason: 'slotCount must be between 0 and 54',
              missingFields: ['slotCount'],
              context: { config },
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )

    // startingItems整合性チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => c.startingItems && c.slotCount !== undefined && c.startingItems.length > c.slotCount,
        () =>
          Effect.fail(
            ValidationError.make({
              reason: 'startingItems count exceeds slotCount',
              missingFields: ['startingItems'],
              context: { config },
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )
  })

// ===== Function.flow Builder Implementation =====

// Builder関数型実装（Immutable State Pattern）
export const createInventoryBuilder = (initialConfig: InventoryBuilderConfig = {}): InventoryBuilder => {
  let config: InventoryBuilderConfig = { ...initialConfig }

  const builder: InventoryBuilder = {
    // PlayerId設定（Function.flow チェーン対応）
    withPlayerId: (playerId) => {
      config = { ...config, playerId }
      return createInventoryBuilder(config)
    },

    // タイプ設定（Match.valueによるデフォルト適用）
    withType: (type) => {
      const defaults = getDefaultConfig(type)
      config = { ...defaults, ...config, type }
      return createInventoryBuilder(config)
    },

    // スロット数設定
    withSlotCount: (count) => {
      config = { ...config, slotCount: count }
      return createInventoryBuilder(config)
    },

    // ホットバー有効/無効設定
    withHotbar: (enabled) => {
      config = { ...config, enableHotbar: enabled }
      return createInventoryBuilder(config)
    },

    // 装備スロット有効/無効設定
    withArmor: (enabled) => {
      config = { ...config, enableArmor: enabled }
      return createInventoryBuilder(config)
    },

    // オフハンド有効/無効設定
    withOffhand: (enabled) => {
      config = { ...config, enableOffhand: enabled }
      return createInventoryBuilder(config)
    },

    // 初期アイテム設定（配列置換）
    withStartingItems: (items) => {
      config = { ...config, startingItems: items }
      return createInventoryBuilder(config)
    },

    // 権限設定（Partial merge）
    withPermissions: (permissions) => {
      const mergedPermissions = {
        ...config.permissions,
        ...permissions,
      }
      config = { ...config, permissions: mergedPermissions }
      return createInventoryBuilder(config)
    },

    // 初期アイテム追加（既存配列に追加）
    addStartingItem: (item) => {
      const currentItems = config.startingItems || []
      config = {
        ...config,
        startingItems: [...currentItems, item],
      }
      return createInventoryBuilder(config)
    },

    // 最終ビルド実行（Effect.gen with Match.whenバリデーション）
    build: () =>
      Effect.gen(function* () {
        yield* validateBuilderConfig(config)

        // Match.whenによる必須フィールド検証
        const missingFields = pipe(
          [
            Option.when(config.playerId === undefined, () => 'playerId'),
            Option.when(config.type === undefined, () => 'type'),
          ],
          ReadonlyArray.filterMap((field) => field)
        )

        return yield* pipe(
          Match.value(missingFields),
          Match.when(EffectArray.isEmptyReadonlyArray, () =>
            Effect.gen(function* () {
              const inventoryConfig = {
                playerId: config.playerId!,
                type: config.type!,
                slotCount: config.slotCount ?? 36,
                enableHotbar: config.enableHotbar ?? true,
                enableArmor: config.enableArmor ?? true,
                enableOffhand: config.enableOffhand ?? true,
                startingItems: config.startingItems,
                permissions: config.permissions ?? defaultPermissions,
              }
              return yield* InventoryFactoryLive.createWithConfig(inventoryConfig)
            })
          ),
          Match.orElse((fields) =>
            Effect.fail(
              CreationError.make({
                reason: 'Missing required fields for build',
                invalidFields: fields,
                context: { config },
              })
            )
          )
        )
      }),

    // 検証実行（ビルド前の事前検証）
    validate: () => validateBuilderConfig(config),

    // リセット（初期状態に戻す）
    reset: () => createInventoryBuilder(),
  }

  return builder
}

// ===== Function.flow チェーン用ヘルパー関数 =====

// プレイヤーインベントリービルダー（Function.flowチェーン）
export const playerInventoryBuilder = (playerId: PlayerId) =>
  pipe(
    createInventoryBuilder(),
    (builder) => builder.withPlayerId(playerId),
    (builder) => builder.withType('player')
  )

// クリエイティブインベントリービルダー（Function.flowチェーン）
export const creativeInventoryBuilder = (playerId: PlayerId) =>
  pipe(
    createInventoryBuilder(),
    (builder) => builder.withPlayerId(playerId),
    (builder) => builder.withType('creative')
  )

// サバイバルインベントリービルダー（Function.flowチェーン）
export const survivalInventoryBuilder = (playerId: PlayerId) =>
  pipe(
    createInventoryBuilder(),
    (builder) => builder.withPlayerId(playerId),
    (builder) => builder.withType('survival')
  )

// カスタムインベントリービルダー（設定ベース）
export const customInventoryBuilder = (
  playerId: PlayerId,
  type: InventoryType,
  customizations: Partial<InventoryBuilderConfig> = {}
) =>
  pipe(
    createInventoryBuilder(),
    (builder) => builder.withPlayerId(playerId),
    (builder) => builder.withType(type),
    Function.flow(
      // カスタマイゼーション適用
      (builder) => (customizations.slotCount ? builder.withSlotCount(customizations.slotCount) : builder),
      (builder) =>
        customizations.enableHotbar !== undefined ? builder.withHotbar(customizations.enableHotbar) : builder,
      (builder) => (customizations.enableArmor !== undefined ? builder.withArmor(customizations.enableArmor) : builder),
      (builder) =>
        customizations.enableOffhand !== undefined ? builder.withOffhand(customizations.enableOffhand) : builder,
      (builder) => (customizations.startingItems ? builder.withStartingItems(customizations.startingItems) : builder),
      (builder) => (customizations.permissions ? builder.withPermissions(customizations.permissions) : builder)
    )
  )

// ===== Builder Factory Implementation =====

export const InventoryBuilderFactoryLive: InventoryBuilderFactory = {
  // 空のビルダー作成
  create: () => createInventoryBuilder(),

  // 既存インベントリーからビルダー作成
  fromInventory: (inventory) =>
    pipe(
      createInventoryBuilder(),
      (builder) => builder.withPlayerId(inventory.playerId),
      (builder) => builder.withType('player'), // デフォルトタイプ
      (builder) => builder.withSlotCount(inventory.slots.length),
      (builder) => builder.withHotbar(inventory.hotbar.length > 0),
      (builder) =>
        builder.withArmor(
          inventory.armor.helmet !== null ||
            inventory.armor.chestplate !== null ||
            inventory.armor.leggings !== null ||
            inventory.armor.boots !== null
        ),
      (builder) => builder.withOffhand(inventory.offhand !== null),
      (builder) => {
        const nonNullItems = inventory.slots.filter((item): item is ItemStack => item !== null)
        return nonNullItems.length > 0 ? builder.withStartingItems(nonNullItems) : builder
      }
    ),

  // 設定からビルダー作成
  fromConfig: (config) => createInventoryBuilder(config),

  // デフォルト付きビルダー作成
  createWithDefaults: (type) =>
    Effect.gen(function* () {
      const defaults = getDefaultConfig(type)
      return yield* Effect.succeed(createInventoryBuilder(defaults))
    }),
}

// Layer.effect による依存性注入実装
export const InventoryBuilderFactoryLayer = Effect.succeed(InventoryBuilderFactoryLive)
