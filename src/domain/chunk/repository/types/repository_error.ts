import { Clock, Data, Effect, Match, pipe, Schema } from 'effect'

/**
 * Chunk Repository Domain - Error Types
 *
 * チャンクリポジトリドメインのエラー型定義
 * DDDのRepository Patternにおけるエラーハンドリング統一
 */

// ===== Repository Base Error ===== //

/**
 * Repository 基底エラー型
 */
export type RepositoryError = Data.TaggedEnum<{
  /** チャンクが見つからない */
  ChunkNotFound: {
    readonly chunkId: string
    readonly message: string
    readonly timestamp: number
  }

  /** 重複チャンクエラー */
  DuplicateChunk: {
    readonly chunkId: string
    readonly message: string
    readonly timestamp: number
  }

  /** ストレージエラー */
  StorageError: {
    readonly operation: string
    readonly reason: string
    readonly originalError: unknown
    readonly timestamp: number
  }

  /** バリデーションエラー */
  ValidationError: {
    readonly field: string
    readonly value: unknown
    readonly constraint: string
    readonly timestamp: number
  }

  /** データ整合性エラー */
  DataIntegrityError: {
    readonly expected: string
    readonly actual: string
    readonly checksum?: string
    readonly timestamp: number
  }

  /** ネットワークエラー */
  NetworkError: {
    readonly url: string
    readonly status: number
    readonly message: string
    readonly timestamp: number
  }

  /** タイムアウトエラー */
  TimeoutError: {
    readonly operation: string
    readonly duration: number
    readonly threshold: number
    readonly timestamp: number
  }

  /** 権限エラー */
  PermissionError: {
    readonly operation: string
    readonly resource: string
    readonly requiredPermission: string
    readonly timestamp: number
  }

  /** リソース制限エラー */
  ResourceLimitError: {
    readonly resource: string
    readonly limit: number
    readonly current: number
    readonly timestamp: number
  }
}>

export const RepositoryError = Data.taggedEnum<RepositoryError>()

// ===== Error Factory Functions ===== //

/**
 * RepositoryError ファクトリ関数
 */
export const RepositoryErrors = {
  chunkNotFound: (chunkId: string, message?: string): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.ChunkNotFound({
        chunkId,
        message: message ?? `Chunk not found: ${chunkId}`,
        timestamp,
      })
    }),

  duplicateChunk: (chunkId: string, message?: string): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.DuplicateChunk({
        chunkId,
        message: message ?? `Duplicate chunk: ${chunkId}`,
        timestamp,
      })
    }),

  storage: (operation: string, reason: string, originalError?: unknown): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.StorageError({
        operation,
        reason,
        originalError: originalError ?? 'Unknown error',
        timestamp,
      })
    }),

  validation: (field: string, value: unknown, constraint: string): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.ValidationError({
        field,
        value,
        constraint,
        timestamp,
      })
    }),

  dataIntegrity: (expected: string, actual: string, checksum?: string): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.DataIntegrityError({
        expected,
        actual,
        checksum,
        timestamp,
      })
    }),

  network: (url: string, status: number, message: string): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.NetworkError({
        url,
        status,
        message,
        timestamp,
      })
    }),

  timeout: (operation: string, duration: number, threshold: number): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.TimeoutError({
        operation,
        duration,
        threshold,
        timestamp,
      })
    }),

  permission: (operation: string, resource: string, requiredPermission: string): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.PermissionError({
        operation,
        resource,
        requiredPermission,
        timestamp,
      })
    }),

  resourceLimit: (resource: string, limit: number, current: number): Effect.Effect<RepositoryError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return RepositoryError.ResourceLimitError({
        resource,
        limit,
        current,
        timestamp,
      })
    }),
} as const

// ===== Error Schema Definitions ===== //

/**
 * Schema定義による型安全なエラーハンドリング
 */
export const RepositoryErrorSchema = Schema.TaggedEnum(RepositoryError)

// ===== Type Guards ===== //

/**
 * エラー型判定関数
 */
export const isChunkNotFoundError = (error: RepositoryError): error is RepositoryError & { _tag: 'ChunkNotFound' } =>
  error._tag === 'ChunkNotFound'

export const isDuplicateChunkError = (error: RepositoryError): error is RepositoryError & { _tag: 'DuplicateChunk' } =>
  error._tag === 'DuplicateChunk'

export const isStorageError = (error: RepositoryError): error is RepositoryError & { _tag: 'StorageError' } =>
  error._tag === 'StorageError'

export const isValidationError = (error: RepositoryError): error is RepositoryError & { _tag: 'ValidationError' } =>
  error._tag === 'ValidationError'

export const isDataIntegrityError = (
  error: RepositoryError
): error is RepositoryError & { _tag: 'DataIntegrityError' } => error._tag === 'DataIntegrityError'

export const isNetworkError = (error: RepositoryError): error is RepositoryError & { _tag: 'NetworkError' } =>
  error._tag === 'NetworkError'

export const isTimeoutError = (error: RepositoryError): error is RepositoryError & { _tag: 'TimeoutError' } =>
  error._tag === 'TimeoutError'

export const isPermissionError = (error: RepositoryError): error is RepositoryError & { _tag: 'PermissionError' } =>
  error._tag === 'PermissionError'

export const isResourceLimitError = (
  error: RepositoryError
): error is RepositoryError & { _tag: 'ResourceLimitError' } => error._tag === 'ResourceLimitError'

// ===== Error Recovery Utilities ===== //

/**
 * エラー回復ユーティリティ
 */
export const isRetryableError = (error: RepositoryError): boolean =>
  pipe(
    Match.value(error),
    Match.tag('NetworkError', () => true),
    Match.tag('TimeoutError', () => true),
    Match.tag('StorageError', () => true),
    Match.orElse(() => false)
  )

export const isTransientError = (error: RepositoryError): boolean =>
  pipe(
    Match.value(error),
    Match.tag('NetworkError', () => true),
    Match.tag('TimeoutError', () => true),
    Match.orElse(() => false)
  )

export const getRetryDelay = (error: RepositoryError, attempt: number): number =>
  isRetryableError(error)
    ? (() => {
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000)
        const jitter = Math.random() * 0.1 * baseDelay
        return baseDelay + jitter
      })()
    : 0
