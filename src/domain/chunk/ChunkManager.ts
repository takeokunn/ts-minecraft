/**
 * Chunk Manager Service Implementation
 * クラスを使わないEffect-TS Service/Layerパターン実装
 */

import { Context, Effect, Ref, Queue, Layer, Schema, Option, Match, pipe } from 'effect'
import type { ChunkPosition, Chunk } from './index'
import type { WorldGenerator, Vector3 } from '../world/index'

// =============================================================================
// Types & Schemas
// =============================================================================

export const ChunkManagerConfigSchema = Schema.Struct({
  maxLoadedChunks: Schema.Number.pipe(Schema.positive()),
  maxCachedChunks: Schema.Number.pipe(Schema.positive()),
  viewDistance: Schema.Number.pipe(Schema.positive()),
  loadConcurrency: Schema.Number.pipe(Schema.positive()),
})

export type ChunkManagerConfig = Schema.Schema.Type<typeof ChunkManagerConfigSchema>

export const defaultChunkManagerConfig: ChunkManagerConfig = {
  maxLoadedChunks: 441, // 21x21 (描画距離16)
  maxCachedChunks: 1000,
  viewDistance: 16,
  loadConcurrency: 4,
}

// LRUCache State Structure (非クラス実装)
export interface LRUCacheState<K, V> {
  readonly cache: Map<K, V>
  readonly accessOrder: K[]
  readonly maxSize: number
}

// ChunkManager State Structure
export interface ChunkManagerState {
  readonly loadedChunks: Map<string, Chunk>
  readonly cache: LRUCacheState<string, Chunk>
  readonly loadQueue: Queue.Queue<ChunkPosition>
  readonly loadingChunks: Set<string>
  readonly config: ChunkManagerConfig
}

// =============================================================================
// LRU Cache Operations (純粋関数実装)
// =============================================================================

export const createLRUCache = <K, V>(maxSize: number): LRUCacheState<K, V> => ({
  cache: new Map(),
  accessOrder: [],
  maxSize,
})

export const lruGet = <K, V>(cache: LRUCacheState<K, V>, key: K): [V | undefined, LRUCacheState<K, V>] =>
  pipe(
    Option.fromNullable(cache.cache.get(key)),
    Option.match({
      onNone: () => [undefined, cache] as [V | undefined, LRUCacheState<K, V>],
      onSome: (value) => {
        // アクセス順を更新（Immutableパターン）
        const newAccessOrder = cache.accessOrder.filter((k) => k !== key)
        newAccessOrder.push(key)

        return [
          value,
          {
            ...cache,
            accessOrder: newAccessOrder,
          },
        ] as [V | undefined, LRUCacheState<K, V>]
      },
    })
  )

export const lruPut = <K, V>(cache: LRUCacheState<K, V>, key: K, value: V): LRUCacheState<K, V> =>
  pipe(
    Match.value(cache.maxSize),
    Match.when(
      (size) => size === 0,
      () => ({
        ...cache,
        cache: new Map(),
        accessOrder: [],
      })
    ),
    Match.orElse(() => {
      const newCache = new Map(cache.cache)
      let newAccessOrder = [...cache.accessOrder]

      // 既存キーの場合は順序のみ更新
      pipe(
        Match.value({ hasKey: newCache.has(key), sizeExceeded: newCache.size >= cache.maxSize }),
        Match.when(
          ({ hasKey }) => hasKey,
          () => {
            newAccessOrder = newAccessOrder.filter((k) => k !== key)
          }
        ),
        Match.when(
          ({ hasKey, sizeExceeded }) => !hasKey && sizeExceeded,
          () => {
            // 容量超過の場合、最も古いエントリを削除
            const oldest = newAccessOrder.shift()
            pipe(
              Option.fromNullable(oldest),
              Option.match({
                onNone: () => {},
                onSome: (oldestKey) => newCache.delete(oldestKey),
              })
            )
          }
        ),
        Match.orElse(() => {})
      )

      newCache.set(key, value)
      newAccessOrder.push(key)

      return {
        ...cache,
        cache: newCache,
        accessOrder: newAccessOrder,
      }
    })
  )

// =============================================================================
// ChunkManager Service Interface
// =============================================================================

export interface ChunkManager {
  /**
   * チャンクを取得（ロード済み/キャッシュから）
   */
  readonly getChunk: (position: ChunkPosition) => Effect.Effect<Chunk | null, never>

  /**
   * プレイヤー周辺のチャンクをロード
   */
  readonly loadChunksAroundPlayer: (playerPosition: Vector3) => Effect.Effect<void, never>

  /**
   * 遠いチャンクをアンロード
   */
  readonly unloadDistantChunks: (centerPosition: Vector3) => Effect.Effect<void, never>

  /**
   * メモリ使用量を取得
   */
  readonly getMemoryUsage: () => Effect.Effect<number, never>

  /**
   * ロードされているチャンク数を取得
   */
  readonly getLoadedChunkCount: () => Effect.Effect<number, never>

  /**
   * キャッシュされているチャンク数を取得
   */
  readonly getCachedChunkCount: () => Effect.Effect<number, never>
}

export const ChunkManager = Context.GenericTag<ChunkManager>('ChunkManager')

// =============================================================================
// Utilities
// =============================================================================

export const chunkPositionToKey = (position: ChunkPosition): string => `${position.x},${position.z}`

export const worldToChunkPosition = (worldPos: Vector3): ChunkPosition => ({
  x: Math.floor(worldPos.x / 16),
  z: Math.floor(worldPos.z / 16),
})

export const chunkDistance = (pos1: ChunkPosition, pos2: ChunkPosition): number =>
  Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.z - pos2.z))

export const generateLoadOrder = (center: ChunkPosition, maxDistance: number): ChunkPosition[] => {
  const positions: ChunkPosition[] = []

  for (let distance = 0; distance <= maxDistance; distance++) {
    for (let x = -distance; x <= distance; x++) {
      for (let z = -distance; z <= distance; z++) {
        if (Math.abs(x) === distance || Math.abs(z) === distance) {
          positions.push({
            x: center.x + x,
            z: center.z + z,
          })
        }
      }
    }
  }

  return positions
}

// =============================================================================
// Service Implementation
// =============================================================================

export const createChunkManager = (
  config: ChunkManagerConfig = defaultChunkManagerConfig
): Effect.Effect<ChunkManager, never> =>
  Effect.gen(function* () {
    // State管理（Effect-TS Refパターン）
    const state = yield* Ref.make<ChunkManagerState>({
      loadedChunks: new Map(),
      cache: createLRUCache(config.maxCachedChunks),
      loadQueue: yield* Queue.unbounded<ChunkPosition>(),
      loadingChunks: new Set(
    }),
    config,
    })

    const getChunk = (position: ChunkPosition): Effect.Effect<Chunk | null, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const key = chunkPositionToKey(position)

        // ロード済みチェック
        const loaded = yield* pipe(
          Option.fromNullable(currentState.loadedChunks.get(key)),
          Option.match({
            onNone: () => Effect.succeed(null
    }),
    onSome: (chunk) => Effect.succeed(chunk),
          })
        )

        return yield* pipe(
          Option.fromNullable(loaded),
          Option.match({
            onNone: () => Effect.gen(function* () {
                // キャッシュチェック
                const [cached, newCache] = lruGet(currentState.cache, key)

                return yield* pipe(
                  Option.fromNullable(cached
    }),
    Option.match({
                    onNone: () => Effect.gen(function* () {
                        // ロードキューに追加
                        yield* Queue.offer(currentState.loadQueue, position)
                        return null
                      }),
                    onSome: (cachedChunk) =>
                      Effect.gen(function* () {
                        // キャッシュから復元してロード済みに移動
                        const newLoadedChunks = new Map(currentState.loadedChunks)
                        newLoadedChunks.set(key, cachedChunk)

                        yield* Ref.update(state, (currentState) => ({
                          ...currentState,
                          loadedChunks: newLoadedChunks,
                          cache: newCache,
                        }))

                        return cachedChunk
                      }),
                  })
                )
              }),
            onSome: (chunk) => Effect.succeed(chunk),
          })
        )
      })

    const loadChunksAroundPlayer = (playerPosition: Vector3): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const playerChunk = worldToChunkPosition(playerPosition)
        const loadOrder = generateLoadOrder(playerChunk, currentState.config.viewDistance)

        // 並列ロード（最大並列数制限）
        yield* Effect.forEach(loadOrder, (position) => loadChunkIfNeeded(position, state), {
          concurrency: currentState.config.loadConcurrency,
        })

        // 遠いチャンクのアンロード
        yield* unloadDistantChunks(playerPosition)
      })

    const unloadDistantChunks = (centerPosition: Vector3): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const centerChunk = worldToChunkPosition(centerPosition)
        const toUnload: string[] = []

        currentState.loadedChunks.forEach((chunk, key) => {
          const distance = chunkDistance(chunk.position, centerChunk)
          if (distance > currentState.config.viewDistance) {
            toUnload.push(key)
          }
        })

        if (toUnload.length > 0) {
          yield* Ref.update(state, (currentState) => {
            const newLoadedChunks = new Map(currentState.loadedChunks)
            let newCache = currentState.cache

            toUnload.forEach((key) => {
              const chunk = newLoadedChunks.get(key)
              if (chunk) {
                // キャッシュに移動
                newCache = lruPut(newCache, key, chunk)
                newLoadedChunks.delete(key)
              }
            })

            return {
              ...currentState,
              loadedChunks: newLoadedChunks,
              cache: newCache,
            }
          })
        }
      })

    const getMemoryUsage = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        let totalMemory = 0

        // ロード済みチャンクのメモリ使用量
        currentState.loadedChunks.forEach((chunk) => {
          totalMemory += chunk.getMemoryUsage()
        })

        // キャッシュされたチャンクのメモリ使用量
        currentState.cache.cache.forEach((chunk) => {
          totalMemory += chunk.getMemoryUsage()
        })

        return totalMemory
      })

    const getLoadedChunkCount = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return currentState.loadedChunks.size
      })

    const getCachedChunkCount = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return currentState.cache.cache.size
      })

    return {
      getChunk,
      loadChunksAroundPlayer,
      unloadDistantChunks,
      getMemoryUsage,
      getLoadedChunkCount,
      getCachedChunkCount,
    }
  })

// =============================================================================
// Helper Functions
// =============================================================================

const loadChunkIfNeeded = (position: ChunkPosition, stateRef: Ref.Ref<ChunkManagerState>): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(stateRef)
    const key = chunkPositionToKey(position)

    // 既にロード済みまたはロード中の場合はスキップ
    if (currentState.loadedChunks.has(key) || currentState.loadingChunks.has(key)) {
      return
    }

    // ロード中マークを追加
    yield* Ref.update(stateRef, (state) => ({
      ...state,
      loadingChunks: new Set([...state.loadingChunks, key]),
    }))

    try {
      // TODO: 実際のチャンク生成はWorldGeneratorと連携
      // const worldGenerator = yield* WorldGenerator
      // const chunkResult = yield* worldGenerator.generateChunk(position)
      // const chunk = chunkResult.chunk
      // 仮実装: 空のチャンクを作成
      // yield* Effect.logInfo(`Loading chunk at ${key}`)
    } finally {
      // ロード中マークを削除
      yield* Ref.update(stateRef, (state) => {
        const newLoadingChunks = new Set(state.loadingChunks)
        newLoadingChunks.delete(key)
        return {
          ...state,
          loadingChunks: newLoadingChunks,
        }
      })
    }
  })

// =============================================================================
// Layer Implementation
// =============================================================================

export const ChunkManagerLive = (
  config: ChunkManagerConfig = defaultChunkManagerConfig
): Layer.Layer<ChunkManager, never, never> => Layer.effect(ChunkManager, createChunkManager(config))
