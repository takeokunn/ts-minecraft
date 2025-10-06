/**
 * ContainerBuilder - Function.flow Builder Pattern Implementation for Containers
 *
 * Effect-TSの関数型BuilderパターンによるContainer構築システム
 * class構文を使用せず、純粋関数とFunction.flowチェーンで実装
 */

import { Effect, Array as EffectArray, Function, Match, pipe } from 'effect'
import type { ItemStack } from '../../types'
import { ContainerFactoryLive } from './factory'
import type {
  ContainerBuilder,
  ContainerBuilderConfig,
  ContainerBuilderFactory,
  ContainerType,
  containerTypeSpecs,
  ContainerValidationError,
  defaultContainerPermissions,
} from './interface'
import { ContainerCreationError as CreationError, ContainerValidationError as ValidationError } from './interface'

// ===== Builder Configuration Helpers（Pure Functions） =====

// コンテナタイプ別デフォルト設定取得（Match.valueパターン）
const getTypeDefaultConfig = (type: ContainerType): ContainerBuilderConfig => {
  const spec = containerTypeSpecs[type]

  return pipe(
    type,
    Match.value,
    Match.when('chest', () => ({
      type: 'chest' as ContainerType,
      totalSlots: 27,
      permissions: defaultContainerPermissions,
    })),
    Match.when('large_chest', () => ({
      type: 'large_chest' as ContainerType,
      totalSlots: 54,
      permissions: defaultContainerPermissions,
    })),
    Match.when('ender_chest', () => ({
      type: 'ender_chest' as ContainerType,
      totalSlots: 27,
      permissions: {
        ...defaultContainerPermissions,
        restrictedToOwner: true,
      },
    })),
    Match.when('shulker_box', () => ({
      type: 'shulker_box' as ContainerType,
      totalSlots: 27,
      permissions: defaultContainerPermissions,
    })),
    Match.when('furnace', () => ({
      type: 'furnace' as ContainerType,
      totalSlots: 3,
      permissions: defaultContainerPermissions,
    })),
    Match.when('blast_furnace', () => ({
      type: 'blast_furnace' as ContainerType,
      totalSlots: 3,
      permissions: defaultContainerPermissions,
    })),
    Match.when('smoker', () => ({
      type: 'smoker' as ContainerType,
      totalSlots: 3,
      permissions: defaultContainerPermissions,
    })),
    Match.when('brewing_stand', () => ({
      type: 'brewing_stand' as ContainerType,
      totalSlots: 4,
      permissions: defaultContainerPermissions,
    })),
    Match.when('hopper', () => ({
      type: 'hopper' as ContainerType,
      totalSlots: 5,
      permissions: defaultContainerPermissions,
    })),
    Match.when('crafting_table', () => ({
      type: 'crafting_table' as ContainerType,
      totalSlots: 10,
      permissions: {
        ...defaultContainerPermissions,
        canExtract: false, // クラフト結果のみ抽出可能
      },
    })),
    Match.orElse(() => ({
      type,
      totalSlots: spec.defaultSlotCount,
      permissions: defaultContainerPermissions,
    }))
  )
}

// Builder設定の検証（Pure Function with Effect）
const validateBuilderConfig = (config: ContainerBuilderConfig): Effect.Effect<void, ContainerValidationError> =>
  Effect.gen(function* () {
    // id必須チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => !c.id,
        () =>
          Effect.fail(
            new ValidationError({
              reason: 'id is required',
              missingFields: ['id'],
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
            new ValidationError({
              reason: 'type is required',
              missingFields: ['type'],
              context: { config },
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )

    // totalSlots整合性チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => c.totalSlots !== undefined && c.type !== undefined,
        (c) => {
          const spec = containerTypeSpecs[c.type!]
          return Match.value(c.totalSlots === spec.defaultSlotCount).pipe(
            Match.when(false, () =>
              Effect.fail(
                new ValidationError({
                  reason: `totalSlots for ${c.type} should be ${spec.defaultSlotCount}`,
                  missingFields: ['totalSlots'],
                  context: { config },
                })
              )
            ),
            Match.orElse(() => Effect.void)
          )
        }
      ),
      Match.orElse(() => Effect.void)
    )

    // position座標チェック
    yield* Match.value(config).pipe(
      Match.when(
        (c) => c.position !== undefined,
        (c) => {
          const { x, y, z } = c.position!
          return Match.value(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).pipe(
            Match.when(false, () =>
              Effect.fail(
                new ValidationError({
                  reason: 'position coordinates must be finite numbers',
                  missingFields: ['position'],
                  context: { config },
                })
              )
            ),
            Match.orElse(() => Effect.void)
          )
        }
      ),
      Match.orElse(() => Effect.void)
    )
  })

// ===== Function.flow Builder Implementation =====

// Builder関数型実装（Immutable State Pattern）
export const createContainerBuilder = (initialConfig: ContainerBuilderConfig = {}): ContainerBuilder => {
  let config: ContainerBuilderConfig = { ...initialConfig }

  const builder: ContainerBuilder = {
    // ID設定（Function.flow チェーン対応）
    withId: (id) => {
      config = { ...config, id }
      return createContainerBuilder(config)
    },

    // タイプ設定（Match.valueによるデフォルト適用）
    withType: (type) => {
      const defaults = getTypeDefaultConfig(type)
      config = { ...defaults, ...config, type }
      return createContainerBuilder(config)
    },

    // 名前設定
    withName: (name) => {
      config = { ...config, name }
      return createContainerBuilder(config)
    },

    // スロット数設定
    withSlotCount: (count) => {
      config = { ...config, totalSlots: count }
      return createContainerBuilder(config)
    },

    // 権限設定（Partial merge）
    withPermissions: (permissions) => {
      const mergedPermissions = {
        ...config.permissions,
        ...permissions,
      }
      config = { ...config, permissions: mergedPermissions }
      return createContainerBuilder(config)
    },

    // 位置設定
    withPosition: (x, y, z) => {
      config = { ...config, position: { x, y, z } }
      return createContainerBuilder(config)
    },

    // オーナー設定
    withOwner: (owner) => {
      config = { ...config, owner }
      return createContainerBuilder(config)
    },

    // ロック設定
    withLock: (isLocked, lockKey) => {
      config = { ...config, isLocked, lockKey }
      return createContainerBuilder(config)
    },

    // メタデータ設定
    withMetadata: (metadata) => {
      config = { ...config, metadata }
      return createContainerBuilder(config)
    },

    // 単一アイテム追加
    addItem: (slotIndex, item) => {
      const currentItems = config.initialItems || []
      config = {
        ...config,
        initialItems: [...currentItems, { slotIndex, item }],
      }
      return createContainerBuilder(config)
    },

    // 複数アイテム追加
    addItems: (items) => {
      const currentItems = config.initialItems || []
      config = {
        ...config,
        initialItems: [...currentItems, ...items],
      }
      return createContainerBuilder(config)
    },

    // 最終ビルド実行（Effect.gen with Match.whenバリデーション）
    build: () =>
      Effect.gen(function* () {
        yield* validateBuilderConfig(config)

        // Match.whenによる必須フィールド検証
        const missingFields: string[] = []
        if (!config.id) missingFields.push('id')
        if (!config.type) missingFields.push('type')

        return yield* pipe(
          Match.value(missingFields),
          Match.when(EffectArray.isEmptyReadonlyArray, () =>
            Effect.gen(function* () {
              const containerConfig = {
                id: config.id!,
                type: config.type!,
                name: config.name,
                totalSlots: config.totalSlots,
                permissions: config.permissions,
                initialItems: config.initialItems,
                metadata: config.metadata,
                position: config.position,
                owner: config.owner,
                isLocked: config.isLocked,
                lockKey: config.lockKey,
              }
              return yield* ContainerFactoryLive.createWithConfig(containerConfig)
            })
          ),
          Match.orElse((fields) =>
            Effect.fail(
              new CreationError({
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
    reset: () => createContainerBuilder(),
  }

  return builder
}

// ===== Function.flow チェーン用ヘルパー関数 =====

// チェストビルダー（Function.flowチェーン）
export const chestContainerBuilder = (id: string, size: 'small' | 'large' = 'small') =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(size === 'large' ? 'large_chest' : 'chest')
  )

// 溶鉱炉ビルダー（Function.flowチェーン）
export const furnaceContainerBuilder = (id: string, variant: 'furnace' | 'blast_furnace' | 'smoker' = 'furnace') =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(variant)
  )

// ホッパービルダー（Function.flowチェーン）
export const hopperContainerBuilder = (id: string) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('hopper')
  )

// 醸造台ビルダー（Function.flowチェーン）
export const brewingStandContainerBuilder = (id: string) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('brewing_stand')
  )

// 作業台ビルダー（Function.flowチェーン）
export const craftingTableContainerBuilder = (id: string) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('crafting_table')
  )

// シュルカーボックスビルダー（Function.flowチェーン）
export const shulkerBoxContainerBuilder = (id: string, color?: string) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('shulker_box'),
    (builder) => (color ? builder.withMetadata({ color }) : builder)
  )

// 位置付きコンテナビルダー（Function.flowチェーン）
export const positionedContainerBuilder = (id: string, type: ContainerType, x: number, y: number, z: number) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(type),
    (builder) => builder.withPosition(x, y, z)
  )

// オーナー付きコンテナビルダー（Function.flowチェーン）
export const ownedContainerBuilder = (id: string, type: ContainerType, owner: string, isPrivate = false) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(type),
    (builder) => builder.withOwner(owner),
    (builder) => (isPrivate ? builder.withPermissions({ restrictedToOwner: true }) : builder)
  )

// アイテム付きコンテナビルダー（Function.flowチェーン）
export const preloadedContainerBuilder = (
  id: string,
  type: ContainerType,
  items: ReadonlyArray<{ slotIndex: number; item: ItemStack }>
) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(type),
    (builder) => builder.addItems(items)
  )

// カスタムコンテナビルダー（設定ベース）
export const customContainerBuilder = (
  id: string,
  type: ContainerType,
  customizations: Partial<ContainerBuilderConfig> = {}
) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(type),
    Function.flow(
      // カスタマイゼーション適用
      (builder) => (customizations.name ? builder.withName(customizations.name) : builder),
      (builder) => (customizations.permissions ? builder.withPermissions(customizations.permissions) : builder),
      (builder) =>
        customizations.position
          ? builder.withPosition(customizations.position.x, customizations.position.y, customizations.position.z)
          : builder,
      (builder) => (customizations.owner ? builder.withOwner(customizations.owner) : builder),
      (builder) =>
        customizations.isLocked !== undefined
          ? builder.withLock(customizations.isLocked, customizations.lockKey)
          : builder,
      (builder) => (customizations.metadata ? builder.withMetadata(customizations.metadata) : builder),
      (builder) => (customizations.initialItems ? builder.addItems(customizations.initialItems) : builder)
    )
  )

// ===== Builder Factory Implementation =====

export const ContainerBuilderFactoryLive: ContainerBuilderFactory = {
  // 空のビルダー作成
  create: () => createContainerBuilder(),

  // 既存コンテナからビルダー作成
  fromContainer: (container) =>
    pipe(
      createContainerBuilder(),
      (builder) => builder.withId(container.id),
      (builder) => builder.withType(container.type),
      (builder) => (container.name ? builder.withName(container.name) : builder),
      (builder) => builder.withPermissions(container.permissions),
      (builder) =>
        container.position
          ? builder.withPosition(container.position.x, container.position.y, container.position.z)
          : builder,
      (builder) => (container.owner ? builder.withOwner(container.owner) : builder),
      (builder) => (container.isLocked ? builder.withLock(container.isLocked, container.lockKey) : builder),
      (builder) => (container.metadata ? builder.withMetadata(container.metadata) : builder),
      (builder) => {
        // 現在のアイテムを初期アイテムとして設定
        const items = container.slots
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) => slot.item !== null)
          .map(({ slot, index }) => ({ slotIndex: index, item: slot.item! }))

        return items.length > 0 ? builder.addItems(items) : builder
      }
    ),

  // 設定からビルダー作成
  fromConfig: (config) => createContainerBuilder(config),

  // デフォルト付きビルダー作成
  createWithDefaults: (type) =>
    Effect.gen(function* () {
      const defaults = getTypeDefaultConfig(type)
      return yield* Effect.succeed(createContainerBuilder(defaults))
    }),
}

// Layer.effect による依存性注入実装
export const ContainerBuilderFactoryLayer = Effect.succeed(ContainerBuilderFactoryLive)
