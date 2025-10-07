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
import type { Position3D } from '@/domain/camera/value_object/camera_position/types'
import type { BlockTypeId } from '@/domain/shared/entities/block_type_id'
import type { PlayerId } from '@/domain/shared/entities/player_id'
import { Context, Effect, Layer, Match, Queue, Stream, pipe } from 'effect'

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

/**
 * キュー満杯エラー
 */
export class QueueFullError {
  readonly _tag = 'QueueFullError'
  constructor(readonly message: string) {}
}

/**
 * イベント処理エラー
 */
export class EventProcessingError {
  readonly _tag = 'EventProcessingError'
  constructor(
    readonly event: GameEvent,
    readonly cause: unknown
  ) {}
}

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
export const GameEventQueueLive = Layer.effect(
  GameEventQueueTag,
  Effect.gen(function* () {
    // 容量1000のboundedキュー作成
    const queue = yield* Queue.bounded<GameEvent>(1000)

    return GameEventQueueTag.of({
      enqueue: (event) =>
        pipe(
          Queue.offer(queue, event),
          Effect.flatMap((accepted) =>
            accepted ? Effect.void : Effect.fail(new QueueFullError('Game event queue is full, event dropped'))
          )
        ),

      dequeue: Queue.take(queue),

      process: pipe(
        Queue.take(queue),
        Effect.flatMap((event) =>
          pipe(
            handleEvent(event),
            Effect.catchAll((error) => Effect.fail(new EventProcessingError(event, error)))
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
