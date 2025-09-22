import { Match, pipe } from 'effect'
import type { AnyGameError } from './GameErrors'
import type { AnyNetworkError } from './NetworkErrors'

/**
 * エラーの型ガード
 */
export const ErrorGuards = {
  isGameError: (error: unknown): error is AnyGameError =>
    error !== null &&
    typeof error === 'object' &&
    '_tag' in error &&
    [
      'GameError',
      'InvalidStateError',
      'ResourceNotFoundError',
      'ValidationError',
      'PerformanceError',
      'ConfigError',
      'RenderError',
      'WorldGenerationError',
      'EntityError',
      'PhysicsError',
    ].includes((error as { _tag: string })._tag),

  isNetworkError: (error: unknown): error is AnyNetworkError =>
    error !== null &&
    typeof error === 'object' &&
    '_tag' in error &&
    [
      'NetworkError',
      'ConnectionError',
      'TimeoutError',
      'ProtocolError',
      'AuthenticationError',
      'SessionError',
      'SyncError',
      'RateLimitError',
      'WebSocketError',
      'PacketError',
      'ServerError',
      'P2PError',
    ].includes((error as { _tag: string })._tag),

  isRetryableError: (error: unknown): boolean => {
    if (error !== null && typeof error === 'object' && '_tag' in error) {
      const taggedError = error as { _tag: string }
      const retryableTags = ['NetworkError', 'ConnectionError', 'TimeoutError', 'ServerError']
      return retryableTags.includes(taggedError._tag)
    }
    return false
  },
}
