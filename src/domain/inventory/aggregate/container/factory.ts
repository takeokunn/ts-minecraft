/**
 * @fileoverview Container集約ファクトリ - タイプ別コンテナの安全な生成
 * DDD原則に基づく複雑なコンテナ設定の隠蔽
 */

import { Context, DateTime, Effect, Layer, ReadonlyArray, Schema, pipe } from 'effect'
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
import {
  CONTAINER_CONSTANTS,
  CONTAINER_SLOT_CONFIGURATIONS,
  ContainerAggregateSchema,
  ContainerError,
  makeUnsafeContainerId,
} from './types'

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

// ===== Builder State Schema =====

/**
 * Builderの内部状態を表すSchema
 */
export const ContainerBuilderStateSchema = Schema.Struct({
  id: Schema.NullOr(Schema.Unknown), // ContainerId
  type: Schema.NullOr(Schema.Unknown), // ContainerType
  ownerId: Schema.NullOr(Schema.Unknown), // PlayerId
  position: Schema.NullOr(Schema.Unknown), // WorldPosition
  accessLevel: Schema.Unknown, // ContainerAccessLevel
  configuration: Schema.NullOr(Schema.Unknown), // ContainerConfiguration
  slots: Schema.Array(Schema.Unknown), // Array<ContainerSlot>
  permissions: Schema.Array(Schema.Unknown), // Array<ContainerPermission>
  version: Schema.Number,
  createdAt: Schema.NullOr(Schema.String),
  lastModified: Schema.NullOr(Schema.String),
})

export type ContainerBuilderState = Schema.Schema.Type<typeof ContainerBuilderStateSchema>

// ===== Builder Pure Functions =====

/**
 * 初期Builder状態を作成
 */
export const createContainerBuilderState = (): ContainerBuilderState => ({
  id: null,
  type: null,
  ownerId: null,
  position: null,
  accessLevel: 'private' as ContainerAccessLevel,
  configuration: null,
  slots: [],
  permissions: [],
  version: CONTAINER_CONSTANTS.DEFAULT_VERSION,
  createdAt: null,
  lastModified: null,
})

/**
 * タイプに基づくデフォルト設定を取得
 */
const getDefaultConfigurationForType = (type: ContainerType): ContainerConfiguration => {
  const slotConfig = CONTAINER_SLOT_CONFIGURATIONS[type]

  return {
    maxSlots: slotConfig.maxSlots,
    autoSort: false,
    hopperInteraction: ['chest', 'hopper', 'furnace', 'blast_furnace', 'smoker'].includes(type),
    redstoneControlled: ['dispenser', 'dropper', 'hopper'].includes(type),
  }
}

/**
 * コンテナタイプを設定
 */
export const withContainerType =
  (type: ContainerType) =>
  (state: ContainerBuilderState): ContainerBuilderState => {
    const configuration = getDefaultConfigurationForType(type)
    return {
      ...state,
      type,
      configuration,
      slots: Array(configuration.maxSlots).fill(null),
    }
  }

/**
 * オーナーIDを設定
 */
export const withOwnerId =
  (ownerId: PlayerId) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    ownerId,
  })

/**
 * 位置を設定
 */
export const withPosition =
  (position: WorldPosition) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    position,
  })

/**
 * カスタムIDを設定
 */
export const withContainerId =
  (id: ContainerId) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    id,
  })

/**
 * アクセスレベルを設定
 */
export const withAccessLevel =
  (accessLevel: ContainerAccessLevel) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    accessLevel,
  })

/**
 * 設定を追加
 */
export const withConfiguration =
  (configuration: ContainerConfiguration) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    configuration,
    slots: Array(configuration.maxSlots).fill(null),
  })

/**
 * スロットを設定
 */
export const withSlot =
  (index: ContainerSlotIndex, slot: ContainerSlot) =>
  (state: ContainerBuilderState): ContainerBuilderState => {
    if (state.configuration && index < state.configuration.maxSlots) {
      const newSlots = [...state.slots]
      newSlots[index] = slot
      return {
        ...state,
        slots: newSlots,
      }
    }
    return state
  }

/**
 * 許可を追加
 */
export const withPermission =
  (permission: ContainerPermission) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    permissions: [...state.permissions, permission],
  })

/**
 * バージョンを設定
 */
export const withVersion =
  (version: number) =>
  (state: ContainerBuilderState): ContainerBuilderState => ({
    ...state,
    version,
  })

/**
 * Builder状態からContainer集約を構築
 */
export const buildContainerFromState = (
  state: ContainerBuilderState
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    // 必須フィールドの検証
    if (!state.type) {
      yield* Effect.fail(
        ContainerError.make({
          reason: 'INVALID_CONFIGURATION',
          message: 'コンテナタイプが設定されていません',
        })
      )
    }

    if (!state.ownerId) {
      yield* Effect.fail(
        ContainerError.make({
          reason: 'INVALID_CONFIGURATION',
          message: 'オーナーIDが設定されていません',
        })
      )
    }

    if (!state.position) {
      yield* Effect.fail(
        ContainerError.make({
          reason: 'INVALID_CONFIGURATION',
          message: '位置が設定されていません',
        })
      )
    }

    if (!state.configuration) {
      yield* Effect.fail(
        ContainerError.make({
          reason: 'INVALID_CONFIGURATION',
          message: '設定が初期化されていません',
        })
      )
    }

    // IDの生成または検証
    const id = state.id ?? makeUnsafeContainerId(`container_${nanoid()}`)

    // タイムスタンプの生成（未設定の場合）
    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const createdAt = state.createdAt ?? timestamp
    const lastModified = state.lastModified ?? timestamp

    // 集約データの構築
    const aggregateData = {
      id,
      type: state.type,
      ownerId: state.ownerId,
      position: state.position,
      configuration: state.configuration,
      accessLevel: state.accessLevel,
      slots: state.slots,
      permissions: state.permissions,
      isOpen: false,
      currentViewers: [],
      version: state.version,
      createdAt,
      lastModified,
      uncommittedEvents: [] as Array<ContainerDomainEvent>,
    }

    // スキーマ検証
    const aggregate = yield* Schema.decodeUnknown(ContainerAggregateSchema)(aggregateData).pipe(
      Effect.mapError((error) =>
        ContainerError.make({
          reason: 'INVALID_CONFIGURATION',
          message: `Container集約の検証に失敗: ${String(error)}`,
        })
      )
    )

    return aggregate
  })

// ===== Factory Implementation =====

export const ContainerFactoryLive = ContainerFactory.of({
  create: (type: ContainerType, ownerId: PlayerId, position: WorldPosition, options?: ContainerCreateOptions) =>
    Effect.gen(function* () {
      // pure functionパターンでBuilder状態を構築
      let state = pipe(
        createContainerBuilderState(),
        withContainerType(type),
        withOwnerId(ownerId),
        withPosition(position)
      )

      if (options?.id) {
        state = withContainerId(options.id)(state)
      }

      if (options?.accessLevel) {
        state = withAccessLevel(options.accessLevel)(state)
      }

      if (options?.configuration) {
        const defaultConfig = getDefaultConfigurationForType(type)
        const mergedConfig = { ...defaultConfig, ...options.configuration }
        state = withConfiguration(mergedConfig)(state)
      }

      if (options?.permissions) {
        state = pipe(
          options.permissions,
          ReadonlyArray.reduce(state, (acc, permission) => withPermission(permission)(acc))
        )
      }

      if (options?.customSlots) {
        state = pipe(
          options.customSlots,
          ReadonlyArray.reduce(state, (acc, { index, slot }) => withSlot(index, slot)(acc))
        )
      }

      return yield* buildContainerFromState(state)
    }),

  restore: (data: unknown) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      return yield* Schema.decodeUnknown(ContainerAggregateSchema)(data).pipe(
        Effect.mapError((error) =>
          ContainerError.make({
            reason: 'INVALID_CONFIGURATION',
            message: `データからの復元に失敗: ${String(error)}`,
          })
        )
      )
    }),

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
