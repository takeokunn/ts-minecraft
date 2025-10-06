import * as GenerationSession from '@domain/world/aggregate/generation_session.js'
import { Function, Match } from 'effect'
import * as Effect from 'effect/Effect'
import type {
  ConfigurationProfile,
  HardwareSpec,
  LoadCondition,
  OptimizationParams,
  SessionConfigurationBuilderState,
} from './configuration_builder_state.js'
import type { SessionFactoryError } from './errors.js'

/**
 * Profile適用関数
 */
export const applyProfile = (
  state: SessionConfigurationBuilderState,
  profile: ConfigurationProfile
): SessionConfigurationBuilderState => {
  const profileConfig = Function.pipe(
    Match.value(profile),
    Match.when('development', () => createDevelopmentProfile()),
    Match.when('testing', () => createTestingProfile()),
    Match.when('staging', () => createStagingProfile()),
    Match.when('production', () => createProductionProfile()),
    Match.when('high_performance', () => createHighPerformanceProfile()),
    Match.when('memory_constrained', () => createMemoryConstrainedProfile()),
    Match.when('low_latency', () => createLowLatencyProfile()),
    Match.when('batch_processing', () => createBatchProcessingProfile()),
    Match.orElse(() => createProductionProfile())
  )

  return {
    ...state,
    ...profileConfig,
  }
}

/**
 * Hardware適応関数
 */
export const adaptToHardware = (
  state: SessionConfigurationBuilderState,
  spec: HardwareSpec
): SessionConfigurationBuilderState => {
  const optimalConcurrency = Math.min(spec.cpuCores * 2, 16)
  const optimalBatchSize = Math.min(Math.floor(spec.memoryMB / 100), 64)
  const baseTimeout = spec.storageSpeedMBps > 500 ? 15000 : 30000

  return {
    ...state,
    maxConcurrentChunks: optimalConcurrency,
    chunkBatchSize: optimalBatchSize,
    timeoutPolicy: {
      chunkTimeoutMs: baseTimeout,
      sessionTimeoutMs: baseTimeout * 20,
      gracefulShutdownMs: Math.min(5000, baseTimeout / 3),
      ...state.timeoutPolicy,
    },
  }
}

/**
 * Load適応関数
 */
export const adaptToLoad = (
  state: SessionConfigurationBuilderState,
  condition: LoadCondition
): SessionConfigurationBuilderState => {
  const cpuAdjustment = 1 - (condition.currentCpuUsage / 100) * 0.5
  const memoryAdjustment = 1 - (condition.currentMemoryUsage / 100) * 0.3
  const adjustment = Math.min(cpuAdjustment, memoryAdjustment)
  const adjustedConcurrency = Math.max(1, Math.floor((state.maxConcurrentChunks ?? 4) * adjustment))
  const timeoutMultiplier = Math.max(1, condition.networkLatencyMs / 100)

  return {
    ...state,
    maxConcurrentChunks: adjustedConcurrency,
    timeoutPolicy: {
      chunkTimeoutMs: Math.floor((state.timeoutPolicy?.chunkTimeoutMs ?? 30000) * timeoutMultiplier),
      sessionTimeoutMs: Math.floor((state.timeoutPolicy?.sessionTimeoutMs ?? 600000) * timeoutMultiplier),
      gracefulShutdownMs: state.timeoutPolicy?.gracefulShutdownMs ?? 5000,
      ...state.timeoutPolicy,
    },
  }
}

/**
 * Concurrency設定関数
 */
export const withConcurrency = (
  state: SessionConfigurationBuilderState,
  maxChunks: number,
  batchSize: number
): SessionConfigurationBuilderState => ({
  ...state,
  maxConcurrentChunks: Math.max(1, Math.min(16, maxChunks)),
  chunkBatchSize: Math.max(1, Math.min(64, batchSize)),
})

/**
 * Timeouts設定関数
 */
export const withTimeouts = (
  state: SessionConfigurationBuilderState,
  chunk: number,
  session: number,
  shutdown?: number
): SessionConfigurationBuilderState => ({
  ...state,
  timeoutPolicy: {
    chunkTimeoutMs: Math.max(1000, chunk),
    sessionTimeoutMs: Math.max(chunk * 2, session),
    gracefulShutdownMs: shutdown ?? Math.min(5000, chunk / 2),
  },
})

/**
 * Retry policy設定関数
 */
export const withRetry = (
  state: SessionConfigurationBuilderState,
  maxAttempts: number,
  strategy: 'linear' | 'exponential' | 'constant',
  baseDelay: number,
  maxDelay?: number
): SessionConfigurationBuilderState => ({
  ...state,
  retryPolicy: {
    maxAttempts: Math.max(1, Math.min(10, maxAttempts)),
    backoffStrategy: strategy,
    baseDelayMs: Math.max(100, baseDelay),
    maxDelayMs: maxDelay ?? Math.max(baseDelay * 10, 30000),
  },
})

/**
 * Priority policy設定関数
 */
export const withPriority = (
  state: SessionConfigurationBuilderState,
  enableQueuing: boolean,
  threshold: number = 5,
  weight: number = 2.0
): SessionConfigurationBuilderState => ({
  ...state,
  priorityPolicy: {
    enablePriorityQueuing: enableQueuing,
    priorityThreshold: Math.max(1, Math.min(10, threshold)),
    highPriorityWeight: Math.max(1.0, Math.min(10.0, weight)),
  },
})

/**
 * Constraints適用関数
 */
export const withConstraints = (
  state: SessionConfigurationBuilderState,
  constraints: OptimizationParams['constraints']
): SessionConfigurationBuilderState => {
  if (!constraints) return state

  const maxConcurrency = constraints.maxConcurrentOperations
    ? Math.min(state.maxConcurrentChunks ?? 4, constraints.maxConcurrentOperations)
    : state.maxConcurrentChunks

  const chunkTimeout = constraints.maxExecutionTimeMs
    ? Math.min(state.timeoutPolicy?.chunkTimeoutMs ?? 30000, constraints.maxExecutionTimeMs / 10)
    : state.timeoutPolicy?.chunkTimeoutMs

  return {
    ...state,
    maxConcurrentChunks: maxConcurrency,
    timeoutPolicy: {
      ...state.timeoutPolicy,
      chunkTimeoutMs: chunkTimeout ?? 30000,
      sessionTimeoutMs: state.timeoutPolicy?.sessionTimeoutMs ?? 600000,
      gracefulShutdownMs: state.timeoutPolicy?.gracefulShutdownMs ?? 5000,
    },
  }
}

/**
 * 最適化関数
 */
export const optimize = (
  state: SessionConfigurationBuilderState,
  params: OptimizationParams
): Effect.Effect<SessionConfigurationBuilderState, SessionFactoryError> =>
  Effect.gen(function* () {
    let builder = applyProfile(state, params.profile)

    if (params.hardwareSpec) {
      builder = adaptToHardware(builder, params.hardwareSpec)
    }

    if (params.loadCondition) {
      builder = adaptToLoad(builder, params.loadCondition)
    }

    if (params.prioritizeFor) {
      builder = yield* applyPrioritization(builder, params.prioritizeFor)
    }

    if (params.constraints) {
      builder = withConstraints(builder, params.constraints)
    }

    return builder
  })

/**
 * Build関数
 */
export const build = (
  state: SessionConfigurationBuilderState
): Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError> =>
  Effect.succeed({
    maxConcurrentChunks: state.maxConcurrentChunks ?? 4,
    chunkBatchSize: state.chunkBatchSize ?? 8,
    retryPolicy: state.retryPolicy ?? {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    },
    timeoutPolicy: state.timeoutPolicy ?? {
      chunkTimeoutMs: 30000,
      sessionTimeoutMs: 600000,
      gracefulShutdownMs: 5000,
    },
    priorityPolicy: state.priorityPolicy ?? {
      enablePriorityQueuing: false,
      priorityThreshold: 5,
      highPriorityWeight: 2.0,
    },
  })

// ================================
// Private Helper Functions
// ================================

const createDevelopmentProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 2,
  chunkBatchSize: 4,
  retryPolicy: {
    maxAttempts: 2,
    backoffStrategy: 'linear',
    baseDelayMs: 500,
    maxDelayMs: 2000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 60000,
    sessionTimeoutMs: 300000,
    gracefulShutdownMs: 10000,
  },
})

const createTestingProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 1,
  chunkBatchSize: 1,
  retryPolicy: {
    maxAttempts: 1,
    backoffStrategy: 'constant',
    baseDelayMs: 100,
    maxDelayMs: 100,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 10000,
    sessionTimeoutMs: 60000,
    gracefulShutdownMs: 1000,
  },
})

const createStagingProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 4,
  chunkBatchSize: 8,
  retryPolicy: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 5000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 30000,
    sessionTimeoutMs: 600000,
    gracefulShutdownMs: 5000,
  },
})

const createProductionProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 4,
  chunkBatchSize: 8,
  retryPolicy: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 30000,
    sessionTimeoutMs: 600000,
    gracefulShutdownMs: 5000,
  },
  priorityPolicy: {
    enablePriorityQueuing: true,
    priorityThreshold: 7,
    highPriorityWeight: 3.0,
  },
})

const createHighPerformanceProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 16,
  chunkBatchSize: 32,
  retryPolicy: {
    maxAttempts: 2,
    backoffStrategy: 'linear',
    baseDelayMs: 200,
    maxDelayMs: 1000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 10000,
    sessionTimeoutMs: 300000,
    gracefulShutdownMs: 2000,
  },
})

const createMemoryConstrainedProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 1,
  chunkBatchSize: 2,
  retryPolicy: {
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    baseDelayMs: 2000,
    maxDelayMs: 30000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 60000,
    sessionTimeoutMs: 1800000,
    gracefulShutdownMs: 15000,
  },
})

const createLowLatencyProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 8,
  chunkBatchSize: 1,
  retryPolicy: {
    maxAttempts: 1,
    backoffStrategy: 'constant',
    baseDelayMs: 50,
    maxDelayMs: 50,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 5000,
    sessionTimeoutMs: 30000,
    gracefulShutdownMs: 500,
  },
})

const createBatchProcessingProfile = (): Partial<SessionConfigurationBuilderState> => ({
  maxConcurrentChunks: 8,
  chunkBatchSize: 64,
  retryPolicy: {
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    baseDelayMs: 5000,
    maxDelayMs: 60000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 120000,
    sessionTimeoutMs: 3600000,
    gracefulShutdownMs: 30000,
  },
})

const applyPrioritization = (
  builder: SessionConfigurationBuilderState,
  prioritizeFor: 'speed' | 'memory' | 'stability' | 'quality'
): Effect.Effect<SessionConfigurationBuilderState, SessionFactoryError> =>
  Function.pipe(
    Match.value(prioritizeFor),
    Match.when('speed', () =>
      Effect.succeed(
        withPriority(
          withRetry(withConcurrency(withTimeouts(builder, 5000, 60000, 1000), 16, 32), 1, 'constant', 100),
          false
        )
      )
    ),
    Match.when('memory', () =>
      Effect.succeed(
        withRetry(withConcurrency(withTimeouts(builder, 60000, 1800000, 15000), 1, 2), 5, 'exponential', 2000, 30000)
      )
    ),
    Match.when('stability', () =>
      Effect.succeed(
        withPriority(
          withRetry(withConcurrency(withTimeouts(builder, 45000, 900000, 10000), 2, 4), 5, 'exponential', 2000, 30000),
          true,
          3,
          4.0
        )
      )
    ),
    Match.when('quality', () =>
      Effect.succeed(
        withRetry(withConcurrency(withTimeouts(builder, 120000, 3600000, 30000), 1, 1), 3, 'exponential', 3000, 60000)
      )
    ),
    Match.orElse(() => Effect.succeed(builder))
  )
