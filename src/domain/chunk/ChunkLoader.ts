/**
 * Chunk Loader Service Implementation
 * 非同期チャンクロード・優先度管理（クラス使用禁止）
 */

import { Context, Effect, Ref, Queue, Fiber, Schema, Layer, Exit } from 'effect'
import type { ChunkPosition, Chunk } from './index.js'
import type { WorldGenerator, GenerationError } from '../world/index.js'

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

export const calculatePriorityScore = (
  request: ChunkLoadRequest,
  config: ChunkLoaderConfig
): number => {
  const baseScore = config.priorityWeights[request.priority]
  const distancePenalty = request.playerDistance * 0.1
  const agePenalty = (Date.now() - request.timestamp) * 0.001

  return baseScore - distancePenalty - agePenalty
}

export const sortRequestsByPriority = (
  requests: ChunkLoadRequest[],
  config: ChunkLoaderConfig
): ChunkLoadRequest[] =>
  requests
    .map(request => ({
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
  timestamp: Date.now(),
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

// WorldGeneratorのContext Tag（既存のものを参照）
const WorldGeneratorTag = Context.GenericTag<WorldGenerator>('WorldGenerator')

// =============================================================================
// Utilities
// =============================================================================

export const chunkLoadRequestToKey = (position: ChunkPosition): string =>
  `${position.x},${position.z}`

export const isLoadExpired = (
  state: ChunkLoadState,
  timeoutMs: number
): boolean => {
  if (!state.startTime) return false
  return (Date.now() - state.startTime) > timeoutMs
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
        const existing = currentState.loadStates.get(key)
        if (existing && (existing.status === 'loading' || existing.status === 'completed')) {
          return
        }

        const request = createChunkLoadRequest(position, priority, playerDistance)

        // キューに追加を試行
        const added = yield* Queue.offer(currentState.loadQueue, request)
        if (added) {
          // ロード状態を更新
          yield* Ref.update(state, currentState => ({
            ...currentState,
            loadStates: new Map(currentState.loadStates).set(key, {
              position,
              status: 'queued' as const,
            }),
          }))
        }
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
          ({ position, priority, playerDistance }) =>
            queueChunkLoad(position, priority, playerDistance),
          { concurrency: 'unbounded' }
        )
      })

    const processLoadQueue = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)

        while (true) {
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
              return {
                position: request.position,
                blocks: new Uint16Array(98304),
                metadata: {
                  version: 1,
                  lastUpdate: Date.now(),
                  isGenerated: true,
                  biomeIds: new Uint8Array(256),
                  heightMap: new Uint16Array(256),
                },
                isDirty: false,
              } as Chunk
            })
          )

          // アクティブロードに追加
          yield* Ref.update(state, currentState => ({
            ...currentState,
            activeLoads: new Map(currentState.activeLoads).set(key, loadFiber),
            loadStates: new Map(currentState.loadStates).set(key, {
              position: request.position,
              status: 'loading' as const,
              startTime: Date.now(),
            }),
          }))

          // ロード完了を監視
          yield* Effect.fork(
            Effect.gen(function* () {
              const result = yield* Fiber.await(loadFiber)

              yield* Ref.update(state, currentState => {
                const newActiveLoads = new Map(currentState.activeLoads)
                newActiveLoads.delete(key)

                const newLoadStates = new Map(currentState.loadStates)
                const currentLoadState = newLoadStates.get(key)

                if (Exit.isSuccess(result)) {
                  newLoadStates.set(key, {
                    position: request.position,
                    status: 'completed' as const,
                    startTime: currentLoadState?.startTime ?? Date.now(),
                    completedTime: Date.now(),
                    chunk: result.value,
                  })
                } else {
                  newLoadStates.set(key, {
                    position: request.position,
                    status: 'failed' as const,
                    startTime: currentLoadState?.startTime ?? Date.now(),
                    completedTime: Date.now(),
                    error: Exit.isFailure(result) ? result.cause._tag === 'Fail' ? result.cause.error : undefined : undefined,
                  })
                }

                return {
                  ...currentState,
                  activeLoads: newActiveLoads,
                  loadStates: newLoadStates,
                }
              })
            })
          )
        }
      })

    const startLoadProcessing = (): Effect.Effect<Fiber.RuntimeFiber<void, never>, never> =>
      Effect.gen(function* () {
        const currentFiber = yield* Ref.get(processingFiber)
        if (currentFiber) {
          return currentFiber
        }

        const newFiber = yield* Effect.fork(processLoadQueue())
        yield* Ref.set(processingFiber, newFiber)
        return newFiber
      })

    const stopLoadProcessing = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentFiber = yield* Ref.get(processingFiber)
        if (currentFiber) {
          yield* Fiber.interrupt(currentFiber)
          yield* Ref.set(processingFiber, null)
        }
      })

    const getLoadState = (position: ChunkPosition): Effect.Effect<ChunkLoadState | null, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const key = chunkLoadRequestToKey(position)
        return currentState.loadStates.get(key) ?? null
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

        if (activeFiber) {
          yield* Fiber.interrupt(activeFiber)
          yield* Ref.update(state, currentState => {
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
        }

        return false
      })

    const cancelAllLoads = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)

        // 全てのアクティブロードをキャンセル
        yield* Effect.forEach(
          Array.from(currentState.activeLoads.values()),
          fiber => Fiber.interrupt(fiber),
          { concurrency: 'unbounded' }
        )

        // 状態をクリア
        yield* Ref.update(state, currentState => ({
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
): Effect.Effect<Chunk, GenerationError, WorldGenerator> =>
  Effect.gen(function* () {
    const worldGenerator = yield* WorldGeneratorTag

    // タイムアウト付きでチャンク生成
    const chunkGeneration = Effect.gen(function* () {
      const result = yield* worldGenerator.generateChunk(request.position)
      return result.chunk
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
): Layer.Layer<ChunkLoader, never, never> =>
  Layer.effect(ChunkLoader, createChunkLoader(config))