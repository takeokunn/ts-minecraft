/**
 * @fileoverview World Repository Error Types
 * ワールドドメインRepository層のエラー型定義
 *
 * DDD Repository Pattern に基づく包括的エラーハンドリング
 * Effect-TS 3.17+ の Data.tagged による構造化エラー
 */

import type { GenerationSessionId } from '@domain/world/aggregate/generation_session'
import type { BiomeId, WorldId } from '@domain/world/types/core'
import { Clock, Data, Effect, Match } from 'effect'

// === Core Repository Errors ===

/**
 * Repository操作の基底エラー
 */
export class RepositoryError extends Data.TaggedError('RepositoryError')<{
  readonly message: string
  readonly cause?: unknown
  readonly timestamp: number
  readonly operation: string
}> {}

/**
 * 永続化層エラー
 */
export class PersistenceError extends Data.TaggedError('PersistenceError')<{
  readonly message: string
  readonly storageType: 'memory' | 'indexeddb' | 'filesystem' | 'database'
  readonly cause?: unknown
  readonly timestamp: number
}> {}

/**
 * データ整合性エラー
 */
export class DataIntegrityError extends Data.TaggedError('DataIntegrityError')<{
  readonly message: string
  readonly expectedChecksum?: string
  readonly actualChecksum?: string
  readonly corruptedFields: readonly string[]
  readonly timestamp: number
}> {}

/**
 * 容量制限エラー
 */
export class StorageCapacityError extends Data.TaggedError('StorageCapacityError')<{
  readonly message: string
  readonly currentSize: number
  readonly maxSize: number
  readonly storageType: string
  readonly timestamp: number
}> {}

// === World Generator Repository Errors ===

/**
 * World Generator未発見エラー
 */
export class WorldGeneratorNotFoundError extends Data.TaggedError('WorldGeneratorNotFoundError')<{
  readonly worldId: WorldId
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * World Generator重複エラー
 */
export class DuplicateWorldGeneratorError extends Data.TaggedError('DuplicateWorldGeneratorError')<{
  readonly worldId: WorldId
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * Generator設定無効エラー
 */
export class InvalidGeneratorConfigError extends Data.TaggedError('InvalidGeneratorConfigError')<{
  readonly worldId: WorldId
  readonly configErrors: readonly string[]
  readonly message: string
  readonly timestamp: number
}> {}

// === Generation Session Repository Errors ===

/**
 * Generation Session未発見エラー
 */
export class GenerationSessionNotFoundError extends Data.TaggedError('GenerationSessionNotFoundError')<{
  readonly sessionId: GenerationSessionId
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * Session状態不正エラー
 */
export class InvalidSessionStateError extends Data.TaggedError('InvalidSessionStateError')<{
  readonly sessionId: GenerationSessionId
  readonly currentState: string
  readonly expectedStates: readonly string[]
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * Session復旧失敗エラー
 */
export class SessionRecoveryError extends Data.TaggedError('SessionRecoveryError')<{
  readonly sessionId: GenerationSessionId
  readonly failureReason: string
  readonly recoverableData?: unknown
  readonly message: string
  readonly timestamp: number
}> {}

// === Biome System Repository Errors ===

/**
 * Biome未発見エラー
 */
export class BiomeNotFoundError extends Data.TaggedError('BiomeNotFoundError')<{
  readonly biomeId: BiomeId
  readonly coordinates?: { x: number; z: number }
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * Biome空間インデックスエラー
 */
export class BiomeSpatialIndexError extends Data.TaggedError('BiomeSpatialIndexError')<{
  readonly indexType: 'quadtree' | 'grid' | 'rtree'
  readonly operation: 'insert' | 'query' | 'update' | 'delete'
  readonly coordinates: { x: number; z: number; radius?: number }
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * Biomeキャッシュエラー
 */
export class BiomeCacheError extends Data.TaggedError('BiomeCacheError')<{
  readonly cacheType: 'lru' | 'ttl' | 'memory'
  readonly operation: 'get' | 'set' | 'evict' | 'clear'
  readonly key: string
  readonly message: string
  readonly timestamp: number
}> {}

// === World Metadata Repository Errors ===

/**
 * Metadata未発見エラー
 */
export class MetadataNotFoundError extends Data.TaggedError('MetadataNotFoundError')<{
  readonly worldId: WorldId
  readonly metadataType: string
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * 圧縮/展開エラー
 */
export class CompressionError extends Data.TaggedError('CompressionError')<{
  readonly algorithm: 'gzip' | 'lz4' | 'zstd' | 'brotli'
  readonly operation: 'compress' | 'decompress'
  readonly originalSize?: number
  readonly compressedSize?: number
  readonly message: string
  readonly timestamp: number
}> {}

/**
 * バージョン互換性エラー
 */
export class VersionCompatibilityError extends Data.TaggedError('VersionCompatibilityError')<{
  readonly currentVersion: string
  readonly requiredVersion: string
  readonly dataFormat: string
  readonly migrationAvailable: boolean
  readonly message: string
  readonly timestamp: number
}> {}

// === Unified Error Types ===

/**
 * 全Repository層エラーの統合型
 */
export type AllRepositoryErrors =
  | RepositoryError
  | PersistenceError
  | DataIntegrityError
  | StorageCapacityError
  | WorldGeneratorNotFoundError
  | DuplicateWorldGeneratorError
  | InvalidGeneratorConfigError
  | GenerationSessionNotFoundError
  | InvalidSessionStateError
  | SessionRecoveryError
  | BiomeNotFoundError
  | BiomeSpatialIndexError
  | BiomeCacheError
  | MetadataNotFoundError
  | CompressionError
  | VersionCompatibilityError

// === Error Factory Functions ===

/**
 * Repository基底エラー作成
 */
export const createRepositoryError = (
  message: string,
  operation: string,
  cause?: unknown
): Effect.Effect<RepositoryError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new RepositoryError({
      message,
      operation,
      cause,
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
): Effect.Effect<PersistenceError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new PersistenceError({
      message,
      storageType,
      cause,
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
): Effect.Effect<DataIntegrityError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new DataIntegrityError({
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
): Effect.Effect<WorldGeneratorNotFoundError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new WorldGeneratorNotFoundError({
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
): Effect.Effect<GenerationSessionNotFoundError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new GenerationSessionNotFoundError({
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
): Effect.Effect<BiomeNotFoundError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new BiomeNotFoundError({
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
): Effect.Effect<MetadataNotFoundError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return new MetadataNotFoundError({
      worldId,
      metadataType,
      message: message ?? `Metadata not found for world: ${worldId}, type: ${metadataType}`,
      timestamp,
    })
  })

// === Error Type Guards ===

/**
 * Repository関連エラーの型ガード
 */
export const isRepositoryError = (error: unknown): error is RepositoryError => error instanceof RepositoryError

export const isPersistenceError = (error: unknown): error is PersistenceError => error instanceof PersistenceError

export const isDataIntegrityError = (error: unknown): error is DataIntegrityError => error instanceof DataIntegrityError

export const isWorldGeneratorNotFoundError = (error: unknown): error is WorldGeneratorNotFoundError =>
  error instanceof WorldGeneratorNotFoundError

export const isGenerationSessionNotFoundError = (error: unknown): error is GenerationSessionNotFoundError =>
  error instanceof GenerationSessionNotFoundError

export const isBiomeNotFoundError = (error: unknown): error is BiomeNotFoundError => error instanceof BiomeNotFoundError

export const isMetadataNotFoundError = (error: unknown): error is MetadataNotFoundError =>
  error instanceof MetadataNotFoundError

// === Error Categorization ===

/**
 * エラーカテゴリ分類
 */
export const categorizeRepositoryError = (error: AllRepositoryErrors) =>
  Match.value(error).pipe(
    Match.when(
      (e): e is RepositoryError | PersistenceError => isRepositoryError(e) || isPersistenceError(e),
      () => 'infrastructure' as const
    ),
    Match.when(
      (e): e is DataIntegrityError => isDataIntegrityError(e),
      () => 'data_quality' as const
    ),
    Match.when(
      (
        e
      ): e is
        | WorldGeneratorNotFoundError
        | GenerationSessionNotFoundError
        | BiomeNotFoundError
        | MetadataNotFoundError =>
        isWorldGeneratorNotFoundError(e) ||
        isGenerationSessionNotFoundError(e) ||
        isBiomeNotFoundError(e) ||
        isMetadataNotFoundError(e),
      () => 'not_found' as const
    ),
    Match.orElse(() => 'unknown' as const)
  )

/**
 * エラー重要度判定
 */
export const getErrorSeverity = (error: AllRepositoryErrors): 'low' | 'medium' | 'high' | 'critical' =>
  Match.value(error).pipe(
    Match.when(
      (e): e is DataIntegrityError => isDataIntegrityError(e),
      () => 'critical' as const
    ),
    Match.when(
      (e): e is PersistenceError => isPersistenceError(e),
      () => 'high' as const
    ),
    Match.when(
      (e): e is RepositoryError => isRepositoryError(e),
      () => 'medium' as const
    ),
    Match.orElse(() => 'low' as const)
  )

/**
 * エラーリトライ可能性判定
 */
export const isRetryableError = (error: AllRepositoryErrors): boolean =>
  Match.value(error).pipe(
    Match.when(
      (e): e is DataIntegrityError => isDataIntegrityError(e),
      () => false
    ),
    Match.when(
      (e): e is PersistenceError => isPersistenceError(e),
      () => true
    ),
    Match.when(
      (e): e is RepositoryError => isRepositoryError(e),
      () => true
    ),
    Match.orElse(() => false)
  )
