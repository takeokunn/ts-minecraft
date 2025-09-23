/**
 * Chunk Loader Service Implementation
 * 非同期チャンクロード・優先度管理（クラス使用禁止）
 */

import { Context, Effect, Ref, Queue, Fiber, Schema, Layer, Exit, Option, Match, pipe } from 'effect'
import type { ChunkPosition, Chunk } from './index'
import { createChunk } from './Chunk'
import type { WorldGenerator as WorldGeneratorInterface, GenerationError } from '../world/index'
import { WorldGeneratorTag } from '../world/index'

// チャンクローダー用タイムスタンプ生成ユーティリティ
const getCurrentTimestamp = (): number => Date.now()

// =============================================================================
// Types & Schemas
// =============================================================================

export const ChunkLoadPrioritySchema = Schema.Literal('immediate', 'high', 'normal', 'low')
export type ChunkLoadPriority = Schema.Schema.Type<typeof ChunkLoadPrioritySchema>

export const ChunkLoadRequestSchema = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  priority: ChunkLoadPrioritySchema,
  timestamp: Schema.Number,
  playerDistance: Schema.Number.pipe(Schema.nonNegative()),
})

export type ChunkLoadRequest = Schema.Schema.Type<typeof ChunkLoadRequestSchema>

export const ChunkLoaderConfigSchema = Schema.Struct({
  maxConcurrentLoads: Schema.Number.pipe(Schema.positive()),
  queueCapacity: Schema.Number.pipe(Schema.positive()),
  timeoutMs: Schema.Number.pipe(Schema.positive()),
  priorityWeights: Schema.Struct({
    immediate: Schema.Number,
    high: Schema.Number,
    normal: Schema.Number,
    low: Schema.Number,
  }),
})

export type ChunkLoaderConfig = Schema.Schema.Type<typeof ChunkLoaderConfigSchema>

export const defaultChunkLoaderConfig: ChunkLoaderConfig = {
  maxConcurrentLoads: 4,
  queueCapacity: 1000,
  timeoutMs: 30000, // 30秒
  priorityWeights: {
    immediate: 1000,
    high: 100,
    normal: 10,
    low: 1,
  },
}

// =============================================================================
// Load States
// =============================================================================

export interface ChunkLoadState {
  readonly position: ChunkPosition
  readonly status: 'queued' | 'loading' | 'completed' | 'failed'
  readonly startTime?: number | undefined
  readonly completedTime?: number | undefined
  readonly error?: GenerationError | undefined
  readonly chunk?: Chunk | undefined
}

export interface ChunkLoaderState {
  readonly loadQueue: Queue.Queue<ChunkLoadRequest>
  readonly activeLoads: Map<string, Fiber.RuntimeFiber<Chunk, GenerationError>>
  readonly loadStates: Map<string, ChunkLoadState>
  readonly config: ChunkLoaderConfig
}

// =============================================================================
// Priority Queue Operations (純粋関数実装)
// =============================================================================

export const calculatePriorityScore = (request: ChunkLoadRequest, config: ChunkLoaderConfig): number => {
  const baseScore = config.priorityWeights[request.priority]
  const distancePenalty = request.playerDistance * 0.1
  const agePenalty = (getCurrentTimestamp() - request.timestamp) * 0.001

  return baseScore - distancePenalty - agePenalty
}

export const sortRequestsByPriority = (requests: ChunkLoadRequest[], config: ChunkLoaderConfig): ChunkLoadRequest[] =>
  requests
    .map((request) => ({
      request,
      score: calculatePriorityScore(request, config),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ request }) => request)

export const createChunkLoadRequest = (
  position: ChunkPosition,
  priority: ChunkLoadPriority,
  playerDistance: number
): ChunkLoadRequest => ({
  position,
  priority,
  timestamp: getCurrentTimestamp(),
  playerDistance,
})

// =============================================================================
// ChunkLoader Service Interface
// =============================================================================

export interface ChunkLoader {
  /**
   * チャンクをロードキューに追加
   */
  readonly queueChunkLoad: (
    position: ChunkPosition,
    priority: ChunkLoadPriority,
    playerDistance: number
  ) => Effect.Effect<void, never>

  /**
   * 複数チャンクをバッチでキューに追加
   */
  readonly queueChunkLoadBatch: (
    requests: Array<{
      position: ChunkPosition
      priority: ChunkLoadPriority
      playerDistance: number
    }>
  ) => Effect.Effect<void, never>

  /**
   * チャンクロードを開始（バックグラウンド処理）
   */
  readonly startLoadProcessing: () => Effect.Effect<Fiber.RuntimeFiber<void, never>, never>

  /**
   * チャンクロードを停止
   */
  readonly stopLoadProcessing: () => Effect.Effect<void, never>

  /**
   * ロード状態を取得
   */
  readonly getLoadState: (position: ChunkPosition) => Effect.Effect<ChunkLoadState | null, never>

  /**
   * アクティブなロード数を取得
   */
  readonly getActiveLoadCount: () => Effect.Effect<number, never>

  /**
   * キューに残っているリクエスト数を取得
   */
  readonly getQueueSize: () => Effect.Effect<number, never>

  /**
   * 指定したチャンクのロードをキャンセル
   */
  readonly cancelChunkLoad: (position: ChunkPosition) => Effect.Effect<boolean, never>

  /**
   * 全てのロードをキャンセル
   */
  readonly cancelAllLoads: () => Effect.Effect<void, never>
}

export const ChunkLoader = Context.GenericTag<ChunkLoader>('ChunkLoader')

// =============================================================================
// Utilities
// =============================================================================

export const chunkLoadRequestToKey = (position: ChunkPosition): string => `${position.x},${position.z}`

export const isLoadExpired = (state: ChunkLoadState, timeoutMs: number): boolean => {
  return pipe(
    Option.fromNullable(state.startTime),
    Option.match({
      onNone: () => false,
      onSome: (startTime) => getCurrentTimestamp() - startTime > timeoutMs,
    })
  )
}

// =============================================================================
// Service Implementation
// =============================================================================

export const createChunkLoader = (
  config: ChunkLoaderConfig = defaultChunkLoaderConfig
): Effect.Effect<ChunkLoader, never> =>
  Effect.gen(function* () {
    // State管理
    const state = yield* Ref.make<ChunkLoaderState>({
      loadQueue: yield* Queue.bounded<ChunkLoadRequest>(config.queueCapacity),
      activeLoads: new Map(),
      loadStates: new Map(),
      config,
    })

    // ロード処理用Fiberの管理
    const processingFiber = yield* Ref.make<Fiber.RuntimeFiber<void, never> | null>(null)

    const queueChunkLoad = (
      position: ChunkPosition,
      priority: ChunkLoadPriority,
      playerDistance: number
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const key = chunkLoadRequestToKey(position)

        // 既にロード済みまたは進行中の場合はスキップ
        const existing = yield* pipe(
          Option.fromNullable(currentState.loadStates.get(key)),
          Option.match({
            onNone: () => Effect.succeed(null),
            onSome: (state) => Effect.succeed(state),
          })
        )

        yield* pipe(
          Option.fromNullable(existing),
          Option.match({
            onNone: () => Effect.succeed(undefined),
            onSome: (existingState) =>
              pipe(
                existingState.status === 'loading' || existingState.status === 'completed',
                Match.value,
                Match.when(true, () => Effect.succeed('skip')),
                Match.orElse(() => Effect.succeed(undefined))
              ),
          })
        )

        const request = createChunkLoadRequest(position, priority, playerDistance)

        // キューに追加を試行
        const added = yield* Queue.offer(currentState.loadQueue, request)
        yield* pipe(
          added,
          Match.value,
          Match.when(true, () =>
            Effect.gen(function* () {
              // ロード状態を更新
              yield* Ref.update(state, (currentState) => ({
                ...currentState,
                loadStates: new Map(currentState.loadStates).set(key, {
                  position,
                  status: 'queued' as const,
                }),
              }))
            })
          ),
          Match.orElse(() => Effect.succeed(undefined))
        )
      })

    const queueChunkLoadBatch = (
      requests: Array<{
        position: ChunkPosition
        priority: ChunkLoadPriority
        playerDistance: number
      }>
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        // バッチ処理で効率化
        yield* Effect.forEach(
          requests,
          ({ position, priority, playerDistance }) => queueChunkLoad(position, priority, playerDistance),
          { concurrency: 'unbounded' }
        )
      })

    const processLoadQueue = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        while (true) {
          const currentState = yield* Ref.get(state)

          // 現在のアクティブロード数をチェック
          if (currentState.activeLoads.size >= currentState.config.maxConcurrentLoads) {
            yield* Effect.sleep('100 millis')
            continue
          }

          // キューからリクエストを取得
          const request = yield* Queue.take(currentState.loadQueue)
          const key = chunkLoadRequestToKey(request.position)

          // 仮実装: 単純な遅延でチャンクロードをシミュレート
          const loadFiber = yield* Effect.fork(
            Effect.gen(function* () {
              yield* Effect.sleep('100 millis') // 仮のロード時間
              // TODO: 実際のChunkを生成する実装
              return createChunk({
                position: request.position,
                blocks: new Uint16Array(98304),
                metadata: {
                  biome: 'plains',
                  lightLevel: 15,
                  isModified: false,
                  lastUpdate: getCurrentTimestamp(),
                  heightMap: Array.from(new Uint16Array(256)),
                },
                isDirty: false,
              })
            })
          )

          // アクティブロードに追加
          yield* Ref.update(state, (currentState) => ({
            ...currentState,
            activeLoads: new Map(currentState.activeLoads).set(key, loadFiber),
            loadStates: new Map(currentState.loadStates).set(key, {
              position: request.position,
              status: 'loading' as const,
              startTime: getCurrentTimestamp(),
            }),
          }))

          // ロード完了を監視
          yield* Effect.fork(
            Effect.gen(function* () {
              const result = yield* Fiber.await(loadFiber)

              yield* Ref.update(state, (currentState) => {
                const newActiveLoads = new Map(currentState.activeLoads)
                newActiveLoads.delete(key)

                const newLoadStates = new Map(currentState.loadStates)
                const currentLoadState = newLoadStates.get(key)

                return Exit.match(result, {
                  onSuccess: (chunk) => {
                    newLoadStates.set(key, {
                      position: request.position,
                      status: 'completed' as const,
                      startTime: currentLoadState?.startTime ?? getCurrentTimestamp(),
                      completedTime: getCurrentTimestamp(),
                      chunk,
                    })
                    return {
                      ...currentState,
                      activeLoads: newActiveLoads,
                      loadStates: newLoadStates,
                    }
                  },
                  onFailure: () => {
                    newLoadStates.set(key, {
                      position: request.position,
                      status: 'failed' as const,
                      startTime: currentLoadState?.startTime ?? getCurrentTimestamp(),
                      completedTime: getCurrentTimestamp(),
                      error: Exit.isFailure(result)
                        ? result.cause._tag === 'Fail'
                          ? result.cause.error
                          : undefined
                        : undefined,
                    })
                    return {
                      ...currentState,
                      activeLoads: newActiveLoads,
                      loadStates: newLoadStates,
                    }
                  },
                })
              })
            })
          )
        }
      })

    const startLoadProcessing = (): Effect.Effect<Fiber.RuntimeFiber<void, never>, never> =>
      Effect.gen(function* () {
        const currentFiber = yield* Ref.get(processingFiber)

        return yield* pipe(
          Option.fromNullable(currentFiber),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const newFiber = yield* Effect.fork(processLoadQueue())
                yield* Ref.set(processingFiber, newFiber)
                return newFiber
              }),
            onSome: (fiber) => Effect.succeed(fiber),
          })
        )
      })

    const stopLoadProcessing = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentFiber = yield* Ref.get(processingFiber)

        yield* pipe(
          Option.fromNullable(currentFiber),
          Option.match({
            onNone: () => Effect.succeed(undefined),
            onSome: (fiber) =>
              Effect.gen(function* () {
                yield* Fiber.interrupt(fiber)
                yield* Ref.set(processingFiber, null)
              }),
          })
        )
      })

    const getLoadState = (position: ChunkPosition): Effect.Effect<ChunkLoadState | null, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const key = chunkLoadRequestToKey(position)

        return yield* pipe(
          Option.fromNullable(currentState.loadStates.get(key)),
          Option.match({
            onNone: () => Effect.succeed(null),
            onSome: (state) => Effect.succeed(state),
          })
        )
      })

    const getActiveLoadCount = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return currentState.activeLoads.size
      })

    const getQueueSize = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return yield* Queue.size(currentState.loadQueue)
      })

    const cancelChunkLoad = (position: ChunkPosition): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const key = chunkLoadRequestToKey(position)
        const activeFiber = currentState.activeLoads.get(key)

        return yield* pipe(
          Option.fromNullable(activeFiber),
          Option.match({
            onNone: () => Effect.succeed(false),
            onSome: (fiber) =>
              Effect.gen(function* () {
                yield* Fiber.interrupt(fiber)
                yield* Ref.update(state, (currentState) => {
                  const newActiveLoads = new Map(currentState.activeLoads)
                  newActiveLoads.delete(key)

                  const newLoadStates = new Map(currentState.loadStates)
                  newLoadStates.delete(key)

                  return {
                    ...currentState,
                    activeLoads: newActiveLoads,
                    loadStates: newLoadStates,
                  }
                })
                return true
              }),
          })
        )
      })

    const cancelAllLoads = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)

        // 全てのアクティブロードをキャンセル
        yield* Effect.forEach(Array.from(currentState.activeLoads.values()), (fiber) => Fiber.interrupt(fiber), {
          concurrency: 'unbounded',
        })

        // 状態をクリア
        yield* Ref.update(state, (currentState) => ({
          ...currentState,
          activeLoads: new Map(),
          loadStates: new Map(),
        }))

        // キューをクリア
        yield* Queue.shutdown(currentState.loadQueue)
      })

    return {
      queueChunkLoad,
      queueChunkLoadBatch,
      startLoadProcessing,
      stopLoadProcessing,
      getLoadState,
      getActiveLoadCount,
      getQueueSize,
      cancelChunkLoad,
      cancelAllLoads,
    }
  })

// =============================================================================
// Helper Functions
// =============================================================================

const loadChunkWithTimeout = (
  request: ChunkLoadRequest,
  timeoutMs: number
): Effect.Effect<
  Chunk,
  GenerationError | { _tag: 'GenerationError'; position: ChunkPosition; reason: string; context: string },
  WorldGeneratorInterface
> =>
  Effect.gen(function* () {
    const worldGenerator = yield* WorldGeneratorTag

    // タイムアウト付きでチャンク生成
    const chunkGeneration = Effect.gen(function* () {
      const result = yield* worldGenerator.generateChunk(request.position)
      return createChunk(result.chunk)
    })

    return yield* Effect.timeout(chunkGeneration, `${timeoutMs} millis`).pipe(
      Effect.catchTag('TimeoutException', () =>
        Effect.fail({
          _tag: 'GenerationError' as const,
          position: request.position,
          reason: `Chunk generation timed out after ${timeoutMs}ms`,
          context: 'ChunkLoader.loadChunkWithTimeout',
        })
      )
    )
  })

// =============================================================================
// Layer Implementation
// =============================================================================

export const ChunkLoaderLive = (
  config: ChunkLoaderConfig = defaultChunkLoaderConfig
): Layer.Layer<ChunkLoader, never, never> => Layer.effect(ChunkLoader, createChunkLoader(config))
