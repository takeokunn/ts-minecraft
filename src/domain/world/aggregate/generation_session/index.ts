/**
 * @fileoverview GenerationSession Aggregate Index
 *
 * GenerationSession集約の統合エクスポート
 */

// ================================
// Core Aggregate
// ================================

export {
  GenerationRequestSchema,
  GenerationSessionIdSchema,
  GenerationSessionLive,
  // Schemas
  GenerationSessionSchema,
  // Service
  GenerationSessionTag,
  SessionConfigurationSchema,
  completeBatch,
  // Operations
  create,
  // Factory Functions
  createGenerationSessionId,
  failBatch,
  pause,
  resume,
  start,
  type GenerationRequest,
  // Types
  type GenerationSession,
  type GenerationSessionId,
  type SessionConfiguration,
} from './generation_session.js'

// ================================
// Session State
// ================================

export {
  BatchStatusSchema,
  ChunkBatchSchema,
  ExecutionContextSchema,
  // Schemas
  SessionStateSchema,
  SessionStatusSchema,
  cancelSession,
  completeSession,
  completeBatch as completeStateBatch,
  // Operations
  createInitial as createInitialState,
  failBatch as failStateBatch,
  // Query Functions
  getBatch,
  getNextExecutableBatch,
  getProgressStatistics,
  isSessionCompleted,
  pauseSession,
  resumeSession,
  scheduleRetry,
  startBatch,
  startSession,
  type BatchStatus,
  type ChunkBatch,
  type ExecutionContext,
  // Types
  type SessionState,
  type SessionStatus,
} from './session_state.js'

// ================================
// Progress Tracking
// ================================

export {
  PerformanceMetricsSchema,
  // Schemas
  ProgressDataSchema,
  ProgressStatisticsSchema,
  TimeTrackingSchema,
  completeTracking,
  // Operations
  createInitial as createInitialProgress,
  generateProgressReport,
  getAchievedMilestones,
  // Query Functions
  getProgressVelocity,
  isCompleted,
  pauseTracking,
  resumeTracking,
  startTracking,
  updateProgress,
  type PerformanceMetrics,
  // Types
  type ProgressData,
  type ProgressStatistics,
  type TimeTracking,
} from './progress_tracking.js'

// ================================
// Error Handling
// ================================

export {
  ErrorAnalysisSchema,
  ErrorCategorySchema,
  ErrorSeveritySchema,
  RetryStrategySchema,
  // Schemas
  SessionErrorSchema,
  analyzeErrors,
  calculateRetryDelay,
  // Operations
  createSessionError,
  shouldRetryBatch,
  suggestRecoveryStrategy,
  type ErrorAnalysis,
  type ErrorCategory,
  type ErrorSeverity,
  type RetryStrategy,
  // Types
  type SessionError,
} from './error_handling.js'

// ================================
// Session Events
// ================================

export {
  BaseSessionEventSchema,
  BatchCompletedSchema,
  BatchFailedSchema,
  BatchRetriedSchema,
  BatchStartedSchema,
  // Implementations
  InMemorySessionEventPublisher,
  ProgressUpdatedSchema,
  SessionCompletedSchema,
  SessionCreatedSchema,
  // Service Tags
  SessionEventPublisherTag,
  // Event Schemas
  SessionEventSchema,
  SessionFailedSchema,
  SessionPausedSchema,
  SessionResumedSchema,
  SessionStartedSchema,
  createBatchCompleted,
  createBatchFailed,
  createSessionCompleted,
  // Event Factory Functions
  createSessionCreated,
  createSessionPaused,
  createSessionResumed,
  createSessionStarted,
  // Event Services
  publish as publishSessionEvent,
  subscribe as subscribeToSessionEvents,
  type BaseSessionEvent,
  type BatchCompleted,
  type BatchFailed,
  type BatchRetried,
  type BatchStarted,
  type ProgressUpdated,
  type SessionCompleted,
  type SessionCreated,
  // Event Types
  type SessionEvent,
  type SessionEventPublisher,
  type SessionFailed,
  type SessionPaused,
  type SessionResumed,
  type SessionStarted,
} from './events.js'
