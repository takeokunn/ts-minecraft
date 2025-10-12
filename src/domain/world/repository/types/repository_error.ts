/**
 * @fileoverview World Repository Error Types
 * ワールドドメインRepository層のエラー型定義
 *
 * DDD Repository Pattern に基づく包括的エラーハンドリング
 * Effect-TS 3.17+ の Schema.TaggedStruct による構造化エラー
 */

import {
  GenerationSessionIdSchema,
  type GenerationSessionId,
} from '@/domain/world_generation/aggregate/generation_session'
import { BiomeIdSchema, WorldIdSchema, type BiomeId, type WorldId } from '@domain/world/types/core'
import { ErrorCauseSchema, toErrorCause } from '@shared/schema/error'
import type { JsonValue } from '@shared/schema/json'
import { JsonValueSchema } from '@shared/schema/json'
import { DateTime, Effect, Match, Schema } from 'effect'

// === Core Repository Errors ===

/**
 * Repository操作の基底エラー
 */
export const RepositoryErrorSchema = Schema.TaggedStruct('RepositoryError', {
  message: Schema.String,
  cause: Schema.optional(ErrorCauseSchema),
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
  operation: Schema.String,
})
export type RepositoryError = Schema.Schema.Type<typeof RepositoryErrorSchema>

/**
 * 永続化層エラー
 */
export const PersistenceErrorSchema = Schema.TaggedStruct('PersistenceError', {
  message: Schema.String,
  storageType: Schema.Literal('memory', 'indexeddb', 'filesystem', 'database'),
  cause: Schema.optional(ErrorCauseSchema),
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type PersistenceError = Schema.Schema.Type<typeof PersistenceErrorSchema>

/**
 * データ整合性エラー
 */
export const DataIntegrityErrorSchema = Schema.TaggedStruct('DataIntegrityError', {
  message: Schema.String,
  expectedChecksum: Schema.optional(Schema.String),
  actualChecksum: Schema.optional(Schema.String),
  corruptedFields: Schema.Array(Schema.String),
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type DataIntegrityError = Schema.Schema.Type<typeof DataIntegrityErrorSchema>

/**
 * 容量制限エラー
 */
export const StorageCapacityErrorSchema = Schema.TaggedStruct('StorageCapacityError', {
  message: Schema.String,
  currentSize: Schema.Number.pipe(Schema.nonNegative()),
  maxSize: Schema.Number.pipe(Schema.positive()),
  storageType: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type StorageCapacityError = Schema.Schema.Type<typeof StorageCapacityErrorSchema>

// === World Generator Repository Errors ===

/**
 * World Generator未発見エラー
 */
export const WorldGeneratorNotFoundErrorSchema = Schema.TaggedStruct('WorldGeneratorNotFoundError', {
  worldId: WorldIdSchema,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type WorldGeneratorNotFoundError = Schema.Schema.Type<typeof WorldGeneratorNotFoundErrorSchema>

/**
 * World Generator重複エラー
 */
export const DuplicateWorldGeneratorErrorSchema = Schema.TaggedStruct('DuplicateWorldGeneratorError', {
  worldId: WorldIdSchema,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type DuplicateWorldGeneratorError = Schema.Schema.Type<typeof DuplicateWorldGeneratorErrorSchema>

/**
 * Generator設定無効エラー
 */
export const InvalidGeneratorConfigErrorSchema = Schema.TaggedStruct('InvalidGeneratorConfigError', {
  worldId: WorldIdSchema,
  configErrors: Schema.Array(Schema.String),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type InvalidGeneratorConfigError = Schema.Schema.Type<typeof InvalidGeneratorConfigErrorSchema>

// === Generation Session Repository Errors ===

/**
 * Generation Session未発見エラー
 */
export const GenerationSessionNotFoundErrorSchema = Schema.TaggedStruct('GenerationSessionNotFoundError', {
  sessionId: GenerationSessionIdSchema,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type GenerationSessionNotFoundError = Schema.Schema.Type<typeof GenerationSessionNotFoundErrorSchema>

/**
 * Session状態不正エラー
 */
export const InvalidSessionStateErrorSchema = Schema.TaggedStruct('InvalidSessionStateError', {
  sessionId: GenerationSessionIdSchema,
  currentState: Schema.String,
  expectedStates: Schema.Array(Schema.String),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type InvalidSessionStateError = Schema.Schema.Type<typeof InvalidSessionStateErrorSchema>

/**
 * Session復旧失敗エラー
 */
export const SessionRecoveryErrorSchema = Schema.TaggedStruct('SessionRecoveryError', {
  sessionId: GenerationSessionIdSchema,
  failureReason: Schema.String,
  recoverableData: Schema.optional(JsonValueSchema),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type SessionRecoveryError = Schema.Schema.Type<typeof SessionRecoveryErrorSchema>

// === Biome System Repository Errors ===

/**
 * Biome未発見エラー
 */
export const BiomeNotFoundErrorSchema = Schema.TaggedStruct('BiomeNotFoundError', {
  biomeId: BiomeIdSchema,
  coordinates: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      z: Schema.Number,
    })
  ),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type BiomeNotFoundError = Schema.Schema.Type<typeof BiomeNotFoundErrorSchema>

/**
 * Biome空間インデックスエラー
 */
export const BiomeSpatialIndexErrorSchema = Schema.TaggedStruct('BiomeSpatialIndexError', {
  indexType: Schema.Literal('quadtree', 'grid', 'rtree'),
  operation: Schema.Literal('insert', 'query', 'update', 'delete'),
  coordinates: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
    radius: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  }),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type BiomeSpatialIndexError = Schema.Schema.Type<typeof BiomeSpatialIndexErrorSchema>

/**
 * Biomeキャッシュエラー
 */
export const BiomeCacheErrorSchema = Schema.TaggedStruct('BiomeCacheError', {
  cacheType: Schema.Literal('lru', 'ttl', 'memory'),
  operation: Schema.Literal('get', 'set', 'evict', 'clear'),
  key: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type BiomeCacheError = Schema.Schema.Type<typeof BiomeCacheErrorSchema>

// === World Metadata Repository Errors ===

/**
 * Metadata未発見エラー
 */
export const MetadataNotFoundErrorSchema = Schema.TaggedStruct('MetadataNotFoundError', {
  worldId: WorldIdSchema,
  metadataType: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type MetadataNotFoundError = Schema.Schema.Type<typeof MetadataNotFoundErrorSchema>

/**
 * 圧縮/展開エラー
 */
export const CompressionErrorSchema = Schema.TaggedStruct('CompressionError', {
  algorithm: Schema.Literal('gzip', 'lz4', 'zstd', 'brotli'),
  operation: Schema.Literal('compress', 'decompress'),
  originalSize: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  compressedSize: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type CompressionError = Schema.Schema.Type<typeof CompressionErrorSchema>

/**
 * バージョン互換性エラー
 */
export const VersionCompatibilityErrorSchema = Schema.TaggedStruct('VersionCompatibilityError', {
  currentVersion: Schema.String,
  requiredVersion: Schema.String,
  dataFormat: Schema.String,
  migrationAvailable: Schema.Boolean,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type VersionCompatibilityError = Schema.Schema.Type<typeof VersionCompatibilityErrorSchema>

// === Unified Error Types ===

/**
 * 全Repository層エラーの統合型（Schema.Union）
 */
export const AllRepositoryErrorsSchema = Schema.Union(
  RepositoryErrorSchema,
  PersistenceErrorSchema,
  DataIntegrityErrorSchema,
  StorageCapacityErrorSchema,
  WorldGeneratorNotFoundErrorSchema,
  DuplicateWorldGeneratorErrorSchema,
  InvalidGeneratorConfigErrorSchema,
  GenerationSessionNotFoundErrorSchema,
  InvalidSessionStateErrorSchema,
  SessionRecoveryErrorSchema,
  BiomeNotFoundErrorSchema,
  BiomeSpatialIndexErrorSchema,
  BiomeCacheErrorSchema,
  MetadataNotFoundErrorSchema,
  CompressionErrorSchema,
  VersionCompatibilityErrorSchema
)
export type AllRepositoryErrors = Schema.Schema.Type<typeof AllRepositoryErrorsSchema>

// === Error Factory Functions ===

/**
 * Repository基底エラー作成
 */
export const createRepositoryError = (
  message: string,
  operation: string,
  cause?: unknown
): Effect.Effect<RepositoryError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(RepositoryErrorSchema)({
      _tag: 'RepositoryError' as const,
      message,
      operation,
      cause: toErrorCause(cause),
      timestamp,
    })
  })

/**
 * 永続化エラー作成
 */
export const createPersistenceError = (
  message: string,
  storageType: 'memory' | 'indexeddb' | 'filesystem' | 'database',
  cause?: unknown
): Effect.Effect<PersistenceError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(PersistenceErrorSchema)({
      _tag: 'PersistenceError' as const,
      message,
      storageType,
      cause: toErrorCause(cause),
      timestamp,
    })
  })

/**
 * データ整合性エラー作成
 */
export const createDataIntegrityError = (
  message: string,
  corruptedFields: readonly string[],
  expectedChecksum?: string,
  actualChecksum?: string
): Effect.Effect<DataIntegrityError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(DataIntegrityErrorSchema)({
      _tag: 'DataIntegrityError' as const,
      message,
      corruptedFields,
      expectedChecksum,
      actualChecksum,
      timestamp,
    })
  })

/**
 * World Generator未発見エラー作成
 */
export const createWorldGeneratorNotFoundError = (
  worldId: WorldId,
  message?: string
): Effect.Effect<WorldGeneratorNotFoundError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(WorldGeneratorNotFoundErrorSchema)({
      _tag: 'WorldGeneratorNotFoundError' as const,
      worldId,
      message: message ?? `World generator not found for world: ${worldId}`,
      timestamp,
    })
  })

/**
 * Generation Session未発見エラー作成
 */
export const createGenerationSessionNotFoundError = (
  sessionId: GenerationSessionId,
  message?: string
): Effect.Effect<GenerationSessionNotFoundError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(GenerationSessionNotFoundErrorSchema)({
      _tag: 'GenerationSessionNotFoundError' as const,
      sessionId,
      message: message ?? `Generation session not found: ${sessionId}`,
      timestamp,
    })
  })

/**
 * Biome未発見エラー作成
 */
export const createBiomeNotFoundError = (
  biomeId: BiomeId,
  coordinates?: { x: number; z: number },
  message?: string
): Effect.Effect<BiomeNotFoundError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(BiomeNotFoundErrorSchema)({
      _tag: 'BiomeNotFoundError' as const,
      biomeId,
      coordinates,
      message: message ?? `Biome not found: ${biomeId}`,
      timestamp,
    })
  })

/**
 * Metadata未発見エラー作成
 */
export const createMetadataNotFoundError = (
  worldId: WorldId,
  metadataType: string,
  message?: string
): Effect.Effect<MetadataNotFoundError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(MetadataNotFoundErrorSchema)({
      _tag: 'MetadataNotFoundError' as const,
      worldId,
      metadataType,
      message: message ?? `Metadata not found for world: ${worldId}, type: ${metadataType}`,
      timestamp,
    })
  })

/**
 * Storage Capacity エラー作成
 */
export const createStorageCapacityError = (
  message: string,
  currentSize: number,
  maxSize: number,
  storageType: string
): Effect.Effect<StorageCapacityError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(StorageCapacityErrorSchema)({
      _tag: 'StorageCapacityError' as const,
      message,
      currentSize,
      maxSize,
      storageType,
      timestamp,
    })
  })

/**
 * Duplicate World Generator エラー作成
 */
export const createDuplicateWorldGeneratorError = (
  worldId: WorldId,
  message?: string
): Effect.Effect<DuplicateWorldGeneratorError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(DuplicateWorldGeneratorErrorSchema)({
      _tag: 'DuplicateWorldGeneratorError' as const,
      worldId,
      message: message ?? `Duplicate world generator for world: ${worldId}`,
      timestamp,
    })
  })

/**
 * Invalid Generator Config エラー作成
 */
export const createInvalidGeneratorConfigError = (
  worldId: WorldId,
  configErrors: readonly string[],
  message?: string
): Effect.Effect<InvalidGeneratorConfigError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(InvalidGeneratorConfigErrorSchema)({
      _tag: 'InvalidGeneratorConfigError' as const,
      worldId,
      configErrors,
      message: message ?? `Invalid generator config for world: ${worldId}`,
      timestamp,
    })
  })

/**
 * Invalid Session State エラー作成
 */
export const createInvalidSessionStateError = (
  sessionId: GenerationSessionId,
  currentState: string,
  expectedStates: readonly string[],
  message?: string
): Effect.Effect<InvalidSessionStateError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(InvalidSessionStateErrorSchema)({
      _tag: 'InvalidSessionStateError' as const,
      sessionId,
      currentState,
      expectedStates,
      message: message ?? `Invalid session state: ${currentState}`,
      timestamp,
    })
  })

/**
 * Session Recovery エラー作成
 */
export const createSessionRecoveryError = (
  sessionId: GenerationSessionId,
  failureReason: string,
  recoverableData?: JsonValue,
  message?: string
): Effect.Effect<SessionRecoveryError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(SessionRecoveryErrorSchema)({
      _tag: 'SessionRecoveryError' as const,
      sessionId,
      failureReason,
      recoverableData,
      message: message ?? `Session recovery failed: ${failureReason}`,
      timestamp,
    })
  })

/**
 * Biome Spatial Index エラー作成
 */
export const createBiomeSpatialIndexError = (
  indexType: 'quadtree' | 'grid' | 'rtree',
  operation: 'insert' | 'query' | 'update' | 'delete',
  coordinates: { x: number; z: number; radius?: number },
  message: string
): Effect.Effect<BiomeSpatialIndexError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(BiomeSpatialIndexErrorSchema)({
      _tag: 'BiomeSpatialIndexError' as const,
      indexType,
      operation,
      coordinates,
      message,
      timestamp,
    })
  })

/**
 * Biome Cache エラー作成
 */
export const createBiomeCacheError = (
  cacheType: 'lru' | 'ttl' | 'memory',
  operation: 'get' | 'set' | 'evict' | 'clear',
  key: string,
  message: string
): Effect.Effect<BiomeCacheError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(BiomeCacheErrorSchema)({
      _tag: 'BiomeCacheError' as const,
      cacheType,
      operation,
      key,
      message,
      timestamp,
    })
  })

/**
 * Compression エラー作成
 */
export const createCompressionError = (
  algorithm: 'gzip' | 'lz4' | 'zstd' | 'brotli',
  operation: 'compress' | 'decompress',
  message: string,
  originalSize?: number,
  compressedSize?: number
): Effect.Effect<CompressionError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(CompressionErrorSchema)({
      _tag: 'CompressionError' as const,
      algorithm,
      operation,
      originalSize,
      compressedSize,
      message,
      timestamp,
    })
  })

/**
 * Storage エラー作成（createPersistenceErrorのエイリアス）
 * @deprecated Use createPersistenceError instead
 */
export const createStorageError = (
  message: string,
  operation: string,
  cause?: unknown
): Effect.Effect<PersistenceError, Schema.ParseError> => createPersistenceError(message, 'filesystem', cause)

/**
 * Version Compatibility エラー作成
 */
export const createVersionCompatibilityError = (
  currentVersion: string,
  requiredVersion: string,
  dataFormat: string,
  migrationAvailable: boolean,
  message?: string
): Effect.Effect<VersionCompatibilityError, Schema.ParseError> =>
  Effect.gen(function* () {
    const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))
    return yield* Schema.decode(VersionCompatibilityErrorSchema)({
      _tag: 'VersionCompatibilityError' as const,
      currentVersion,
      requiredVersion,
      dataFormat,
      migrationAvailable,
      message: message ?? `Version incompatibility: current ${currentVersion}, required ${requiredVersion}`,
      timestamp,
    })
  })

// === Error Type Guards ===

/**
 * Repository関連エラーの型ガード（_tagベース）
 */
export const isRepositoryError = (error: unknown): error is RepositoryError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'RepositoryError'

export const isPersistenceError = (error: unknown): error is PersistenceError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'PersistenceError'

export const isDataIntegrityError = (error: unknown): error is DataIntegrityError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'DataIntegrityError'

export const isWorldGeneratorNotFoundError = (error: unknown): error is WorldGeneratorNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'WorldGeneratorNotFoundError'

export const isGenerationSessionNotFoundError = (error: unknown): error is GenerationSessionNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'GenerationSessionNotFoundError'

export const isBiomeNotFoundError = (error: unknown): error is BiomeNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'BiomeNotFoundError'

export const isMetadataNotFoundError = (error: unknown): error is MetadataNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'MetadataNotFoundError'

export const isStorageCapacityError = (error: unknown): error is StorageCapacityError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'StorageCapacityError'

export const isDuplicateWorldGeneratorError = (error: unknown): error is DuplicateWorldGeneratorError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'DuplicateWorldGeneratorError'

export const isInvalidGeneratorConfigError = (error: unknown): error is InvalidGeneratorConfigError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InvalidGeneratorConfigError'

export const isInvalidSessionStateError = (error: unknown): error is InvalidSessionStateError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InvalidSessionStateError'

export const isSessionRecoveryError = (error: unknown): error is SessionRecoveryError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'SessionRecoveryError'

export const isBiomeSpatialIndexError = (error: unknown): error is BiomeSpatialIndexError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'BiomeSpatialIndexError'

export const isBiomeCacheError = (error: unknown): error is BiomeCacheError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'BiomeCacheError'

export const isCompressionError = (error: unknown): error is CompressionError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'CompressionError'

export const isVersionCompatibilityError = (error: unknown): error is VersionCompatibilityError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'VersionCompatibilityError'

// === Error Categorization ===

/**
 * エラーカテゴリ分類（Match.tagベース）
 */
export const categorizeRepositoryError = (error: AllRepositoryErrors) =>
  Match.value(error).pipe(
    Match.tag('RepositoryError', () => 'infrastructure' as const),
    Match.tag('PersistenceError', () => 'infrastructure' as const),
    Match.tag('DataIntegrityError', () => 'data_quality' as const),
    Match.tag('WorldGeneratorNotFoundError', () => 'not_found' as const),
    Match.tag('GenerationSessionNotFoundError', () => 'not_found' as const),
    Match.tag('BiomeNotFoundError', () => 'not_found' as const),
    Match.tag('MetadataNotFoundError', () => 'not_found' as const),
    Match.tag('StorageCapacityError', () => 'capacity' as const),
    Match.tag('DuplicateWorldGeneratorError', () => 'conflict' as const),
    Match.tag('InvalidGeneratorConfigError', () => 'validation' as const),
    Match.tag('InvalidSessionStateError', () => 'state' as const),
    Match.tag('SessionRecoveryError', () => 'recovery' as const),
    Match.tag('BiomeSpatialIndexError', () => 'index' as const),
    Match.tag('BiomeCacheError', () => 'cache' as const),
    Match.tag('CompressionError', () => 'compression' as const),
    Match.tag('VersionCompatibilityError', () => 'version' as const),
    Match.exhaustive
  )

/**
 * エラー重要度判定（Match.tagベース）
 */
export const getErrorSeverity = (error: AllRepositoryErrors): 'low' | 'medium' | 'high' | 'critical' =>
  Match.value(error).pipe(
    Match.tag('DataIntegrityError', () => 'critical' as const),
    Match.tag('PersistenceError', () => 'high' as const),
    Match.tag('StorageCapacityError', () => 'high' as const),
    Match.tag('VersionCompatibilityError', () => 'high' as const),
    Match.tag('RepositoryError', () => 'medium' as const),
    Match.tag('SessionRecoveryError', () => 'medium' as const),
    Match.tag('InvalidSessionStateError', () => 'medium' as const),
    Match.tag('BiomeSpatialIndexError', () => 'medium' as const),
    Match.tag('CompressionError', () => 'medium' as const),
    Match.tag('WorldGeneratorNotFoundError', () => 'low' as const),
    Match.tag('GenerationSessionNotFoundError', () => 'low' as const),
    Match.tag('BiomeNotFoundError', () => 'low' as const),
    Match.tag('MetadataNotFoundError', () => 'low' as const),
    Match.tag('DuplicateWorldGeneratorError', () => 'low' as const),
    Match.tag('InvalidGeneratorConfigError', () => 'low' as const),
    Match.tag('BiomeCacheError', () => 'low' as const),
    Match.exhaustive
  )

/**
 * エラーリトライ可能性判定（Match.tagベース）
 */
export const isRetryableError = (error: AllRepositoryErrors): boolean =>
  Match.value(error).pipe(
    Match.tag('DataIntegrityError', () => false),
    Match.tag('DuplicateWorldGeneratorError', () => false),
    Match.tag('InvalidGeneratorConfigError', () => false),
    Match.tag('InvalidSessionStateError', () => false),
    Match.tag('VersionCompatibilityError', () => false),
    Match.tag('PersistenceError', () => true),
    Match.tag('RepositoryError', () => true),
    Match.tag('StorageCapacityError', () => true),
    Match.tag('SessionRecoveryError', () => true),
    Match.tag('BiomeSpatialIndexError', () => true),
    Match.tag('BiomeCacheError', () => true),
    Match.tag('CompressionError', () => true),
    Match.tag('WorldGeneratorNotFoundError', () => true),
    Match.tag('GenerationSessionNotFoundError', () => true),
    Match.tag('BiomeNotFoundError', () => true),
    Match.tag('MetadataNotFoundError', () => true),
    Match.exhaustive
  )
