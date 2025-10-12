/**
 * @fileoverview Container集約ファクトリ - タイプ別コンテナの安全な生成
 * DDD原則に基づく複雑なコンテナ設定の隠蔽
 */

import { JsonValueSchema } from '@shared/schema/json'
import { formatParseIssues } from '@shared/schema/tagged_error_factory'
import { Brand, Context, DateTime, Effect, Layer, Match, Option, ReadonlyArray, Schema, pipe } from 'effect'
import { nanoid } from 'nanoid'
import type { PlayerId } from '../../types'
import { PlayerIdSchema } from '../../types/core'
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
  ContainerAccessLevelSchema,
  ContainerAggregateSchema,
  ContainerConfigurationSchema,
  ContainerDomainEventSchema,
  ContainerError,
  ContainerIdSchema,
  ContainerPermissionSchema,
  ContainerSlotSchema,
  ContainerTypeSchema,
  WorldPositionSchema,
  makeUnsafeContainerId,
} from './types'

// ===== Branded Types for Persistence =====

/**
 * 永続化されたContainerデータの型
 *
 * `unknown`を使用する理由:
 * - 外部ストレージ（IndexedDB/LocalStorage）から取得されたデータは実行時検証が必須
 * - Branded Typeにより、型安全な境界を明示的に定義
 * - restore関数内でSchema検証を通過して初めてContainerAggregateとして扱える
 */
export type PersistedContainer = Brand.Brand<unknown, 'PersistedContainer'>

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
   *
   * @param data - 永続化されたContainerデータ（実行時検証が必要）
   */
  readonly restore: (data: PersistedContainer) => Effect.Effect<ContainerAggregate, ContainerError>

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
  id: Schema.NullOr(ContainerIdSchema),
  type: Schema.NullOr(ContainerTypeSchema),
  ownerId: Schema.NullOr(PlayerIdSchema),
  position: Schema.NullOr(WorldPositionSchema),
  accessLevel: ContainerAccessLevelSchema,
  configuration: Schema.NullOr(ContainerConfigurationSchema),
  slots: Schema.Array(ContainerSlotSchema),
  permissions: Schema.Array(ContainerPermissionSchema),
  version: Schema.Number,
  createdAt: Schema.NullOr(Schema.String),
  lastModified: Schema.NullOr(Schema.String),
  metadata: Schema.optional(JsonValueSchema),
  uncommittedEvents: Schema.Array(ContainerDomainEventSchema),
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
  metadata: undefined,
  uncommittedEvents: [],
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
    return pipe(
      Match.value(state.configuration),
      Match.when(
        (config) => config !== undefined && index < config.maxSlots,
        () => {
          const newSlots = [...state.slots]
          newSlots[index] = slot
          return {
            ...state,
            slots: newSlots,
          }
        }
      ),
      Match.orElse(() => state)
    )
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
    const requireField = <T>(value: T | undefined, message: string) =>
      pipe(
        Match.value(value),
        Match.when(
          (candidate): candidate is T => candidate !== undefined,
          (candidate) => Effect.succeed(candidate)
        ),
        Match.orElse(() =>
          Effect.fail(
            ContainerError.make({
              reason: 'INVALID_CONFIGURATION',
              message,
            })
          )
        )
      )

    const containerType = yield* requireField(state.type, 'コンテナタイプが設定されていません')
    const ownerId = yield* requireField(state.ownerId, 'オーナーIDが設定されていません')
    const position = yield* requireField(state.position, '位置が設定されていません')
    const configuration = yield* requireField(state.configuration, '設定が初期化されていません')

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
      type: containerType,
      ownerId,
      position,
      configuration,
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
      Effect.mapError((parseError: Schema.ParseError) =>
        ContainerError.make({
          reason: 'INVALID_CONFIGURATION',
          message: 'Container集約の検証に失敗',
          issues: formatParseIssues(parseError),
          originalError: parseError,
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

      state = pipe(
        Option.fromNullable(options),
        Option.match({
          onNone: () => state,
          onSome: (opts) => {
            const withId = pipe(
              Match.value(opts.id),
              Match.when((id): id is ContainerId => id !== undefined, (id) => withContainerId(id)(state)),
              Match.orElse(() => state)
            )

            const withAccess = pipe(
              Match.value(opts.accessLevel),
              Match.when(
                (level): level is ContainerAccessLevel => level !== undefined,
                (level) => withAccessLevel(level)(withId)
              ),
              Match.orElse(() => withId)
            )

            const withConfig = pipe(
              Match.value(opts.configuration),
              Match.when((config): config is Partial<ContainerConfiguration> => config !== undefined, (config) => {
                const defaultConfig = getDefaultConfigurationForType(type)
                return withConfiguration({ ...defaultConfig, ...config })(withAccess)
              }),
              Match.orElse(() => withAccess)
            )

            const withPermissions = pipe(
              Match.value(opts.permissions),
              Match.when(
                (permissions): permissions is ReadonlyArray<ContainerPermission> => permissions !== undefined,
                (permissions) =>
                  permissions.reduce<ContainerBuilderState>((acc, permission) => withPermission(permission)(acc), withConfig)
              ),
              Match.orElse(() => withConfig)
            )

            return pipe(
              Match.value(opts.customSlots),
              Match.when(
                (slots): slots is ReadonlyArray<{ index: ContainerSlotIndex; slot: ContainerSlot }> => slots !== undefined,
                (slots) => slots.reduce((acc, { index, slot }) => withSlot(index, slot)(acc), withPermissions)
              ),
              Match.orElse(() => withPermissions)
            )
          },
        })
      )

      return yield* buildContainerFromState(state)
    }),

  restore: (data: PersistedContainer) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      // ParseErrorの構造化情報を保持してエラー診断を容易にする
      return yield* Schema.decodeUnknown(ContainerAggregateSchema)(data).pipe(
        Effect.mapError((parseError: Schema.ParseError) =>
          ContainerError.make({
            reason: 'INVALID_CONFIGURATION',
            message: `データからの復元に失敗: Schema検証エラー`,
            metadata: {
              issues: formatParseIssues(parseError),
              parseError: String(parseError),
            },
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
