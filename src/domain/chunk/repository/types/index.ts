/**
 * Chunk Repository Types - Barrel Export
 *
 * チャンクリポジトリ型定義の統合エクスポート
 */

export {
  RepositoryError,
  RepositoryErrorSchema,
  RepositoryErrors,
  getRetryDelay,
  // Type Guards
  isChunkNotFoundError,
  isDataIntegrityError,
  isDuplicateChunkError,
  isNetworkError,
  isPermissionError,
  isResourceLimitError,

  // Error Recovery Utilities
  isRetryableError,
  isStorageError,
  isTimeoutError,
  isTransientError,
  isValidationError,
  // Repository Errors
  type RepositoryError,
} from './repository_error'
