import type { Brand } from 'effect'
import { Data, Effect, Schema } from 'effect'
import { DomainClock } from '../../shared/effect'
import type { ChunkMetadata } from '../value_object/chunk_metadata'
import type { ChunkPosition } from '../value_object/chunk_position'

/**
 * Chunk Domain Core Constants & ADT Types
 * チャンクドメインの基本定数とADT型定義
 */

// チャンクサイズ定数
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 384
export const CHUNK_MIN_Y = -64
export const CHUNK_MAX_Y = 319
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

// ===== Brand Types ===== //

/**
 * チャンクデータのバイト配列
 */
export type ChunkDataBytes = Uint8Array & Brand.Brand<'ChunkDataBytes'>

export const ChunkDataBytesSchema = Schema.instanceOf(Uint8Array).pipe(Schema.brand('ChunkDataBytes'))

/**
 * チャンクのロード進行度 (0-100)
 */
export type LoadProgress = number & Brand.Brand<'LoadProgress'>

export const LoadProgressSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand('LoadProgress')
)

/**
 * チャンクの変更セットID
 */
export type ChangeSetId = string & Brand.Brand<'ChangeSetId'>

export const ChangeSetIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('ChangeSetId'))

/**
 * リトライ回数
 */
export type RetryCount = number & Brand.Brand<'RetryCount'>

export const RetryCountSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('RetryCount'))

/**
 * number を RetryCount に変換（検証なし）
 *
 * 注意: 既に検証済みの値のみに使用すること
 */
export const makeUnsafeRetryCount = (count: number): RetryCount => count as RetryCount

/**
 * チャンクのタイムスタンプ
 */
export type ChunkTimestamp = number & Brand.Brand<'ChunkTimestamp'>

export const ChunkTimestampSchema = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('ChunkTimestamp'))

/**
 * number を ChunkTimestamp に変換（検証なし）
 *
 * 注意: 既に検証済みの値のみに使用すること
 */
export const makeUnsafeChunkTimestamp = (timestamp: number): ChunkTimestamp => timestamp as ChunkTimestamp

// ===== ADT Types ===== //

/**
 * チャンクの変更セット
 */
export interface ChangeSet {
  readonly id: ChangeSetId
  readonly blocks: ReadonlyArray<{
    readonly x: number
    readonly y: number
    readonly z: number
    readonly blockId: string
    readonly metadata?: unknown
  }>
  readonly timestamp: ChunkTimestamp
}

export const ChangeSetSchema = Schema.Struct({
  id: ChangeSetIdSchema,
  blocks: Schema.Array(
    Schema.Struct({
      x: Schema.Number.pipe(Schema.int()),
      y: Schema.Number.pipe(Schema.int()),
      z: Schema.Number.pipe(Schema.int()),
      blockId: Schema.String.pipe(Schema.minLength(1)),
      metadata: Schema.optional(Schema.Unknown),
    })
  ),
  timestamp: ChunkTimestampSchema,
})

/**
 * チャンクの状態 - Data.taggedEnum ADT
 */
export type ChunkState = Data.TaggedEnum<{
  /** チャンク未読み込み状態 */
  Unloaded: {}

  /** チャンク読み込み中状態 */
  Loading: {
    readonly progress: LoadProgress
    readonly startTime: ChunkTimestamp
  }

  /** チャンク読み込み完了状態 */
  Loaded: {
    readonly data: ChunkDataBytes
    readonly loadTime: ChunkTimestamp
    readonly metadata: ChunkMetadata
  }

  /** チャンク読み込み失敗状態 */
  Failed: {
    readonly error: string
    readonly retryCount: RetryCount
    readonly lastAttempt: ChunkTimestamp
  }

  /** チャンク変更済み状態（保存が必要） */
  Dirty: {
    readonly data: ChunkDataBytes
    readonly changes: ChangeSet
    readonly metadata: ChunkMetadata
  }

  /** チャンク保存中状態 */
  Saving: {
    readonly data: ChunkDataBytes
    readonly progress: LoadProgress
    readonly metadata: ChunkMetadata
  }

  /** チャンクキャッシュ状態 */
  Cached: {
    readonly data: ChunkDataBytes
    readonly cacheTime: ChunkTimestamp
    readonly metadata: ChunkMetadata
  }
}>

export const ChunkState = Data.taggedEnum<ChunkState>()

/**
 * チャンク操作 - Data.taggedEnum ADT
 */
export type ChunkOperation = Data.TaggedEnum<{
  /** チャンク読み込み操作 */
  Read: {
    readonly position: ChunkPosition
  }

  /** チャンク書き込み操作 */
  Write: {
    readonly position: ChunkPosition
    readonly data: ChunkDataBytes
    readonly metadata: ChunkMetadata
  }

  /** チャンク削除操作 */
  Delete: {
    readonly position: ChunkPosition
  }

  /** チャンク検証操作 */
  Validate: {
    readonly position: ChunkPosition
    readonly expectedChecksum?: string
  }

  /** チャンク最適化操作 */
  Optimize: {
    readonly position: ChunkPosition
    readonly strategy: OptimizationStrategy
  }

  /** チャンクシリアライゼーション操作 */
  Serialize: {
    readonly data: ChunkDataBytes
    readonly format: SerializationFormat
    readonly metadata: ChunkMetadata
  }
}>

export const ChunkOperation = Data.taggedEnum<ChunkOperation>()

/**
 * 最適化戦略
 */
export type OptimizationStrategy = Data.TaggedEnum<{
  /** メモリ使用量最適化 */
  Memory: {}
  /** 圧縮率最適化 */
  Compression: {}
  /** アクセス速度最適化 */
  Speed: {}
}>

export const OptimizationStrategy = Data.taggedEnum<OptimizationStrategy>()

/**
 * シリアライゼーション形式
 */
export type SerializationFormat = Data.TaggedEnum<{
  /** バイナリ形式 */
  Binary: {}
  /** JSON形式 */
  JSON: {}
  /** 圧縮形式 */
  Compressed: { readonly algorithm: string }
}>

export const SerializationFormat = Data.taggedEnum<SerializationFormat>()

/**
 * チャンクエラー階層 - Data.taggedEnum ADT
 */
export type ChunkError = Data.TaggedEnum<{
  /** バリデーションエラー */
  ValidationError: {
    readonly field: string
    readonly value: unknown
    readonly constraint: string
  }

  /** 境界エラー */
  BoundsError: {
    readonly coordinates: { readonly x: number; readonly y: number; readonly z: number }
    readonly bounds: { readonly min: number; readonly max: number }
  }

  /** シリアライゼーションエラー */
  SerializationError: {
    readonly format: string
    readonly originalError: unknown
  }

  /** データ破損エラー */
  CorruptionError: {
    readonly checksum: string
    readonly expected: string
  }

  /** タイムアウトエラー */
  TimeoutError: {
    readonly operation: string
    readonly duration: number
  }

  /** ネットワークエラー */
  NetworkError: {
    readonly url: string
    readonly status: number
  }
}>

export const ChunkError = Data.taggedEnum<ChunkError>()

// ===== ADT Factory Functions ===== //

/**
 * ChunkState ファクトリ関数
 */
export const ChunkStates = {
  unloaded: (): ChunkState => ChunkState.Unloaded({}),

  loading: (progress: LoadProgress): ChunkState =>
    ChunkState.Loading({
      progress,
      startTime: makeUnsafeChunkTimestamp(0),
    }),

  loaded: (data: ChunkDataBytes, metadata: ChunkMetadata): ChunkState =>
    ChunkState.Loaded({
      data,
      loadTime: makeUnsafeChunkTimestamp(0),
      metadata,
    }),

  failed: (error: string, retryCount: RetryCount = makeUnsafeRetryCount(0)): ChunkState =>
    ChunkState.Failed({
      error,
      retryCount,
      lastAttempt: makeUnsafeChunkTimestamp(0),
    }),

  dirty: (data: ChunkDataBytes, changes: ChangeSet, metadata: ChunkMetadata): ChunkState =>
    ChunkState.Dirty({
      data,
      changes,
      metadata,
    }),

  saving: (data: ChunkDataBytes, progress: LoadProgress, metadata: ChunkMetadata): ChunkState =>
    ChunkState.Saving({
      data,
      progress,
      metadata,
    }),

  cached: (data: ChunkDataBytes, metadata: ChunkMetadata): ChunkState =>
    ChunkState.Cached({
      data,
      cacheTime: makeUnsafeChunkTimestamp(0),
      metadata,
    }),
} as const

export const ChunkStatesEffect = {
  loading: (progress: LoadProgress) =>
    Effect.gen(function* () {
      const clock = yield* Effect.service(DomainClock)
      const epochMillis = yield* clock.now()
      const startTime = yield* Schema.decode(ChunkTimestampSchema)(epochMillis)
      return ChunkState.Loading({ progress, startTime })
    }),

  loaded: (data: ChunkDataBytes, metadata: ChunkMetadata) =>
    Effect.gen(function* () {
      const clock = yield* Effect.service(DomainClock)
      const epochMillis = yield* clock.now()
      const loadTime = yield* Schema.decode(ChunkTimestampSchema)(epochMillis)
      return ChunkState.Loaded({ data, loadTime, metadata })
    }),

  failed: (error: string, retryCount = 0) =>
    Effect.gen(function* () {
      const clock = yield* Effect.service(DomainClock)
      const epochMillis = yield* clock.now()
      const lastAttempt = yield* Schema.decode(ChunkTimestampSchema)(epochMillis)
      const safeRetryCount = yield* Schema.decode(RetryCountSchema)(retryCount)
      return ChunkState.Failed({ error, retryCount: safeRetryCount, lastAttempt })
    }),

  dirty: (data: ChunkDataBytes, changes: ChangeSet, metadata: ChunkMetadata) =>
    Effect.succeed(ChunkStates.dirty(data, changes, metadata)),

  saving: (data: ChunkDataBytes, progress: LoadProgress, metadata: ChunkMetadata) =>
    Effect.succeed(ChunkStates.saving(data, progress, metadata)),

  cached: (data: ChunkDataBytes, metadata: ChunkMetadata) =>
    Effect.gen(function* () {
      const clock = yield* Effect.service(DomainClock)
      const epochMillis = yield* clock.now()
      const cacheTime = yield* Schema.decode(ChunkTimestampSchema)(epochMillis)
      return ChunkState.Cached({ data, cacheTime, metadata })
    }),
} as const

/**
 * ChunkOperation ファクトリ関数
 */
export const ChunkOperations = {
  read: (position: ChunkPosition): ChunkOperation => ChunkOperation.Read({ position }),

  write: (position: ChunkPosition, data: ChunkDataBytes, metadata: ChunkMetadata): ChunkOperation =>
    ChunkOperation.Write({ position, data, metadata }),

  delete: (position: ChunkPosition): ChunkOperation => ChunkOperation.Delete({ position }),

  validate: (position: ChunkPosition, expectedChecksum?: string): ChunkOperation =>
    ChunkOperation.Validate({ position, expectedChecksum }),

  optimize: (position: ChunkPosition, strategy: OptimizationStrategy): ChunkOperation =>
    ChunkOperation.Optimize({ position, strategy }),

  serialize: (data: ChunkDataBytes, format: SerializationFormat, metadata: ChunkMetadata): ChunkOperation =>
    ChunkOperation.Serialize({ data, format, metadata }),
} as const

/**
 * ChunkError ファクトリ関数
 */
export const ChunkErrors = {
  validation: (field: string, value: unknown, constraint: string): ChunkError =>
    ChunkError.ValidationError({ field, value, constraint }),

  bounds: (coordinates: { x: number; y: number; z: number }, bounds: { min: number; max: number }): ChunkError =>
    ChunkError.BoundsError({ coordinates, bounds }),

  serialization: (format: string, originalError: unknown): ChunkError =>
    ChunkError.SerializationError({ format, originalError }),

  corruption: (checksum: string, expected: string): ChunkError => ChunkError.CorruptionError({ checksum, expected }),

  timeout: (operation: string, duration: number): ChunkError => ChunkError.TimeoutError({ operation, duration }),

  network: (url: string, status: number): ChunkError => ChunkError.NetworkError({ url, status }),
} as const
