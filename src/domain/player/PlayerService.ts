import { Context, Effect, pipe } from 'effect'
import { Schema } from '@effect/schema'
import type { EntityId } from '../../infrastructure/ecs/Entity.js'
import type { EntityManagerError } from '../../infrastructure/ecs/EntityManager.js'
import type { PlayerId, Timestamp, Health, Vector3D, Rotation3D } from '../../shared/types/index.js'
import {
  PlayerIdSchema,
  TimestampSchema,
  HealthSchema,
  Vector3DSchema,
  Rotation3DSchema,
  BrandedTypes,
  SpatialBrands,
} from '../../shared/types/index.js'

/**
 * プレイヤーの位置情報（Vector3Dベース）
 */
export const PlayerPositionSchema = Vector3DSchema.pipe(
  Schema.annotations({
    title: 'PlayerPosition',
    description: 'Player position in 3D world space',
  })
)
export type PlayerPosition = Schema.Schema.Type<typeof PlayerPositionSchema>

/**
 * プレイヤーの向き情報（Rotation3Dベース）
 */
export const PlayerRotationSchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-Math.PI / 2, Math.PI / 2)),
  yaw: Schema.Number.pipe(Schema.between(-2 * Math.PI, 2 * Math.PI)),
  roll: Schema.Number.pipe(Schema.between(-Math.PI, Math.PI)),
}).pipe(
  Schema.annotations({
    title: 'PlayerRotation',
    description: 'Player rotation with pitch, yaw, and roll',
  })
)
export type PlayerRotation = Schema.Schema.Type<typeof PlayerRotationSchema>

/**
 * プレイヤーの状態
 */
export const PlayerStateSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  entityId: Schema.Number, // EntityId brand型は後で定義
  position: PlayerPositionSchema,
  rotation: PlayerRotationSchema,
  health: HealthSchema,
  isActive: Schema.Boolean,
  lastUpdate: TimestampSchema,
}).pipe(
  Schema.annotations({
    title: 'PlayerState',
    description: 'Complete player state including position, rotation, and status',
  })
)
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>

/**
 * プレイヤー作成時の設定
 */
export const PlayerConfig = Schema.Struct({
  playerId: Schema.String.pipe(Schema.minLength(1)), // PlayerId branded type with min length validation
  initialPosition: Schema.optional(PlayerPositionSchema),
  initialRotation: Schema.optional(PlayerRotationSchema),
  health: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
})
export type PlayerConfig = Schema.Schema.Type<typeof PlayerConfig>

/**
 * プレイヤーエラーの詳細なカテゴリ分け
 */
export const PlayerErrorReason = Schema.Literal(
  'PLAYER_NOT_FOUND',
  'PLAYER_ALREADY_EXISTS',
  'INVALID_POSITION',
  'INVALID_ROTATION',
  'INVALID_HEALTH',
  'ENTITY_CREATION_FAILED',
  'COMPONENT_ERROR',
  'VALIDATION_ERROR'
)
export type PlayerErrorReason = Schema.Schema.Type<typeof PlayerErrorReason>

/**
 * プレイヤーエラー - Schema.Struct パターン
 */
export const PlayerErrorSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerError'),
  message: Schema.String,
  reason: PlayerErrorReason,
  playerId: Schema.optional(PlayerIdSchema),
  entityId: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'PlayerError',
    description: 'Player operation error with detailed context',
  })
)
export type PlayerError = Schema.Schema.Type<typeof PlayerErrorSchema>

export const PlayerError = (
  message: string,
  reason: PlayerErrorReason,
  playerId?: string,
  entityId?: number,
  cause?: unknown
): PlayerError => ({
  _tag: 'PlayerError',
  message,
  reason,
  ...(playerId !== undefined && { playerId: BrandedTypes.createPlayerId(playerId) }),
  ...(entityId !== undefined && { entityId }),
  ...(cause !== undefined && { cause }),
})

export const isPlayerError = (error: unknown): error is PlayerError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'PlayerError'

/**
 * プレイヤーエラー作成ヘルパー
 */
export const createPlayerError = {
  playerNotFound: (playerId: PlayerId, operation?: string) =>
    PlayerError(`Player ${playerId} not found${operation ? ` during ${operation}` : ''}`, 'PLAYER_NOT_FOUND', playerId),
  playerAlreadyExists: (playerId: PlayerId) =>
    PlayerError(`Player ${playerId} already exists`, 'PLAYER_ALREADY_EXISTS', playerId),
  invalidPosition: (position: unknown, playerId?: PlayerId) =>
    PlayerError(
      `Invalid player position: ${JSON.stringify(position)}`,
      'INVALID_POSITION',
      playerId,
      undefined,
      position
    ),
  invalidRotation: (rotation: unknown, playerId?: PlayerId) =>
    PlayerError(
      `Invalid player rotation: ${JSON.stringify(rotation)}`,
      'INVALID_ROTATION',
      playerId,
      undefined,
      rotation
    ),
  invalidHealth: (health: unknown, playerId?: PlayerId) =>
    PlayerError(`Invalid player health: ${health}`, 'INVALID_HEALTH', playerId, undefined, health),
  entityCreationFailed: (playerId: PlayerId, cause?: unknown) =>
    PlayerError(`Failed to create entity for player ${playerId}`, 'ENTITY_CREATION_FAILED', playerId, undefined, cause),
  componentError: (playerId: PlayerId, componentType: string, cause?: unknown) =>
    PlayerError(
      `Component error for player ${playerId}: ${componentType}`,
      'COMPONENT_ERROR',
      playerId,
      undefined,
      cause
    ),
  validationError: (message: string, cause?: unknown) =>
    PlayerError(`Validation error: ${message}`, 'VALIDATION_ERROR', undefined, undefined, cause),
}

/**
 * プレイヤーコンポーネント型定義（Schema版）
 */
export const PlayerComponentSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  health: HealthSchema,
  lastUpdate: TimestampSchema,
}).pipe(
  Schema.annotations({
    title: 'PlayerComponent',
    description: 'ECS Player component with branded types',
  })
)
export type PlayerComponent = Schema.Schema.Type<typeof PlayerComponentSchema>

export const PositionComponentSchema = Vector3DSchema.pipe(
  Schema.annotations({
    title: 'PositionComponent',
    description: 'ECS Position component using Vector3D',
  })
)
export type PositionComponent = Schema.Schema.Type<typeof PositionComponentSchema>

export const RotationComponentSchema = PlayerRotationSchema.pipe(
  Schema.annotations({
    title: 'RotationComponent',
    description: 'ECS Rotation component for player orientation',
  })
)
export type RotationComponent = Schema.Schema.Type<typeof RotationComponentSchema>

/**
 * プレイヤー更新データ
 */
export const PlayerUpdateData = Schema.Struct({
  position: Schema.optional(PlayerPositionSchema),
  rotation: Schema.optional(PlayerRotationSchema),
  health: Schema.optional(HealthSchema),
})
export type PlayerUpdateData = Schema.Schema.Type<typeof PlayerUpdateData>

/**
 * PlayerService - プレイヤー管理サービス
 *
 * ECS (Entity Component System) と統合したプレイヤー管理
 * - プレイヤーエンティティの作成・削除
 * - プレイヤー状態の更新・取得
 * - 位置・回転・体力の管理
 * - Schema検証による実行時安全性
 */
export interface PlayerService {
  /**
   * プレイヤーの作成 - Schema検証付き
   */
  readonly createPlayer: (config: unknown) => Effect.Effect<EntityId, PlayerError | EntityManagerError>

  /**
   * プレイヤーの削除
   */
  readonly destroyPlayer: (playerId: PlayerId) => Effect.Effect<void, PlayerError | EntityManagerError>

  /**
   * プレイヤー状態の更新 - Schema検証付き
   */
  readonly updatePlayerState: (
    playerId: PlayerId,
    updateData: unknown
  ) => Effect.Effect<void, PlayerError | EntityManagerError>

  /**
   * プレイヤー状態の取得
   */
  readonly getPlayerState: (playerId: PlayerId) => Effect.Effect<PlayerState, PlayerError>

  /**
   * プレイヤーの位置設定 - Schema検証付き
   */
  readonly setPlayerPosition: (playerId: PlayerId, position: unknown) => Effect.Effect<void, PlayerError>

  /**
   * プレイヤーの回転設定 - Schema検証付き
   */
  readonly setPlayerRotation: (playerId: PlayerId, rotation: unknown) => Effect.Effect<void, PlayerError>

  /**
   * プレイヤーの体力設定 - Schema検証付き
   */
  readonly setPlayerHealth: (playerId: PlayerId, health: unknown) => Effect.Effect<void, PlayerError>

  /**
   * プレイヤーのアクティブ状態設定
   */
  readonly setPlayerActive: (playerId: PlayerId, active: boolean) => Effect.Effect<void, PlayerError>

  /**
   * 全プレイヤーの一覧取得
   */
  readonly getAllPlayers: () => Effect.Effect<ReadonlyArray<PlayerState>, never>

  /**
   * プレイヤーの存在確認
   */
  readonly playerExists: (playerId: PlayerId) => Effect.Effect<boolean, never>

  /**
   * 指定範囲内のプレイヤー検索
   */
  readonly getPlayersInRange: (
    center: PlayerPosition,
    radius: number
  ) => Effect.Effect<ReadonlyArray<PlayerState>, PlayerError>

  /**
   * プレイヤー統計情報の取得
   */
  readonly getPlayerStats: () => Effect.Effect<
    {
      totalPlayers: number
      activePlayers: number
      averageHealth: number
    },
    never
  >
}

/**
 * PlayerService サービスタグ
 */
export const PlayerService = Context.GenericTag<PlayerService>('@minecraft/domain/PlayerService')

/**
 * デフォルトのプレイヤー設定
 */
export const DEFAULT_PLAYER_CONFIG: Omit<PlayerConfig, 'playerId'> = {
  initialPosition: SpatialBrands.createVector3D(0, 64, 0),
  initialRotation: { pitch: 0, yaw: 0, roll: 0 },
  health: 100,
}

/**
 * プレイヤー設定の検証ヘルパー
 */
export const validatePlayerConfig = (config: unknown): Effect.Effect<PlayerConfig, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerConfig)(config),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Player config validation failed: ${parseError.message}`, config)
    )
  )

/**
 * プレイヤー状態の検証ヘルパー
 */
export const validatePlayerState = (state: unknown): Effect.Effect<PlayerState, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerStateSchema)(state),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Player state validation failed: ${parseError.message}`, state)
    )
  )

/**
 * プレイヤー位置の検証ヘルパー
 */
export const validatePlayerPosition = (position: unknown): Effect.Effect<PlayerPosition, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerPositionSchema)(position),
    Effect.mapError((parseError) => createPlayerError.invalidPosition(position))
  )

/**
 * プレイヤー回転の検証ヘルパー
 */
export const validatePlayerRotation = (rotation: unknown): Effect.Effect<PlayerRotation, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerRotationSchema)(rotation),
    Effect.mapError((parseError) => createPlayerError.invalidRotation(rotation))
  )

/**
 * プレイヤー更新データの検証ヘルパー
 */
export const validatePlayerUpdateData = (updateData: unknown): Effect.Effect<PlayerUpdateData, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerUpdateData)(updateData),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Player update data validation failed: ${parseError.message}`, updateData)
    )
  )
