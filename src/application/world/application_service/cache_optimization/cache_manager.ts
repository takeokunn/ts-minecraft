import { Clock, Context, Effect, Layer, Match, Option, ReadonlyArray, Ref, Schema, pipe } from 'effect'

/**
 * Cache Manager Service
 *
 * 多階層キャッシュシステムの統合管理を行います。
 * LRU、LFU、TTLアルゴリズムを組み合わせた高度なキャッシュ戦略を提供します。
 */

// === Cache Strategy Types ===

export const CacheStrategy = Schema.Union(
  Schema.Literal('lru'), // Least Recently Used
  Schema.Literal('lfu'), // Least Frequently Used
  Schema.Literal('ttl'), // Time To Live
  Schema.Literal('adaptive'), // 適応的戦略
  Schema.Literal('hybrid') // ハイブリッド戦略
)

export const CacheEntry = Schema.Struct({
  _tag: Schema.Literal('CacheEntry'),
  key: Schema.String,
  value: Schema.Unknown,
  size: Schema.Number.pipe(Schema.positive()),
  createdAt: Schema.Number,
  lastAccessedAt: Schema.Number,
  accessCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  ttl: Schema.optional(Schema.Number.pipe(Schema.positive())),
  priority: Schema.Number.pipe(Schema.between(0, 1)),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})

export const CacheLayer = Schema.Struct({
  _tag: Schema.Literal('CacheLayer'),
  layerId: Schema.String,
  layerType: Schema.Union(
    Schema.Literal('l1_memory'), // L1メモリキャッシュ
    Schema.Literal('l2_memory'), // L2メモリキャッシュ
    Schema.Literal('l3_disk'), // L3ディスクキャッシュ
    Schema.Literal('network') // ネットワークキャッシュ
  ),
  maxSize: Schema.Number.pipe(Schema.positive()),
  currentSize: Schema.Number.pipe(Schema.nonNegativeInteger()),
  entryCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  strategy: CacheStrategy,
  hitRate: Schema.Number.pipe(Schema.between(0, 1)),
  compressionEnabled: Schema.Boolean,
  encryptionEnabled: Schema.Boolean,
})

export const CacheConfiguration = Schema.Struct({
  _tag: Schema.Literal('CacheConfiguration'),
  layers: Schema.Array(CacheLayer),
  globalStrategy: CacheStrategy,
  evictionPolicy: Schema.Struct({
    memoryPressureThreshold: Schema.Number.pipe(Schema.between(0, 1)),
    aggressiveEvictionEnabled: Schema.Boolean,
    preemptiveEvictionEnabled: Schema.Boolean,
  }),
  compression: Schema.Struct({
    enabled: Schema.Boolean,
    algorithm: Schema.Union(Schema.Literal('gzip'), Schema.Literal('lz4'), Schema.Literal('brotli')),
    threshold: Schema.Number.pipe(Schema.positive()), // 圧縮開始サイズ
  }),
  persistence: Schema.Struct({
    enabled: Schema.Boolean,
    syncInterval: Schema.Number.pipe(Schema.positive()),
    backupEnabled: Schema.Boolean,
  }),
})

// === Cache Statistics ===

export const CacheStatistics = Schema.Struct({
  _tag: Schema.Literal('CacheStatistics'),
  totalHits: Schema.Number.pipe(Schema.nonNegativeInteger()),
  totalMisses: Schema.Number.pipe(Schema.nonNegativeInteger()),
  hitRate: Schema.Number.pipe(Schema.between(0, 1)),
  layerStatistics: Schema.Record(
    Schema.String,
    Schema.Struct({
      hits: Schema.Number.pipe(Schema.nonNegativeInteger()),
      misses: Schema.Number.pipe(Schema.nonNegativeInteger()),
      evictions: Schema.Number.pipe(Schema.nonNegativeInteger()),
      size: Schema.Number.pipe(Schema.nonNegativeInteger()),
    })
  ),
  evictionCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  compressionRatio: Schema.Number.pipe(Schema.positive()),
  averageAccessTime: Schema.Number.pipe(Schema.positive()),
})

// === Cache Manager Error ===

export const CacheManagerError = Schema.TaggedError<CacheManagerErrorType>()('CacheManagerError', {
  message: Schema.String,
  managerId: Schema.String,
  operation: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export interface CacheManagerErrorType extends Schema.Schema.Type<typeof CacheManagerError> {}

// === Service Interface ===

export interface CacheManagerService {
  /**
   * キャッシュエントリを取得します
   */
  readonly get: <T>(
    key: string,
    validator?: (value: unknown) => value is T
  ) => Effect.Effect<Option.Option<T>, CacheManagerErrorType>

  /**
   * キャッシュエントリを設定します
   */
  readonly set: (
    key: string,
    value: unknown,
    options?: {
      ttl?: number
      priority?: number
      layer?: string
    }
  ) => Effect.Effect<void, CacheManagerErrorType>

  /**
   * キャッシュエントリを削除します
   */
  readonly delete: (key: string) => Effect.Effect<boolean, CacheManagerErrorType>

  /**
   * キャッシュをクリアします
   */
  readonly clear: (layerId?: string) => Effect.Effect<void, CacheManagerErrorType>

  /**
   * 手動でエビクションを実行します
   */
  readonly evict: (strategy?: CacheStrategy, targetSize?: number) => Effect.Effect<number, CacheManagerErrorType> // 削除されたエントリ数

  /**
   * キャッシュを最適化します
   */
  readonly optimize: () => Effect.Effect<void, CacheManagerErrorType>

  /**
   * キャッシュ統計を取得します
   */
  readonly getStatistics: () => Effect.Effect<Schema.Schema.Type<typeof CacheStatistics>, CacheManagerErrorType>

  /**
   * キャッシュサイズを取得します
   */
  readonly getSize: (layerId?: string) => Effect.Effect<number, CacheManagerErrorType>

  /**
   * キャッシュエントリが存在するかチェックします
   */
  readonly has: (key: string) => Effect.Effect<boolean, CacheManagerErrorType>

  /**
   * 複数のキーを一括取得します
   */
  readonly getMultiple: <T>(
    keys: string[],
    validator?: (value: unknown) => value is T
  ) => Effect.Effect<Map<string, T>, CacheManagerErrorType>

  /**
   * 複数のエントリを一括設定します
   */
  readonly setMultiple: (
    entries: Array<{ key: string; value: unknown; options?: any }>
  ) => Effect.Effect<void, CacheManagerErrorType>

  /**
   * キャッシュ設定を更新します
   */
  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof CacheConfiguration>>
  ) => Effect.Effect<void, CacheManagerErrorType>
}

// === Live Implementation ===

const makeCacheManagerService = Effect.gen(function* () {
  // 内部状態管理
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof CacheConfiguration>>(DEFAULT_CACHE_CONFIG)
  const cacheEntries = yield* Ref.make<Map<string, Schema.Schema.Type<typeof CacheEntry>>>(new Map())
  const layerStats = yield* Ref.make<Map<string, { hits: number; misses: number; evictions: number }>>(new Map())
  const globalStats = yield* Ref.make<{ totalHits: number; totalMisses: number; totalEvictions: number }>({
    totalHits: 0,
    totalMisses: 0,
    totalEvictions: 0,
  })

  const get = <T>(key: string, validator?: (value: unknown) => value is T) =>
    Effect.gen(function* () {
      const entries = yield* Ref.get(cacheEntries)
      const now = yield* Clock.currentTimeMillis

      return yield* pipe(
        Option.fromNullable(entries.get(key)),
        Option.filter((entry) => !entry.ttl || now - entry.createdAt <= entry.ttl),
        Option.filter((entry) => !validator || validator(entry.value)),
        Option.match({
          onNone: () =>
            Effect.gen(function* () {
              yield* recordMiss()
              return Option.none<T>()
            }),
          onSome: (entry) =>
            Effect.gen(function* () {
              // アクセス記録更新
              const updatedEntry = {
                ...entry,
                lastAccessedAt: yield* Clock.currentTimeMillis,
                accessCount: entry.accessCount + 1,
              }

              yield* Ref.update(cacheEntries, (map) => map.set(key, updatedEntry))
              yield* recordHit()

              return Option.some(entry.value as T)
            }),
        })
      )
    })

  const set = (key: string, value: unknown, options?: { ttl?: number; priority?: number; layer?: string }) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      const now = yield* Clock.currentTimeMillis

      const entry: Schema.Schema.Type<typeof CacheEntry> = {
        _tag: 'CacheEntry',
        key,
        value,
        size: estimateSize(value),
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        ttl: options?.ttl,
        priority: options?.priority || 0.5,
        metadata: { layer: options?.layer || 'l1_memory' },
      }

      // サイズチェックと必要に応じてエビクション（Effect.when利用）
      const currentSize = yield* calculateTotalSize()
      const maxSize = config.layers.reduce((sum, layer) => sum + layer.maxSize, 0)

      yield* Effect.when(currentSize + entry.size > maxSize, () => evictToMakeSpace(entry.size))

      yield* Ref.update(cacheEntries, (map) => map.set(key, entry))
      yield* Effect.logDebug(`キャッシュエントリ設定: ${key} (${entry.size}バイト)`)
    })

  const deleteInternal = (key: string) =>
    Effect.gen(function* () {
      const deleted = yield* Ref.modify(cacheEntries, (map) => {
        const hadKey = map.has(key)
        map.delete(key)
        return [hadKey, map]
      })

      return deleted
    })

  const clear = (layerId?: string) =>
    Effect.gen(function* () {
      yield* pipe(
        Option.fromNullable(layerId),
        Option.match({
          onNone: () =>
            Effect.gen(function* () {
              yield* Ref.set(cacheEntries, new Map())
              yield* Effect.logInfo('全キャッシュクリア')
            }),
          onSome: (id) =>
            Effect.gen(function* () {
              // Map.entries() iterationのfor-if撲滅 → filter
              yield* Ref.update(cacheEntries, (map) => {
                const keysToDelete = pipe(
                  Array.from(map.entries()),
                  ReadonlyArray.filter(([, entry]) => entry.metadata.layer === id),
                  ReadonlyArray.map(([key]) => key)
                )
                keysToDelete.forEach((key) => map.delete(key))
                return map
              })
              yield* Effect.logInfo(`キャッシュレイヤークリア: ${id}`)
            }),
        })
      )
    })

  const evict = (strategy: CacheStrategy = 'lru', targetSize?: number) =>
    Effect.gen(function* () {
      const entries = yield* Ref.get(cacheEntries)
      const entriesArray = Array.from(entries.values())

      if (entriesArray.length === 0) return 0

      const evictionCandidates = yield* selectEvictionCandidates(entriesArray, strategy)
      const currentSize = yield* calculateTotalSize()
      const targetSizeActual = targetSize || Math.floor(currentSize * 0.8) // 20%削減がデフォルト

      // for-of + if-break撲滅 → Effect.reduce (早期終了付き)
      const { evictedCount, freedSize } = yield* pipe(
        evictionCandidates,
        Effect.reduce({ evictedCount: 0, freedSize: 0 }, (acc, candidate) =>
          Effect.gen(function* () {
            // 早期終了条件
            yield* Effect.when(currentSize - acc.freedSize <= targetSizeActual, () => Effect.succeed(acc))

            yield* deleteInternal(candidate.key)
            return {
              evictedCount: acc.evictedCount + 1,
              freedSize: acc.freedSize + candidate.size,
            }
          }).pipe(Effect.catchAll(() => Effect.succeed(acc)))
        )
      )

      yield* Ref.update(globalStats, (stats) => ({
        ...stats,
        totalEvictions: stats.totalEvictions + evictedCount,
      }))

      yield* Effect.logInfo(`エビクション完了: ${evictedCount}エントリ, ${freedSize}バイト解放`)
      return evictedCount
    })

  const optimize = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('キャッシュ最適化開始')

      // 期限切れエントリの削除（for-of撲滅 → Effect.reduce）
      const now = yield* Clock.currentTimeMillis
      const entries = yield* Ref.get(cacheEntries)

      const expiredCount = yield* pipe(
        Array.from(entries.entries()),
        Effect.reduce(0, (count, [key, entry]) =>
          pipe(
            Option.fromNullable(entry.ttl),
            Option.filter((ttl) => now - entry.createdAt > ttl),
            Option.match({
              onNone: () => Effect.succeed(count),
              onSome: () =>
                Effect.gen(function* () {
                  yield* deleteInternal(key)
                  return count + 1
                }),
            })
          )
        )
      )

      // 統計リセット（必要に応じて）
      // 圧縮実行（設定に応じて）→ Effect.when利用
      const config = yield* Ref.get(configuration)
      yield* Effect.when(config.compression.enabled, () => compressLargeEntries())

      yield* Effect.logInfo(`最適化完了: 期限切れ${expiredCount}エントリ削除`)
    })

  const getStatistics = () =>
    Effect.gen(function* () {
      const stats = yield* Ref.get(globalStats)
      const layerStatsMap = yield* Ref.get(layerStats)
      const entries = yield* Ref.get(cacheEntries)

      const totalRequests = stats.totalHits + stats.totalMisses
      const hitRate = totalRequests > 0 ? stats.totalHits / totalRequests : 0

      const statistics: Schema.Schema.Type<typeof CacheStatistics> = {
        _tag: 'CacheStatistics',
        totalHits: stats.totalHits,
        totalMisses: stats.totalMisses,
        hitRate,
        layerStatistics: Object.fromEntries(
          Array.from(layerStatsMap.entries()).map(([layerId, layerStat]) => [
            layerId,
            { ...layerStat, size: 0 }, // 実際のサイズ計算
          ])
        ),
        evictionCount: stats.totalEvictions,
        compressionRatio: 1.0, // 実際の圧縮率計算
        averageAccessTime: 5.0, // 実際の平均アクセス時間
      }

      return statistics
    })

  const getSize = (layerId?: string) =>
    Effect.gen(function* () {
      const entries = yield* Ref.get(cacheEntries)

      return yield* pipe(
        Option.fromNullable(layerId),
        Option.match({
          onNone: () => calculateTotalSize(),
          onSome: (id) =>
            // entries.values() iterationのfor-of撲滅 → reduce
            Effect.sync(() =>
              pipe(
                Array.from(entries.values()),
                ReadonlyArray.filter((entry) => entry.metadata.layer === id),
                ReadonlyArray.reduce(0, (size, entry) => size + entry.size)
              )
            ),
        })
      )
    })

  const has = (key: string) =>
    Effect.gen(function* () {
      const entries = yield* Ref.get(cacheEntries)
      return entries.has(key)
    })

  const getMultiple = <T>(keys: string[], validator?: (value: unknown) => value is T) =>
    Effect.gen(function* () {
      // keysのfor-of撲滅 → Effect.reduce
      const results = yield* pipe(
        keys,
        Effect.reduce(new Map<string, T>(), (acc, key) =>
          Effect.gen(function* () {
            const value = yield* get<T>(key, validator)
            yield* pipe(
              value,
              Option.match({
                onNone: () => Effect.void,
                onSome: (v) =>
                  Effect.sync(() => {
                    acc.set(key, v)
                  }),
              })
            )
            return acc
          })
        )
      )

      return results
    })

  const setMultiple = (entries: Array<{ key: string; value: unknown; options?: any }>) =>
    Effect.gen(function* () {
      // for-of撲滅 → Effect.forEach
      yield* pipe(
        entries,
        Effect.forEach((entry) => set(entry.key, entry.value, entry.options))
      )
    })

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof CacheConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, (current) => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('キャッシュ設定更新完了')
    })

  // === Helper Functions ===

  const recordHit = () => Ref.update(globalStats, (stats) => ({ ...stats, totalHits: stats.totalHits + 1 }))

  const recordMiss = () => Ref.update(globalStats, (stats) => ({ ...stats, totalMisses: stats.totalMisses + 1 }))

  const calculateTotalSize = () =>
    Effect.gen(function* () {
      const entries = yield* Ref.get(cacheEntries)
      return Array.from(entries.values()).reduce((sum, entry) => sum + entry.size, 0)
    })

  const evictToMakeSpace = (requiredSize: number) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      yield* evict(config.globalStrategy, requiredSize)
    })

  const selectEvictionCandidates = (entries: Schema.Schema.Type<typeof CacheEntry>[], strategy: CacheStrategy) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return Match.value(strategy).pipe(
        Match.when('lru', () => [...entries].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)),
        Match.when('lfu', () => [...entries].sort((a, b) => a.accessCount - b.accessCount)),
        Match.when('ttl', () => [...entries].filter((e) => e.ttl).sort((a, b) => a.createdAt - b.createdAt)),
        Match.when('adaptive', () => {
          // 複合スコアによる選択
          return [...entries].sort((a, b) => {
            const scoreA = calculateEvictionScore(a, now)
            const scoreB = calculateEvictionScore(b, now)
            return scoreA - scoreB
          })
        }),
        Match.when('hybrid', () => {
          // LRU + 使用頻度の組み合わせ
          return [...entries].sort((a, b) => {
            const scoreA = (now - a.lastAccessedAt) / a.accessCount
            const scoreB = (now - b.lastAccessedAt) / b.accessCount
            return scoreB - scoreA
          })
        }),
        Match.exhaustive
      )
    })

  const calculateEvictionScore = (entry: Schema.Schema.Type<typeof CacheEntry>, now: number) => {
    const ageWeight = 0.3
    const accessWeight = 0.4
    const sizeWeight = 0.2
    const priorityWeight = 0.1

    const age = now - entry.lastAccessedAt
    const normalizedAge = Math.min(age / (24 * 60 * 60 * 1000), 1) // 24時間で正規化

    const accessScore = 1 / (entry.accessCount + 1)
    const sizeScore = entry.size / (1024 * 1024) // MBで正規化
    const priorityScore = 1 - entry.priority

    return (
      normalizedAge * ageWeight + accessScore * accessWeight + sizeScore * sizeWeight + priorityScore * priorityWeight
    )
  }

  const compressLargeEntries = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      const entries = yield* Ref.get(cacheEntries)

      // Map.entries() iterationのfor-of撲滅 → Effect.reduce
      const compressedCount = yield* pipe(
        Array.from(entries.entries()),
        Effect.reduce(0, (count, [key, entry]) =>
          pipe(
            entry,
            Option.some,
            Option.filter((e) => e.size >= config.compression.threshold && !e.metadata.compressed),
            Option.match({
              onNone: () => Effect.succeed(count),
              onSome: (e) =>
                Effect.sync(() => {
                  // 圧縮実行（簡略化）
                  const compressedEntry = {
                    ...e,
                    size: Math.floor(e.size * 0.7), // 30%圧縮と仮定
                    metadata: { ...e.metadata, compressed: true },
                  }

                  entries.set(key, compressedEntry)
                  return count + 1
                }),
            })
          )
        )
      )

      yield* Effect.logInfo(`圧縮完了: ${compressedCount}エントリ`)
    })

  // 型判定if-else-if → 三項演算子チェーン
  const estimateSize = (value: unknown): number =>
    typeof value === 'string'
      ? value.length * 2 // UTF-16
      : typeof value === 'object' && value !== null
        ? JSON.stringify(value).length * 2
        : 8 // プリミティブ型のデフォルト

  return CacheManagerService.of({
    get,
    set,
    delete: deleteInternal,
    clear,
    evict,
    optimize,
    getStatistics,
    getSize,
    has,
    getMultiple,
    setMultiple,
    updateConfiguration,
  })
})

// === Context Tag ===

export const CacheManagerService = Context.GenericTag<CacheManagerService>(
  '@minecraft/domain/world/CacheManagerService'
)

// === Layer ===

export const CacheManagerServiceLive = Layer.effect(CacheManagerService, makeCacheManagerService)

// === Default Configuration ===

export const DEFAULT_CACHE_CONFIG: Schema.Schema.Type<typeof CacheConfiguration> = {
  _tag: 'CacheConfiguration',
  layers: [
    {
      _tag: 'CacheLayer',
      layerId: 'l1_memory',
      layerType: 'l1_memory',
      maxSize: 256 * 1024 * 1024, // 256MB
      currentSize: 0,
      entryCount: 0,
      strategy: 'lru',
      hitRate: 0,
      compressionEnabled: false,
      encryptionEnabled: false,
    },
    {
      _tag: 'CacheLayer',
      layerId: 'l2_memory',
      layerType: 'l2_memory',
      maxSize: 512 * 1024 * 1024, // 512MB
      currentSize: 0,
      entryCount: 0,
      strategy: 'lfu',
      hitRate: 0,
      compressionEnabled: true,
      encryptionEnabled: false,
    },
  ],
  globalStrategy: 'hybrid',
  evictionPolicy: {
    memoryPressureThreshold: 0.8,
    aggressiveEvictionEnabled: true,
    preemptiveEvictionEnabled: true,
  },
  compression: {
    enabled: true,
    algorithm: 'lz4',
    threshold: 1024, // 1KB以上で圧縮
  },
  persistence: {
    enabled: true,
    syncInterval: 30000, // 30秒
    backupEnabled: true,
  },
}

export type {
  CacheConfiguration as CacheConfigurationType,
  CacheEntry as CacheEntryType,
  CacheLayer as CacheLayerType,
  CacheStatistics as CacheStatisticsType,
} from './cache_manager'
