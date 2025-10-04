/**
 * Chunk Repository Types - Barrel Export
 *
 * チャンクリポジトリ型定義の統合エクスポート
 */

export {
  // Repository Errors
  type RepositoryError,
  RepositoryError,
  RepositoryErrors,
  RepositoryErrorSchema,

  // Type Guards
  isChunkNotFoundError,
  isDuplicateChunkError,
  isStorageError,
  isValidationError,
  isDataIntegrityError,
  isNetworkError,
  isTimeoutError,
  isPermissionError,
  isResourceLimitError,

  // Error Recovery Utilities
  isRetryableError,
  isTransientError,
  getRetryDelay,
} from './repository-error'