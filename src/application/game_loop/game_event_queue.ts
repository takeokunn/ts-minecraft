/**
 * @fileoverview Game Event Queue - ゲームループイベントキュー実装
 *
 * FIBER_STM_QUEUE_POOL_STREAM_DESIGN.md H-2に基づく実装：
 * - Queue.bounded(1000)によるバックプレッシャー制御
 * - Streamベースの非同期イベント処理
 * - Match APIによる型安全なイベントハンドリング
 *
 * 期待効果:
 * - フレームドロップ削減（イベント処理の非同期化）
 * - バックプレッシャー制御（キュー満杯時の自動制御）
 * - 明示的なイベントフロー
 */

import type { BlockCoordinate } from '@/domain/biome/value_object/coordinates'
import { BlockCoordinateSchema } from '@/domain/biome/value_object/coordinates'
import { Position3DSchema } from '@/domain/camera/value_object/camera_position'
import type { Position3D } from '@/domain/camera/value_object/camera_position/types'
import { BlockTypeIdSchema } from '@/domain/shared/entities/block_type_id'
import type { BlockTypeId } from '@/domain/shared/entities/block_type_id'
import { PlayerIdSchema } from '@/domain/shared/entities/player_id/schema'
import type { PlayerId } from '@/domain/shared/entities/player_id'
import { Context, Effect, Layer, Match, Queue, Stream, pipe } from 'effect'
import { ErrorCauseSchema } from '@shared/schema/error'
import type { ErrorCause } from '@shared/schema/error'

/**
 * ゲームイベント定義
 *
 * 既存のイベント型を統合した包括的なイベント型:
 * - PlayerMoved: プレイヤー移動イベント
 * - BlockPlaced: ブロック配置イベント（InteractionEventから）
 * - ChunkLoaded: チャンク読み込み完了イベント（ChunkEventから）
 */
export type GameEvent =
  | { readonly _tag: 'PlayerMoved'; readonly playerId: PlayerId; readonly position: Position3D }
  | { readonly _tag: 'BlockPlaced'; readonly position: BlockCoordinate; readonly blockType: BlockTypeId }
  | { readonly _tag: 'ChunkLoaded'; readonly chunkId: string }

const PlayerMovedEventSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerMoved'),
  playerId: PlayerIdSchema,
  position: Position3DSchema,
})

const BlockPlacedEventSchema = Schema.Struct({
  _tag: Schema.Literal('BlockPlaced'),
  position: BlockCoordinateSchema,
  blockType: BlockTypeIdSchema,
})

const ChunkLoadedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkLoaded'),
  chunkId: Schema.String,
})

const GameEventSchema = Schema.Union(PlayerMovedEventSchema, BlockPlacedEventSchema, ChunkLoadedEventSchema)

/**
 * キュー満杯エラー
 */
export const QueueFullErrorSchema = Schema.TaggedStruct('QueueFullError', {
  message: Schema.String,
})

export type QueueFullError = Schema.Schema.Type<typeof QueueFullErrorSchema>

/**
 * QueueFullErrorを生成するヘルパー関数
 */
export const createQueueFullError = (message: string): QueueFullError =>
  Schema.decodeSync(QueueFullErrorSchema)({
    _tag: 'QueueFullError' as const,
    message,
  })

/**
 * イベント処理エラー
 */
export const EventProcessingErrorSchema = Schema.TaggedStruct('EventProcessingError', {
  event: GameEventSchema,
  cause: ErrorCauseSchema,
})

export type EventProcessingError = Schema.Schema.Type<typeof EventProcessingErrorSchema>

/**
 * EventProcessingErrorを生成するヘルパー関数
 */
export const createEventProcessingError = (event: GameEvent, cause: ErrorCause): EventProcessingError =>
  Schema.decodeSync(EventProcessingErrorSchema)({
    _tag: 'EventProcessingError' as const,
    event,
    cause,
  })

/**
 * GameEventQueue Service
 *
 * ゲームイベントの非同期処理を提供:
 * - enqueue: イベントをキューに追加（非ブロッキング）
 * - dequeue: キューからイベントを取得
 * - process: イベント処理ループ（永続実行）
 */
export interface GameEventQueue {
  /**
   * イベントをキューに追加
   *
   * キュー満杯時はQueueFullErrorを返す
   */
  readonly enqueue: (event: GameEvent) => Effect.Effect<void, QueueFullError>

  /**
   * キューからイベントを取得
   *
   * キューが空の場合は待機
   */
  readonly dequeue: Effect.Effect<GameEvent>

  /**
   * イベント処理ループ（永続実行）
   *
   * Queue.takeでイベントを取得し、handleEventで処理
   * Effect.foreverで無限ループ実行
   */
  readonly process: Effect.Effect<void, EventProcessingError>
}

/**
 * GameEventQueue Service Tag
 */
export const GameEventQueueTag = Context.GenericTag<GameEventQueue>('@minecraft/application/game_loop/GameEventQueue')

/**
 * イベントハンドラ実装（プレースホルダー）
 *
 * Match APIによる型安全なイベント処理:
 * - Match.tag: タグベースのパターンマッチング
 * - Match.exhaustive: 全ケース網羅の強制
 */
const handlePlayerMoved = (event: Extract<GameEvent, { _tag: 'PlayerMoved' }>): Effect.Effect<void> =>
  Effect.logInfo(
    `[GameEventQueue] PlayerMoved: ${event.playerId} -> (${event.position.x}, ${event.position.y}, ${event.position.z})`
  )

const handleBlockPlaced = (event: Extract<GameEvent, { _tag: 'BlockPlaced' }>): Effect.Effect<void> =>
  Effect.logInfo(`[GameEventQueue] BlockPlaced: blockType=${event.blockType} at position`)

const handleChunkLoaded = (event: Extract<GameEvent, { _tag: 'ChunkLoaded' }>): Effect.Effect<void> =>
  Effect.logInfo(`[GameEventQueue] ChunkLoaded: chunkId=${event.chunkId}`)

/**
 * イベントハンドラ（Match API活用）
 */
const handleEvent = (event: GameEvent): Effect.Effect<void> =>
  pipe(
    Match.value(event),
    Match.tag('PlayerMoved', handlePlayerMoved),
    Match.tag('BlockPlaced', handleBlockPlaced),
    Match.tag('ChunkLoaded', handleChunkLoaded),
    Match.exhaustive
  )

/**
 * GameEventQueue Live Implementation
 *
 * Queue.bounded(1000)でバックプレッシャー制御:
 * - キュー満杯時はenqueueが失敗
 * - 1000イベントまでバッファリング可能
 */
export const GameEventQueueLive = Layer.scoped(
  GameEventQueueTag,
  Effect.gen(function* () {
    // 容量1000のboundedキューをScope配下で確保し、終了時に自動解放
    const queue = yield* Effect.acquireRelease(
      Queue.bounded<GameEvent>(1000),
      (q) => Queue.shutdown(q)
    )

    return GameEventQueueTag.of({
      enqueue: (event) =>
        pipe(
          Queue.offer(queue, event),
          Effect.flatMap((accepted) =>
            accepted ? Effect.void : Effect.fail(createQueueFullError('Game event queue is full, event dropped'))
          )
        ),

      dequeue: Queue.take(queue),

      process: pipe(
        Queue.take(queue),
        Effect.flatMap((event) =>
          pipe(
            handleEvent(event),
            Effect.catchAll((error) => Effect.fail(createEventProcessingError(event, error)))
          )
        ),
        Effect.forever
      ),
    })
  })
)

/**
 * Stream版イベント処理（将来拡張用）
 *
 * Queue + Streamパターンでより高度な処理が可能:
 * - Stream.buffer: バッファリング制御
 * - Stream.mapEffect: 並列処理（concurrency指定可能）
 *
 * 現在のprocess実装はシンプルなEffect.foreverを使用
 */
export const makeEventStream = (queue: Queue.Queue<GameEvent>) =>
  pipe(
    Stream.fromQueue(queue),
    Stream.buffer({ capacity: 16 }), // バッファリング
    Stream.mapEffect(handleEvent, { concurrency: 2 }) // 2並列処理
  )
