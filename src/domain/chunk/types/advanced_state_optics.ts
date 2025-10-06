/**
 * Advanced ChunkState Optics - 高度なADT状態管理システム
 *
 * 既存のstate_optics.tsを拡張し、より高度なOptics操作を提供
 * 複雑な状態遷移、並列処理、キャッシュ機能を実現
 */

import * as Optic from '@fp-ts/optic'
import { Cache, Duration, Effect, Chunk as EffectChunk, Either, Match, Option, pipe, Schedule } from 'effect'
import type { ChunkMetadata } from '../value_object/chunk_metadata'
import type { ChunkDataBytes, ChunkState, ChunkTimestamp, LoadProgress } from './index'
import { ChunkStateGuards } from './index'

/**
 * 高度なChunkState操作用のOptics拡張
 * 複雑な状態遷移と条件付き操作を提供
 */
export const AdvancedChunkStateOptics = {
  /**
   * 条件付きOptics - 状態に応じて動的にOpticsを選択
   * @param condition - 条件関数
   * @param whenTrue - 条件がtrueの場合のOptics
   * @param whenFalse - 条件がfalseの場合のOptics
   *
   * Note: @fp-ts/opticでは動的Optic選択は直接サポートされていないため、
   * この関数は使用しないでください。代わりにfilter()を使用してください。
   */
  conditional: <A>(
    condition: (state: ChunkState) => boolean,
    whenTrue: Optic.Optic<ChunkState, unknown, never, A, never, A, ChunkState>,
    whenFalse: Optic.Optic<ChunkState, unknown, never, A, never, A, ChunkState>
  ): Optic.Optic<ChunkState, unknown, never, A, never, A, ChunkState> => {
    // @fp-ts/opticでは動的選択が難しいため、プレースホルダー実装
    return whenTrue
  },

  /**
   * 複数状態対応データアクセスOptic
   * データを持つ任意の状態からデータにアクセス
   */
  anyStateData: Optic.id<ChunkState>()
    .filter((state): state is Extract<ChunkState, { data: ChunkDataBytes }> => ChunkStateGuards.hasData(state))
    .at('data'),

  /**
   * 複数状態対応メタデータアクセスOptic
   * メタデータを持つ任意の状態からメタデータにアクセス
   */
  anyStateMetadata: Optic.id<ChunkState>()
    .filter((state): state is Extract<ChunkState, { metadata: ChunkMetadata }> => ChunkStateGuards.hasMetadata(state))
    .at('metadata'),

  /**
   * 複数状態対応進行度アクセスOptic
   * 進行度を持つ任意の状態から進行度にアクセス
   */
  anyStateProgress: Optic.id<ChunkState>()
    .filter((state): state is Extract<ChunkState, { progress: LoadProgress }> => ChunkStateGuards.hasProgress(state))
    .at('progress'),

  /**
   * タイムスタンプアクセスOptic（状態に応じて適切なタイムスタンプを取得）
   */
  relevantTimestamp: (state: ChunkState): Option.Option<ChunkTimestamp> =>
    Match.value(state).pipe(
      Match.when({ _tag: 'Loading' }, (s) => Option.some(s.startTime)),
      Match.when({ _tag: 'Loaded' }, (s) => Option.some(s.loadTime)),
      Match.when({ _tag: 'Failed' }, (s) => Option.some(s.lastAttempt)),
      Match.when({ _tag: 'Cached' }, (s) => Option.some(s.cacheTime)),
      Match.orElse(() => Option.none())
    ),

  /**
   * 状態特有プロパティの条件付きアクセス
   * @param propertyName - アクセスするプロパティ名
   */
  conditionalProperty: <K extends keyof ChunkState>(propertyName: K) =>
    Optic.id<ChunkState>()
      .filter((state): state is ChunkState & Record<K, unknown> => propertyName in state)
      .at(propertyName),
} as const

/**
 * 状態遷移用の高度なOptics操作
 * 型安全な状態遷移とロールバック機能を提供
 */
export const ChunkStateTransitionOptics = {
  /**
   * 安全な状態遷移（前状態の検証付き）
   * @param fromState - 遷移元状態タグ
   * @param toState - 遷移先状態
   * @param validation - 遷移条件の検証関数
   */
  safeTransition:
    <TFrom extends ChunkState['_tag'], TTo extends ChunkState>(
      fromState: TFrom,
      toState: TTo,
      validation?: (state: Extract<ChunkState, { _tag: TFrom }>) => boolean
    ) =>
    (state: ChunkState): Either.Either<TTo, string> => {
      if (state._tag !== fromState) {
        return Either.left(`Invalid transition: expected ${fromState}, got ${state._tag}`)
      }

      if (validation && !validation(state as Extract<ChunkState, { _tag: TFrom }>)) {
        return Either.left(`Transition validation failed from ${fromState}`)
      }

      return Either.right(toState)
    },

  /**
   * 条件付き状態遷移
   * @param conditions - 状態遷移の条件マップ
   */
  conditionalTransition:
    (
      conditions: ReadonlyArray<{
        condition: (state: ChunkState) => boolean
        transition: (state: ChunkState) => ChunkState
      }>
    ) =>
    (state: ChunkState): ChunkState => {
      for (const { condition, transition } of conditions) {
        if (condition(state)) {
          return transition(state)
        }
      }
      return state // 条件に合致しない場合は元の状態を返す
    },

  /**
   * ロールバック機能付き状態遷移
   * @param transition - 状態遷移関数
   * @param rollbackCondition - ロールバック条件
   */
  transitionWithRollback:
    (
      transition: (state: ChunkState) => ChunkState,
      rollbackCondition: (newState: ChunkState, oldState: ChunkState) => boolean
    ) =>
    (state: ChunkState): ChunkState => {
      const newState = transition(state)
      return rollbackCondition(newState, state) ? state : newState
    },

  /**
   * タイムアウト付き状態遷移
   * @param transition - 非同期状態遷移
   * @param timeoutMs - タイムアウト時間（ミリ秒）
   */
  transitionWithTimeout:
    (
      transition: (state: ChunkState) => Effect.Effect<ChunkState>,
      timeoutMs: number
    ): ((state: ChunkState) => Effect.Effect<ChunkState, string>) =>
    (state: ChunkState) =>
      pipe(
        transition(state),
        Effect.timeout(Duration.millis(timeoutMs)),
        Effect.mapError(() => `State transition timed out after ${timeoutMs}ms`)
      ),
} as const

/**
 * 並列状態処理用のOptics
 * 複数のチャンク状態を効率的に処理
 */
export const ParallelChunkStateOptics = {
  /**
   * 複数チャンク状態の並列更新
   * @param states - 対象状態の配列
   * @param operation - 各状態に適用する操作
   */
  parallelUpdate: (
    states: ReadonlyArray<ChunkState>,
    operation: (state: ChunkState, index: number) => Effect.Effect<ChunkState>
  ): Effect.Effect<ReadonlyArray<ChunkState>> => Effect.all(states.map(operation)),

  /**
   * 状態フィルタリング付き並列更新
   * @param states - 対象状態の配列
   * @param filter - 更新対象フィルター
   * @param operation - 更新操作
   */
  parallelFilteredUpdate: (
    states: ReadonlyArray<ChunkState>,
    filter: (state: ChunkState) => boolean,
    operation: (state: ChunkState) => Effect.Effect<ChunkState>
  ): Effect.Effect<ReadonlyArray<ChunkState>> =>
    Effect.all(states.map((state) => (filter(state) ? operation(state) : Effect.succeed(state)))),

  /**
   * バッチサイズ制限付き並列処理
   * @param states - 対象状態の配列
   * @param operation - 処理操作
   * @param batchSize - バッチサイズ
   */
  batchedParallelUpdate: (
    states: ReadonlyArray<ChunkState>,
    operation: (state: ChunkState) => Effect.Effect<ChunkState>,
    batchSize: number = 10
  ): Effect.Effect<ReadonlyArray<ChunkState>> =>
    Effect.gen(function* () {
      const chunks = EffectChunk.fromIterable(states)
      const batches = EffectChunk.chunksOf(chunks, batchSize)
      const results: ChunkState[] = []

      for (const batch of batches) {
        const batchResults = yield* Effect.all(EffectChunk.toReadonlyArray(batch).map(operation))
        results.push(...batchResults)
      }

      return results
    }),

  /**
   * 状態統計の並列計算
   * @param states - 対象状態の配列
   */
  parallelStatistics: (
    states: ReadonlyArray<ChunkState>
  ): Effect.Effect<{
    total: number
    byState: Record<ChunkState['_tag'], number>
    hasData: number
    hasProgress: number
    hasErrors: number
  }> =>
    Effect.gen(function* () {
      const statistics = yield* Effect.all(
        states.map((state) =>
          Effect.sync(() => ({
            tag: state._tag,
            hasData: ChunkStateGuards.hasData(state),
            hasProgress: ChunkStateGuards.hasProgress(state),
            hasError: ChunkStateGuards.isFailed(state),
          }))
        )
      )

      const byState: Record<string, number> = {}
      let hasData = 0
      let hasProgress = 0
      let hasErrors = 0

      statistics.forEach((stat) => {
        byState[stat.tag] = (byState[stat.tag] || 0) + 1
        if (stat.hasData) hasData++
        if (stat.hasProgress) hasProgress++
        if (stat.hasError) hasErrors++
      })

      return {
        total: states.length,
        byState: byState as Record<ChunkState['_tag'], number>,
        hasData,
        hasProgress,
        hasErrors,
      }
    }),
} as const

/**
 * キャッシュ機能付きOptics操作
 * 状態アクセスのパフォーマンス最適化
 */
export const CachedChunkStateOptics = {
  /**
   * 状態プロパティのキャッシュ付きアクセス
   */
  createPropertyCache: <T>(
    extractor: (state: ChunkState) => Option.Option<T>,
    cacheConfig: {
      capacity?: number
      timeToLive?: Duration.Duration
    } = {}
  ) =>
    Cache.make({
      capacity: cacheConfig.capacity || 100,
      timeToLive: cacheConfig.timeToLive || Duration.minutes(5),
      lookup: (state: ChunkState) => Effect.succeed(extractor(state)),
    }),

  /**
   * メタデータキャッシュの作成
   */
  createMetadataCache: () =>
    CachedChunkStateOptics.createPropertyCache(
      (state) =>
        ChunkStateGuards.hasMetadata(state)
          ? Option.some(AdvancedChunkStateOptics.anyStateMetadata.get(state))
          : Option.none(),
      { capacity: 50, timeToLive: Duration.minutes(10) }
    ),

  /**
   * データサイズキャッシュの作成
   */
  createDataSizeCache: () =>
    CachedChunkStateOptics.createPropertyCache(
      (state) =>
        ChunkStateGuards.hasData(state)
          ? Option.some(AdvancedChunkStateOptics.anyStateData.get(state)?.length || 0)
          : Option.none(),
      { capacity: 200, timeToLive: Duration.minutes(15) }
    ),
} as const

/**
 * リアクティブな状態監視Optics
 * 状態変更の監視と自動処理
 */
export const ReactiveChunkStateOptics = {
  /**
   * 状態変更監視器の作成
   * @param onStateChange - 状態変更コールバック
   */
  createStateWatcher:
    (onStateChange: (oldState: ChunkState, newState: ChunkState) => Effect.Effect<void>) =>
    (state: ChunkState) =>
    (newState: ChunkState) =>
      Effect.gen(function* () {
        if (state._tag !== newState._tag) {
          yield* onStateChange(state, newState)
        }
        return newState
      }),

  /**
   * 特定状態遷移の監視
   * @param fromState - 監視対象の遷移元状態
   * @param toState - 監視対象の遷移先状態
   * @param callback - 遷移時のコールバック
   */
  watchTransition: <TFrom extends ChunkState['_tag'], TTo extends ChunkState['_tag']>(
    fromState: TFrom,
    toState: TTo,
    callback: (
      oldState: Extract<ChunkState, { _tag: TFrom }>,
      newState: Extract<ChunkState, { _tag: TTo }>
    ) => Effect.Effect<void>
  ) =>
    ReactiveChunkStateOptics.createStateWatcher((oldState, newState) =>
      oldState._tag === fromState && newState._tag === toState
        ? callback(oldState as Extract<ChunkState, { _tag: TFrom }>, newState as Extract<ChunkState, { _tag: TTo }>)
        : Effect.void
    ),

  /**
   * エラー状態の自動監視
   * @param onError - エラー検出時のコールバック
   */
  watchErrors: (onError: (failedState: Extract<ChunkState, { _tag: 'Failed' }>) => Effect.Effect<void>) =>
    ReactiveChunkStateOptics.createStateWatcher((_, newState) =>
      ChunkStateGuards.isFailed(newState) ? onError(newState as Extract<ChunkState, { _tag: 'Failed' }>) : Effect.void
    ),

  /**
   * 進行度変更の監視
   * @param onProgressChange - 進行度変更時のコールバック
   */
  watchProgress: (onProgressChange: (progress: LoadProgress, state: ChunkState) => Effect.Effect<void>) =>
    ReactiveChunkStateOptics.createStateWatcher((oldState, newState) => {
      const oldProgress = ChunkStateGuards.hasProgress(oldState)
        ? AdvancedChunkStateOptics.anyStateProgress.get(oldState)
        : undefined
      const newProgress = ChunkStateGuards.hasProgress(newState)
        ? AdvancedChunkStateOptics.anyStateProgress.get(newState)
        : undefined

      return oldProgress !== newProgress && newProgress !== undefined
        ? onProgressChange(newProgress, newState)
        : Effect.void
    }),
} as const

/**
 * エラーハンドリング付きOptics操作
 * 安全な状態操作とエラー回復
 */
export const SafeChunkStateOptics = {
  /**
   * 安全な状態プロパティアクセス
   * @param optic - アクセス用Optic
   * @param fallback - アクセス失敗時のフォールバック値
   */
  safeGet:
    <A>(optic: Optic.Optic<ChunkState, ChunkState, A, A>, fallback: A) =>
    (state: ChunkState): A =>
      pipe(
        Effect.try({
          try: () => optic.get(state) ?? fallback,
          catch: () => fallback,
        }),
        Effect.runSync
      ),

  /**
   * 安全な状態プロパティ更新
   * @param optic - 更新用Optic
   * @param value - 新しい値
   */
  safeSet:
    <A>(optic: Optic.Optic<ChunkState, ChunkState, A, A>, value: A) =>
    (state: ChunkState): Either.Either<ChunkState, string> =>
      pipe(
        Effect.try({
          try: () => optic.replace(value)(state),
          catch: (error) => `Failed to set state property: ${error}`,
        }),
        Effect.either,
        Effect.runSync
      ),

  /**
   * リトライ機能付き状態操作
   * @param operation - 実行する操作
   * @param maxRetries - 最大リトライ回数
   */
  withRetry:
    <A>(operation: (state: ChunkState) => Effect.Effect<A>, maxRetries: number = 3) =>
    (state: ChunkState): Effect.Effect<A> =>
      pipe(operation(state), Effect.retry(Schedule.recurs(maxRetries))),

  /**
   * タイムアウト付き安全操作
   * @param operation - 実行する操作
   * @param timeoutMs - タイムアウト時間
   */
  withTimeout:
    <A>(operation: (state: ChunkState) => Effect.Effect<A>, timeoutMs: number) =>
    (state: ChunkState): Effect.Effect<A, string> =>
      pipe(
        operation(state),
        Effect.timeout(Duration.millis(timeoutMs)),
        Effect.mapError(() => `Operation timed out after ${timeoutMs}ms`)
      ),
} as const

/**
 * 高度なChunkState操作用の型定義
 */
export type AdvancedStateOptic<A> = Optic.Optic<ChunkState, ChunkState, A, A>
export type StateTransition<TFrom extends ChunkState, TTo extends ChunkState> = (
  state: TFrom
) => Either.Either<TTo, string>
export type AsyncStateTransition<TFrom extends ChunkState, TTo extends ChunkState> = (
  state: TFrom
) => Effect.Effect<TTo, string>
export type StateWatcher = (oldState: ChunkState, newState: ChunkState) => Effect.Effect<void>
export type ProgressWatcher = (progress: LoadProgress, state: ChunkState) => Effect.Effect<void>
