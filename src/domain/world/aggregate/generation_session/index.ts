/**
 * @fileoverview GenerationSession Aggregate Index
 *
 * GenerationSession集約の統合エクスポート
 */

// ================================
// Core Aggregate
// ================================

export {
  // Types
  type GenerationSession,
  type GenerationSessionId,
  type SessionConfiguration,
  type GenerationRequest,

  // Schemas
  GenerationSessionSchema,
  GenerationSessionIdSchema,
  SessionConfigurationSchema,
  GenerationRequestSchema,

  // Factory Functions
  createGenerationSessionId,

  // Operations
  create,
  start,
  completeBatch,
  failBatch,
  pause,
  resume,

  // Service
  GenerationSessionTag,
  GenerationSessionLive,
} from "./generation_session.js"

// ================================
// Session State
// ================================

export {
  // Types
  type SessionState,
  type SessionStatus,
  type BatchStatus,
  type ChunkBatch,
  type ExecutionContext,

  // Schemas
  SessionStateSchema,
  SessionStatusSchema,
  BatchStatusSchema,
  ChunkBatchSchema,
  ExecutionContextSchema,

  // Operations
  createInitial as createInitialState,
  startSession,
  startBatch,
  completeBatch as completeStateBatch,
  failBatch as failStateBatch,
  scheduleRetry,
  pauseSession,
  resumeSession,
  completeSession,
  cancelSession,

  // Query Functions
  getBatch,
  getNextExecutableBatch,
  getProgressStatistics,
  isSessionCompleted,
} from "./session_state.js"

// ================================
// Progress Tracking
// ================================

export {
  // Types
  type ProgressData,
  type ProgressStatistics,
  type PerformanceMetrics,
  type TimeTracking,

  // Schemas
  ProgressDataSchema,
  ProgressStatisticsSchema,
  PerformanceMetricsSchema,
  TimeTrackingSchema,

  // Operations
  createInitial as createInitialProgress,
  startTracking,
  updateProgress,
  pauseTracking,
  resumeTracking,
  completeTracking,
  isCompleted,
  generateProgressReport,

  // Query Functions
  getProgressVelocity,
  getAchievedMilestones,
} from "./progress_tracking.js"

// ================================
// Error Handling
// ================================

export {
  // Types
  type SessionError,
  type ErrorCategory,
  type ErrorSeverity,
  type RetryStrategy,
  type ErrorAnalysis,

  // Schemas
  SessionErrorSchema,
  ErrorCategorySchema,
  ErrorSeveritySchema,
  RetryStrategySchema,
  ErrorAnalysisSchema,

  // Operations
  createSessionError,
  shouldRetryBatch,
  calculateRetryDelay,
  analyzeErrors,
  suggestRecoveryStrategy,
} from "./error_handling.js"

// ================================
// Session Events
// ================================

export {
  // Event Types
  type SessionEvent,
  type SessionCreated,
  type SessionStarted,
  type SessionPaused,
  type SessionResumed,
  type SessionCompleted,
  type SessionFailed,
  type BatchStarted,
  type BatchCompleted,
  type BatchFailed,
  type BatchRetried,
  type ProgressUpdated,
  type BaseSessionEvent,
  type SessionEventPublisher,

  // Event Schemas
  SessionEventSchema,
  SessionCreatedSchema,
  SessionStartedSchema,
  SessionPausedSchema,
  SessionResumedSchema,
  SessionCompletedSchema,
  SessionFailedSchema,
  BatchStartedSchema,
  BatchCompletedSchema,
  BatchFailedSchema,
  BatchRetriedSchema,
  ProgressUpdatedSchema,
  BaseSessionEventSchema,

  // Event Factory Functions
  createSessionCreated,
  createSessionStarted,
  createSessionPaused,
  createSessionResumed,
  createSessionCompleted,
  createBatchCompleted,
  createBatchFailed,

  // Event Services
  publish as publishSessionEvent,
  subscribe as subscribeToSessionEvents,

  // Service Tags
  SessionEventPublisherTag,

  // Implementations
  InMemorySessionEventPublisher,
} from "./events.js"