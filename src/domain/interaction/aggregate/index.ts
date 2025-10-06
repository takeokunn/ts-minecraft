/**
 * @fileoverview Interaction集約のバレルエクスポート
 * ブロック破壊セッションの集約ルート
 */

export type { BreakingSession, BreakingSessionError, SessionState } from './index'
export {
  BreakingSessionError,
  BreakingSessionSchema,
  SessionStateSchema,
  completeImmediately,
  createSession,
  decodeSession,
  recordProgress,
} from './index'
export * from './index';
