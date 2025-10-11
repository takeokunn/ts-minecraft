/**
 * @fileoverview Container集約ファクトリ - タイプ別コンテナの安全な生成
 * DDD原則に基づく複雑なコンテナ設定の隠蔽
 */

import { Context, DateTime, Effect, Layer, Schema } from 'effect'
import { nanoid } from 'nanoid'
import type { PlayerId } from '../../types'
import type {
  ContainerAccessLevel,
  ContainerAggregate,
  ContainerConfiguration,
  ContainerDomainEvent,
  ContainerId,
  ContainerPermission,
  ContainerSlot,
  ContainerSlotIndex,
  ContainerType,
  WorldPosition,
} from './types'
import { CONTAINER_CONSTANTS, CONTAINER_SLOT_CONFIGURATIONS, ContainerAggregateSchema, ContainerError } from './types'

// ===== Factory Interface =====

export interface ContainerFactory {
  /**
   * 新しいContainer集約を生成
   */
  readonly create: (
    type: ContainerType,
    ownerId: PlayerId,
    position: WorldPosition,
    options?: ContainerCreateOptions
  ) => Effect.Effect<ContainerAggregate, ContainerError>

  /**
   * 既存データからContainer集約を復元
   */
  readonly restore: (data: unknown) => Effect.Effect<ContainerAggregate, ContainerError>

  /**
   * Container集約のビルダーを作成
   */
  readonly builder: () => ContainerBuilder

  /**
   * タイプ別のデフォルト設定を取得
   */
  readonly getDefaultConfiguration: (type: ContainerType) => ContainerConfiguration
}

export const ContainerFactory = Context.GenericTag<ContainerFactory>(
  '@minecraft/domain/inventory/aggregate/ContainerFactory'
)

// ===== Builder Options =====

export interface ContainerCreateOptions {
  readonly id?: ContainerId
  readonly accessLevel?: ContainerAccessLevel
  readonly configuration?: Partial<ContainerConfiguration>
  readonly permissions?: ReadonlyArray<ContainerPermission>
  readonly customSlots?: ReadonlyArray<{ index: ContainerSlotIndex; slot: ContainerSlot }>
}

// ===== Builder Pattern Implementation =====

export interface ContainerBuilder {
  /**
   * コンテナタイプを設定
   */
  readonly setType: (type: ContainerType) => ContainerBuilder

  /**
   * オーナーIDを設定
   */
  readonly setOwnerId: (ownerId: PlayerId) => ContainerBuilder

  /**
   * 位置を設定
   */
  readonly setPosition: (position: WorldPosition) => ContainerBuilder

  /**
   * カスタムIDを設定（テスト用）
   */
  readonly setId: (id: ContainerId) => ContainerBuilder

  /**
   * アクセスレベルを設定
   */
  readonly setAccessLevel: (level: ContainerAccessLevel) => ContainerBuilder

  /**
   * 設定を追加
   */
  readonly setConfiguration: (config: ContainerConfiguration) => ContainerBuilder

  /**
   * スロットを設定
   */
  readonly setSlot: (index: ContainerSlotIndex, slot: ContainerSlot) => ContainerBuilder

  /**
   * 許可を追加
   */
  readonly addPermission: (permission: ContainerPermission) => ContainerBuilder

  /**
   * バージョンを設定
   */
  readonly setVersion: (version: number) => ContainerBuilder

  /**
   * 集約をビルド
   */
  readonly build: () => Effect.Effect<ContainerAggregate, ContainerError>
}

// ===== Builder Implementation =====

class ContainerBuilderImpl implements ContainerBuilder {
  private id: ContainerId | null = null
  private type: ContainerType | null = null
  private ownerId: PlayerId | null = null
  private position: WorldPosition | null = null
  private accessLevel: ContainerAccessLevel = 'private'
  private configuration: ContainerConfiguration | null = null
  private slots: Array<ContainerSlot> = []
  private permissions: Array<ContainerPermission> = []
  private version: number = CONTAINER_CONSTANTS.DEFAULT_VERSION
  private createdAt: string | null = null
  private lastModified: string | null = null

  setType(type: ContainerType): ContainerBuilder {
    this.type = type
    // タイプに基づいてデフォルト設定を適用
    this.configuration = this.getDefaultConfigurationForType(type)
    this.slots = Array(this.configuration.maxSlots).fill(null)
    return this
  }

  setOwnerId(ownerId: PlayerId): ContainerBuilder {
    this.ownerId = ownerId
    return this
  }

  setPosition(position: WorldPosition): ContainerBuilder {
    this.position = position
    return this
  }

  setId(id: ContainerId): ContainerBuilder {
    this.id = id
    return this
  }

  setAccessLevel(level: ContainerAccessLevel): ContainerBuilder {
    this.accessLevel = level
    return this
  }

  setConfiguration(config: ContainerConfiguration): ContainerBuilder {
    this.configuration = config
    // スロット数の調整
    this.slots = Array(config.maxSlots).fill(null)
    return this
  }

  setSlot(index: ContainerSlotIndex, slot: ContainerSlot): ContainerBuilder {
    if (this.configuration && index < this.configuration.maxSlots) {
      this.slots[index] = slot
    }
    return this
  }

  addPermission(permission: ContainerPermission): ContainerBuilder {
    this.permissions.push(permission)
    return this
  }

  setVersion(version: number): ContainerBuilder {
    this.version = version
    return this
  }

  build(): Effect.Effect<ContainerAggregate, ContainerError> {
    return Effect.gen(
      function* () {
        // 必須フィールドの検証
        if (!this.type) {
          yield* Effect.fail(
            new ContainerError({
              reason: 'INVALID_CONFIGURATION',
              message: 'コンテナタイプが設定されていません',
            })
          )
        }

        if (!this.ownerId) {
          yield* Effect.fail(
            new ContainerError({
              reason: 'INVALID_CONFIGURATION',
              message: 'オーナーIDが設定されていません',
            })
          )
        }

        if (!this.position) {
          yield* Effect.fail(
            new ContainerError({
              reason: 'INVALID_CONFIGURATION',
              message: '位置が設定されていません',
            })
          )
        }

        if (!this.configuration) {
          yield* Effect.fail(
            new ContainerError({
              reason: 'INVALID_CONFIGURATION',
              message: '設定が初期化されていません',
            })
          )
        }

        // IDの生成または検証
        const id = this.id ?? makeUnsafeContainerId(`container_${nanoid()}`)

        // タイムスタンプの生成（未設定の場合）
        const now = yield* DateTime.now
        const timestamp = DateTime.formatIso(now)
        const createdAt = this.createdAt ?? timestamp
        const lastModified = this.lastModified ?? timestamp

        // 集約データの構築
        const aggregateData = {
          id,
          type: this.type,
          ownerId: this.ownerId,
          position: this.position,
          configuration: this.configuration,
          accessLevel: this.accessLevel,
          slots: this.slots,
          permissions: this.permissions,
          isOpen: false,
          currentViewers: [],
          version: this.version,
          createdAt,
          lastModified,
          uncommittedEvents: [],
        }

        // スキーマ検証
        const aggregate = yield* Schema.decodeUnknown(ContainerAggregateSchema)(aggregateData).pipe(
          Effect.mapError(
            (error) =>
              new ContainerError({
                reason: 'INVALID_CONFIGURATION',
                message: `Container集約の検証に失敗: ${String(error)}`,
              })
          )
        )

        return aggregate
      }.bind(this)
    )
  }

  private getDefaultConfigurationForType(type: ContainerType): ContainerConfiguration {
    const slotConfig = CONTAINER_SLOT_CONFIGURATIONS[type]

    return {
      maxSlots: slotConfig.maxSlots,
      autoSort: false,
      hopperInteraction: ['chest', 'hopper', 'furnace', 'blast_furnace', 'smoker'].includes(type),
      redstoneControlled: ['dispenser', 'dropper', 'hopper'].includes(type),
    }
  }
}

// ===== Factory Implementation =====

export const ContainerFactoryLive = ContainerFactory.of({
  create: (type: ContainerType, ownerId: PlayerId, position: WorldPosition, options?: ContainerCreateOptions) =>
    Effect.gen(function* () {
      const builder = new ContainerBuilderImpl()

      let builderWithDefaults = builder.setType(type).setOwnerId(ownerId).setPosition(position)

      if (options?.id) {
        builderWithDefaults = builderWithDefaults.setId(options.id)
      }

      if (options?.accessLevel) {
        builderWithDefaults = builderWithDefaults.setAccessLevel(options.accessLevel)
      }

      if (options?.configuration) {
        const defaultConfig = builderWithDefaults.getDefaultConfigurationForType(type)
        const mergedConfig = { ...defaultConfig, ...options.configuration }
        builderWithDefaults = builderWithDefaults.setConfiguration(mergedConfig)
      }

      if (options?.permissions) {
        builderWithDefaults = pipe(
          options.permissions,
          ReadonlyArray.reduce(builderWithDefaults, (acc, permission) => acc.addPermission(permission))
        )
      }

      if (options?.customSlots) {
        builderWithDefaults = pipe(
          options.customSlots,
          ReadonlyArray.reduce(builderWithDefaults, (acc, { index, slot }) => acc.setSlot(index, slot))
        )
      }

      return yield* builderWithDefaults.build()
    }),

  restore: (data: unknown) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      return yield* Schema.decodeUnknown(ContainerAggregateSchema)(data).pipe(
        Effect.mapError(
          (error) =>
            new ContainerError({
              reason: 'INVALID_CONFIGURATION',
              message: `データからの復元に失敗: ${String(error)}`,
            })
        )
      )
    }),

  builder: () => new ContainerBuilderImpl(),

  getDefaultConfiguration: (type: ContainerType) => {
    const slotConfig = CONTAINER_SLOT_CONFIGURATIONS[type]

    return {
      maxSlots: slotConfig.maxSlots,
      autoSort: false,
      hopperInteraction: ['chest', 'hopper', 'furnace', 'blast_furnace', 'smoker'].includes(type),
      redstoneControlled: ['dispenser', 'dropper', 'hopper'].includes(type),
    }
  },
})

/**
 * ContainerFactory Layer
 */
export const ContainerFactoryLayer = Layer.succeed(ContainerFactory, ContainerFactoryLive)

// ===== Preset Factory Functions =====

/**
 * チェストを作成
 */
export const createChest = (
  ownerId: PlayerId,
  position: WorldPosition,
  accessLevel: ContainerAccessLevel = 'private'
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    const factory = yield* ContainerFactory
    return yield* factory.create('chest', ownerId, position, { accessLevel })
  })

/**
 * ダブルチェストを作成
 */
export const createDoubleChest = (
  ownerId: PlayerId,
  position: WorldPosition,
  accessLevel: ContainerAccessLevel = 'private'
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    const factory = yield* ContainerFactory
    return yield* factory.create('double_chest', ownerId, position, { accessLevel })
  })

/**
 * かまどを作成
 */
export const createFurnace = (
  ownerId: PlayerId,
  position: WorldPosition
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    const factory = yield* ContainerFactory
    return yield* factory.create('furnace', ownerId, position, {
      configuration: {
        slotFilters: {
          1: ['minecraft:coal', 'minecraft:charcoal', 'minecraft:wood'] as ReadonlyArray<string>, // 燃料スロット
        },
      },
    })
  })

/**
 * ホッパーを作成
 */
export const createHopper = (
  ownerId: PlayerId,
  position: WorldPosition
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    const factory = yield* ContainerFactory
    return yield* factory.create('hopper', ownerId, position, {
      configuration: {
        hopperInteraction: true,
        redstoneControlled: true,
        autoSort: false,
      },
    })
  })

/**
 * シュルカーボックスを作成
 */
export const createShulkerBox = (
  ownerId: PlayerId,
  position: WorldPosition,
  accessLevel: ContainerAccessLevel = 'private'
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    const factory = yield* ContainerFactory
    return yield* factory.create('shulker_box', ownerId, position, { accessLevel })
  })

// ===== Utility Functions =====

/**
 * 空のコンテナスロットを作成
 */
export const createEmptyContainerSlot = (): ContainerSlot => null

/**
 * 集約のバージョンを増加
 */
export const incrementContainerVersion = (aggregate: ContainerAggregate): Effect.Effect<ContainerAggregate> =>
  Effect.gen(function* () {
    const nowDateTime = yield* DateTime.now
    const lastModified = DateTime.formatIso(nowDateTime)
    return {
      ...aggregate,
      version: aggregate.version + 1,
      lastModified,
    }
  })

/**
 * 未コミットイベントを追加
 */
export const addContainerUncommittedEvent = (
  aggregate: ContainerAggregate,
  event: ContainerDomainEvent
): ContainerAggregate => ({
  ...aggregate,
  uncommittedEvents: [...aggregate.uncommittedEvents, event],
})

/**
 * 未コミットイベントをクリア
 */
export const clearContainerUncommittedEvents = (aggregate: ContainerAggregate): ContainerAggregate => ({
  ...aggregate,
  uncommittedEvents: [],
})

/**
 * コンテナタイプから最大スロット数を取得
 */
export const getMaxSlotsForType = (type: ContainerType): number => {
  return CONTAINER_SLOT_CONFIGURATIONS[type]?.maxSlots ?? 0
}

/**
 * 特殊スロットの設定を取得
 */
export const getSpecialSlotsForType = (type: ContainerType) => {
  return CONTAINER_SLOT_CONFIGURATIONS[type]?.specialSlots ?? []
}
