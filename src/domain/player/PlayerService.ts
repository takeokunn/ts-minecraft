import { Context, Effect, Schema, pipe } from 'effect'
import type { EntityId } from '../../infrastructure/ecs/Entity.js'
import type { EntityManagerError } from '../../infrastructure/ecs/EntityManager.js'
import type { PlayerId } from '../../shared/types/branded.js'

/**
 * プレイヤーの位置情報
 */
export const PlayerPosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type PlayerPosition = Schema.Schema.Type<typeof PlayerPosition>

/**
 * プレイヤーの向き情報
 */
export const PlayerRotation = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-Math.PI / 2, Math.PI / 2)),
  yaw: Schema.Number,
})
export type PlayerRotation = Schema.Schema.Type<typeof PlayerRotation>

/**
 * プレイヤーの状態
 */
export const PlayerState = Schema.Struct({
  playerId: Schema.String, // PlayerId branded type
  entityId: Schema.Number, // EntityId branded type
  position: PlayerPosition,
  rotation: PlayerRotation,
  health: Schema.Number.pipe(Schema.between(0, 100)),
  isActive: Schema.Boolean,
  lastUpdate: Schema.Number, // timestamp
})
export type PlayerState = Schema.Schema.Type<typeof PlayerState>

/**
 * プレイヤー作成時の設定
 */
export const PlayerConfig = Schema.Struct({
  playerId: Schema.String, // PlayerId branded type
  initialPosition: Schema.optional(PlayerPosition),
  initialRotation: Schema.optional(PlayerRotation),
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
 * プレイヤーエラー - Data.TaggedError パターン
 */
export interface PlayerError {
  readonly _tag: 'PlayerError'
  readonly message: string
  readonly reason: PlayerErrorReason
  readonly playerId?: string
  readonly entityId?: number
  readonly cause?: unknown
}

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
  ...(playerId !== undefined && { playerId }),
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
    PlayerError(
      `Player ${playerId} not found${operation ? ` during ${operation}` : ''}`,
      'PLAYER_NOT_FOUND',
      playerId
    ),
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
    PlayerError(
      `Invalid player health: ${health}`,
      'INVALID_HEALTH',
      playerId,
      undefined,
      health
    ),
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
 * プレイヤーコンポーネント型定義
 */
export interface PlayerComponent {
  readonly playerId: PlayerId
  readonly health: number
  readonly lastUpdate: number
}

export interface PositionComponent {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface RotationComponent {
  readonly pitch: number
  readonly yaw: number
}

/**
 * プレイヤー更新データ
 */
export const PlayerUpdateData = Schema.Struct({
  position: Schema.optional(PlayerPosition),
  rotation: Schema.optional(PlayerRotation),
  health: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
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
  initialPosition: { x: 0, y: 64, z: 0 },
  initialRotation: { pitch: 0, yaw: 0 },
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
    Schema.decodeUnknown(PlayerState)(state),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Player state validation failed: ${parseError.message}`, state)
    )
  )

/**
 * プレイヤー位置の検証ヘルパー
 */
export const validatePlayerPosition = (position: unknown): Effect.Effect<PlayerPosition, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerPosition)(position),
    Effect.mapError((parseError) => createPlayerError.invalidPosition(position))
  )

/**
 * プレイヤー回転の検証ヘルパー
 */
export const validatePlayerRotation = (rotation: unknown): Effect.Effect<PlayerRotation, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerRotation)(rotation),
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