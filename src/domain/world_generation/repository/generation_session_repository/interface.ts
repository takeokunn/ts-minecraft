/**
 * @fileoverview Generation Session Repository Interface
 * 生成セッションリポジトリのインターフェース定義
 *
 * セッション管理・復旧・履歴管理機能を提供
 * Effect-TS 3.17+ Context.GenericTag による依存性注入
 */

import type {
  AllRepositoryErrors,
  ChunkGenerationResult,
  ChunkPosition,
  GenerationSessionId,
  GenerationSettings,
  GenerationStage,
  GenerationStageStatus,
  WorldId,
} from '@domain/world/types'
import type { JsonValue } from '@shared/schema/json'
import { Context, Effect, Option, ReadonlyArray, Schema } from 'effect'

// === Generation Session Types ===

/**
 * 生成セッションの状態
 */
export type SessionState =
  | 'initializing'
  | 'active'
  | 'paused'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovering'

/**
 * 生成セッション実体
 */
export interface GenerationSession {
  readonly id: GenerationSessionId
  readonly worldId: WorldId
  readonly state: SessionState
  readonly settings: GenerationSettings
  readonly createdAt: Date
  readonly startedAt: Date | null
  readonly completedAt: Date | null
  readonly lastActivityAt: Date
  readonly progress: GenerationProgress
  readonly chunks: readonly ChunkGenerationTask[]
  readonly metadata: GenerationSessionMetadata
}

/**
 * 生成進捗情報
 */
export interface GenerationProgress {
  readonly totalChunks: number
  readonly completedChunks: number
  readonly failedChunks: number
  readonly pendingChunks: number
  readonly currentStage: GenerationStage
  readonly overallProgress: number // 0.0 - 1.0
  readonly estimatedTimeRemaining: number | null // milliseconds
  readonly chunksPerSecond: number
  readonly stageTiming: Record<GenerationStage, number> // milliseconds per stage
}

/**
 * チャンク生成タスク
 */
export interface ChunkGenerationTask {
  readonly position: ChunkPosition
  readonly stage: GenerationStage
  readonly status: GenerationStageStatus
  readonly startedAt: Date | null
  readonly completedAt: Date | null
  readonly retryCount: number
  readonly result: ChunkGenerationResult | null
  readonly error: string | null
  readonly dependencies: readonly ChunkPosition[]
}

/**
 * セッションメタデータ
 */
export interface GenerationSessionMetadata {
  readonly version: string
  readonly environment: 'development' | 'production' | 'test'
  readonly generator: string
  readonly seed: string
  readonly tags: readonly string[]
  readonly priority: 'low' | 'normal' | 'high' | 'critical'
  readonly autoPause: boolean
  readonly autoRecover: boolean
  readonly maxRetries: number
  readonly timeout: number // milliseconds
  readonly checkpointInterval: number // milliseconds
}

// === Query Types ===

/**
 * セッション検索クエリ
 */
export interface SessionQuery {
  readonly worldId?: WorldId
  readonly state?: SessionState
  readonly priority?: GenerationSessionMetadata['priority']
  readonly createdAfter?: Date
  readonly createdBefore?: Date
  readonly hasFailedChunks?: boolean
  readonly tags?: readonly string[]
  readonly limit?: number
  readonly offset?: number
  readonly sortBy?: 'createdAt' | 'lastActivityAt' | 'progress'
  readonly sortOrder?: 'asc' | 'desc'
}

/**
 * セッション統計情報
 */
export interface SessionStatistics {
  readonly totalSessions: number
  readonly activeSessions: number
  readonly completedSessions: number
  readonly failedSessions: number
  readonly averageCompletionTime: number
  readonly averageChunksPerSecond: number
  readonly totalChunksGenerated: number
  readonly failureRate: number
  readonly recoverySuccessRate: number
}

/**
 * セッション復旧情報
 */
export interface SessionRecoveryInfo {
  readonly sessionId: GenerationSessionId
  readonly canRecover: boolean
  readonly lastCheckpoint: Date | null
  readonly corruptedChunks: readonly ChunkPosition[]
  readonly recoverableChunks: readonly ChunkPosition[]
  readonly estimatedRecoveryTime: number // milliseconds
  readonly riskLevel: 'low' | 'medium' | 'high'
  readonly recommendations: readonly string[]
}

/**
 * バッチ操作結果
 */
export interface SessionBatchResult {
  readonly successful: readonly GenerationSessionId[]
  readonly failed: readonly { sessionId: GenerationSessionId; error: AllRepositoryErrors }[]
  readonly totalProcessed: number
}

// === Repository Interface ===

/**
 * Generation Session Repository インターフェース
 */
export interface GenerationSessionRepository {
  // === Session CRUD Operations ===

  /**
   * セッション作成
   */
  readonly createSession: (
    worldId: WorldId,
    settings: GenerationSettings,
    metadata?: Partial<GenerationSessionMetadata>
  ) => Effect.Effect<GenerationSession, AllRepositoryErrors>

  /**
   * セッション取得
   */
  readonly findById: (
    sessionId: GenerationSessionId
  ) => Effect.Effect<Option.Option<GenerationSession>, AllRepositoryErrors>

  /**
   * 複数セッション取得
   */
  readonly findManyByIds: (
    sessionIds: ReadonlyArray<GenerationSessionId>
  ) => Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors>

  /**
   * ワールド別セッション取得
   */
  readonly findByWorldId: (worldId: WorldId) => Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors>

  /**
   * クエリによるセッション検索
   */
  readonly findByQuery: (query: SessionQuery) => Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors>

  /**
   * アクティブセッション取得
   */
  readonly findActiveSessions: () => Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors>

  /**
   * セッション更新
   */
  readonly updateSession: (session: GenerationSession) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * セッション削除
   */
  readonly deleteSession: (sessionId: GenerationSessionId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 複数セッション削除
   */
  readonly deleteSessions: (
    sessionIds: ReadonlyArray<GenerationSessionId>
  ) => Effect.Effect<SessionBatchResult, AllRepositoryErrors>

  // === Session State Management ===

  /**
   * セッション状態更新
   */
  readonly updateSessionState: (
    sessionId: GenerationSessionId,
    state: SessionState
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * セッション進捗更新
   */
  readonly updateProgress: (
    sessionId: GenerationSessionId,
    progress: Partial<GenerationProgress>
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * セッション一時停止
   */
  readonly pauseSession: (sessionId: GenerationSessionId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * セッション再開
   */
  readonly resumeSession: (sessionId: GenerationSessionId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * セッションキャンセル
   */
  readonly cancelSession: (sessionId: GenerationSessionId, reason?: string) => Effect.Effect<void, AllRepositoryErrors>

  // === Chunk Task Management ===

  /**
   * チャンクタスク追加
   */
  readonly addChunkTask: (
    sessionId: GenerationSessionId,
    task: ChunkGenerationTask
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * チャンクタスク更新
   */
  readonly updateChunkTask: (
    sessionId: GenerationSessionId,
    position: ChunkPosition,
    update: Partial<ChunkGenerationTask>
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 完了チャンクタスク取得
   */
  readonly getCompletedChunks: (
    sessionId: GenerationSessionId
  ) => Effect.Effect<ReadonlyArray<ChunkGenerationTask>, AllRepositoryErrors>

  /**
   * 失敗チャンクタスク取得
   */
  readonly getFailedChunks: (
    sessionId: GenerationSessionId
  ) => Effect.Effect<ReadonlyArray<ChunkGenerationTask>, AllRepositoryErrors>

  /**
   * 保留中チャンクタスク取得
   */
  readonly getPendingChunks: (
    sessionId: GenerationSessionId
  ) => Effect.Effect<ReadonlyArray<ChunkGenerationTask>, AllRepositoryErrors>

  // === Checkpoint & Recovery ===

  /**
   * チェックポイント作成
   */
  readonly createCheckpoint: (sessionId: GenerationSessionId) => Effect.Effect<string, AllRepositoryErrors>

  /**
   * チェックポイント復元
   */
  readonly restoreFromCheckpoint: (
    sessionId: GenerationSessionId,
    checkpointId: string
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * チェックポイント一覧取得
   */
  readonly listCheckpoints: (sessionId: GenerationSessionId) => Effect.Effect<
    ReadonlyArray<{
      readonly id: string
      readonly createdAt: Date
      readonly size: number
      readonly chunkCount: number
    }>,
    AllRepositoryErrors
  >
}

export interface SessionHistoryEntry {
  readonly timestamp: Date
  readonly action: string
  readonly details: JsonValue
  readonly actor: string
}

/**
 * セッション復旧機能インターフェース
 */
export interface SessionRecoveryOperations {
  /**
   * セッション復旧可能性分析
   */
  readonly analyzeRecovery: (sessionId: GenerationSessionId) => Effect.Effect<SessionRecoveryInfo, AllRepositoryErrors>

  /**
   * セッション復旧実行
   */
  readonly recoverSession: (
    sessionId: GenerationSessionId,
    options?: {
      readonly strategy?: 'conservative' | 'aggressive'
      readonly skipCorrupted?: boolean
      readonly maxRetries?: number
    }
  ) => Effect.Effect<void, AllRepositoryErrors>

  // === Session History & Cleanup ===

  /**
   * セッション履歴取得
   */
  readonly getSessionHistory: (
    sessionId: GenerationSessionId
  ) => Effect.Effect<ReadonlyArray<SessionHistoryEntry>, AllRepositoryErrors>

  /**
   * 完了セッションアーカイブ
   */
  readonly archiveCompletedSessions: (olderThan: Date) => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 古いチェックポイント削除
   */
  readonly cleanupOldCheckpoints: (
    sessionId: GenerationSessionId,
    keepCount?: number
  ) => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 孤立セッション検出
   */
  readonly findOrphanedSessions: () => Effect.Effect<ReadonlyArray<GenerationSessionId>, AllRepositoryErrors>

  // === Statistics & Monitoring ===

  /**
   * セッション統計取得
   */
  readonly getStatistics: () => Effect.Effect<SessionStatistics, AllRepositoryErrors>

  /**
   * セッション数取得
   */
  readonly count: (query?: Partial<SessionQuery>) => Effect.Effect<number, AllRepositoryErrors>

  /**
   * セッション健全性チェック
   */
  readonly healthCheck: (sessionId: GenerationSessionId) => Effect.Effect<
    {
      readonly isHealthy: boolean
      readonly issues: readonly string[]
      readonly recommendations: readonly string[]
    },
    AllRepositoryErrors
  >

  // === Repository Management ===

  /**
   * リポジトリ初期化
   */
  readonly initialize: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * リポジトリクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * データ整合性検証
   */
  readonly validateIntegrity: () => Effect.Effect<
    {
      readonly isValid: boolean
      readonly errors: ReadonlyArray<string>
      readonly warnings: ReadonlyArray<string>
    },
    AllRepositoryErrors
  >
}

// === Context Tag Definition ===

/**
 * Generation Session Repository Context Tag
 */
export const GenerationSessionRepository = Context.GenericTag<GenerationSessionRepository>(
  '@minecraft/domain/world/repository/GenerationSessionRepository'
)

// === Helper Types ===

/**
 * Repository設定
 */
export interface GenerationSessionRepositoryConfig {
  readonly storage: {
    readonly type: 'memory' | 'indexeddb' | 'filesystem'
    readonly location?: string
    readonly maxSessions?: number
  }
  readonly checkpointing: {
    readonly enabled: boolean
    readonly intervalMs: number
    readonly maxCheckpoints: number
    readonly compressionEnabled: boolean
  }
  readonly recovery: {
    readonly autoRecoveryEnabled: boolean
    readonly maxRetryAttempts: number
    readonly retryDelayMs: number
    readonly corruptionThreshold: number
  }
  readonly cleanup: {
    readonly archiveAfterDays: number
    readonly deleteAfterDays: number
    readonly maxHistoryEntries: number
  }
}

export const GenerationSessionRepositoryConfigSchema = Schema.Struct({
  storage: Schema.Struct({
    type: Schema.Literal('memory', 'indexeddb', 'filesystem'),
    location: Schema.optional(Schema.String),
    maxSessions: Schema.optional(Schema.Number),
  }),
  checkpointing: Schema.Struct({
    enabled: Schema.Boolean,
    intervalMs: Schema.Number,
    maxCheckpoints: Schema.Number,
    compressionEnabled: Schema.Boolean,
  }),
  recovery: Schema.Struct({
    autoRecoveryEnabled: Schema.Boolean,
    maxRetryAttempts: Schema.Number,
    retryDelayMs: Schema.Number,
    corruptionThreshold: Schema.Number,
  }),
  cleanup: Schema.Struct({
    archiveAfterDays: Schema.Number,
    deleteAfterDays: Schema.Number,
    maxHistoryEntries: Schema.Number,
  }),
})

// === Default Configuration ===

export const defaultGenerationSessionRepositoryConfig: GenerationSessionRepositoryConfig = {
  storage: {
    type: 'memory',
    maxSessions: 1000,
  },
  checkpointing: {
    enabled: true,
    intervalMs: 30000, // 30 seconds
    maxCheckpoints: 5,
    compressionEnabled: true,
  },
  recovery: {
    autoRecoveryEnabled: true,
    maxRetryAttempts: 3,
    retryDelayMs: 5000,
    corruptionThreshold: 0.1, // 10%
  },
  cleanup: {
    archiveAfterDays: 7,
    deleteAfterDays: 30,
    maxHistoryEntries: 100,
  },
}

export { GenerationSessionRepositoryConfigSchema }

// === Utility Functions ===

/**
 * セッション進捗計算
 */
export const calculateProgress = (chunks: ReadonlyArray<ChunkGenerationTask>): GenerationProgress => {
  const totalChunks = chunks.length
  const completedChunks = chunks.filter((c) => c.status === 'completed').length
  const failedChunks = chunks.filter((c) => c.status === 'failed').length
  const pendingChunks = chunks.filter((c) => c.status === 'pending' || c.status === 'running').length

  const overallProgress = totalChunks > 0 ? completedChunks / totalChunks : 0

  // Calculate timing statistics
  const completedChunksWithTiming = chunks.filter((c) => c.status === 'completed' && c.startedAt && c.completedAt)

  const totalTime = completedChunksWithTiming.reduce((sum, chunk) => {
    const completedAt = Option.fromNullable(chunk.completedAt)
    const startedAt = Option.fromNullable(chunk.startedAt)
    return pipe(
      Option.all([completedAt, startedAt]),
      Option.match({
        onNone: () => sum,
        onSome: ([completed, started]) => sum + (completed.getTime() - started.getTime()),
      })
    )
  }, 0)

  const chunksPerSecond =
    completedChunksWithTiming.length > 0 ? (completedChunksWithTiming.length * 1000) / totalTime : 0

  const estimatedTimeRemaining = chunksPerSecond > 0 ? (pendingChunks / chunksPerSecond) * 1000 : null

  return {
    totalChunks,
    completedChunks,
    failedChunks,
    pendingChunks,
    currentStage: 'terrain_generation', // This should be calculated based on current state
    overallProgress,
    estimatedTimeRemaining,
    chunksPerSecond,
    stageTiming: {}, // This should be calculated from chunk timing data
  }
}

/**
 * デフォルトセッションメタデータ作成
 */
export const createDefaultSessionMetadata = (
  overrides?: Partial<GenerationSessionMetadata>
): GenerationSessionMetadata => ({
  version: '1.0.0',
  environment: 'development',
  generator: 'default',
  seed: 'random',
  tags: [],
  priority: 'normal',
  autoPause: false,
  autoRecover: true,
  maxRetries: 3,
  timeout: 3600000, // 1 hour
  checkpointInterval: 30000, // 30 seconds
  ...overrides,
})

// === Type Exports ===

export type {
  ChunkGenerationTask,
  GenerationProgress,
  GenerationSession,
  GenerationSessionMetadata,
  GenerationSessionRepositoryConfig,
  SessionBatchResult,
  SessionQuery,
  SessionRecoveryInfo,
  SessionState,
  SessionStatistics,
}
