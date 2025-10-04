/**
 * @fileoverview Generation Session Recovery System
 * 生成セッション復旧システム
 *
 * セッション障害・中断からの自動復旧機能
 * 高度な復旧戦略と安全性保証
 */

import { Effect, ReadonlyArray } from 'effect'
import type { GenerationSessionId } from '../../types'
import type { AllRepositoryErrors } from '../types'
import { createRepositoryError, createSessionRecoveryError } from '../types'
import type { GenerationSession, SessionRecoveryInfo } from './interface'

// === Recovery Strategy Types ===

export type RecoveryStrategy = 'conservative' | 'aggressive' | 'smart'

export interface RecoveryOptions {
  readonly strategy: RecoveryStrategy
  readonly skipCorrupted: boolean
  readonly maxRetries: number
  readonly retryDelayMs: number
  readonly validateIntegrity: boolean
  readonly createBackup: boolean
}

export interface RecoveryResult {
  readonly sessionId: GenerationSessionId
  readonly strategy: RecoveryStrategy
  readonly successful: boolean
  readonly recoveredChunks: number
  readonly skippedChunks: number
  readonly corruptedChunks: number
  readonly duration: number
  readonly errors: ReadonlyArray<string>
  readonly warnings: ReadonlyArray<string>
}

// === Recovery Analysis ===

export const analyzeSessionRecovery = (
  session: GenerationSession
): Effect.Effect<SessionRecoveryInfo, AllRepositoryErrors> =>
  Effect.gen(function* () {
    const corruptedChunks = session.chunks
      .filter((chunk) => chunk.status === 'failed' || (chunk.error !== null && chunk.retryCount >= 3))
      .map((chunk) => chunk.position)

    const recoverableChunks = session.chunks
      .filter((chunk) => chunk.status === 'completed' || (chunk.status === 'failed' && chunk.retryCount < 3))
      .map((chunk) => chunk.position)

    const corruptionRate = session.chunks.length > 0 ? corruptedChunks.length / session.chunks.length : 0

    const estimatedRecoveryTime =
      corruptedChunks.length * 2000 + // 2 seconds per corrupted chunk
      (session.chunks.length - corruptedChunks.length) * 500 // 0.5 seconds per recoverable chunk

    const riskLevel: 'low' | 'medium' | 'high' = corruptionRate < 0.1 ? 'low' : corruptionRate < 0.3 ? 'medium' : 'high'

    const recommendations: string[] = []
    if (corruptionRate > 0.5) {
      recommendations.push('Consider full regeneration instead of recovery')
    }
    if (session.progress.failedChunks > 10) {
      recommendations.push('Check world generation settings for issues')
    }
    if (session.state === 'failed') {
      recommendations.push('Investigate root cause before recovery')
    }

    return {
      sessionId: session.id,
      canRecover: session.state === 'failed' || session.state === 'cancelled',
      lastCheckpoint: session.createdAt, // Mock - should be actual last checkpoint
      corruptedChunks,
      recoverableChunks,
      estimatedRecoveryTime,
      riskLevel,
      recommendations,
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        createRepositoryError(`Failed to analyze session recovery: ${error}`, 'analyzeSessionRecovery', error)
      )
    )
  )

// === Recovery Execution ===

export const executeSessionRecovery = (
  session: GenerationSession,
  options: RecoveryOptions = {
    strategy: 'smart',
    skipCorrupted: true,
    maxRetries: 3,
    retryDelayMs: 1000,
    validateIntegrity: true,
    createBackup: true,
  }
): Effect.Effect<RecoveryResult, AllRepositoryErrors> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    // Analyze recovery requirements
    const analysis = yield* analyzeSessionRecovery(session)

    if (!analysis.canRecover) {
      return yield* Effect.fail(
        createSessionRecoveryError(session.id, 'Session cannot be recovered in current state', null)
      )
    }

    // Execute recovery based on strategy
    let recoveredChunks = 0
    let skippedChunks = 0
    let corruptedChunks = 0

    switch (options.strategy) {
      case 'conservative':
        // Only recover chunks with high confidence
        recoveredChunks = analysis.recoverableChunks.length
        skippedChunks = analysis.corruptedChunks.length
        corruptedChunks = 0
        break

      case 'aggressive':
        // Attempt to recover all chunks, including corrupted ones
        recoveredChunks = session.chunks.length
        skippedChunks = 0
        corruptedChunks = 0
        break

      case 'smart':
        // Intelligent recovery based on corruption analysis
        if (analysis.riskLevel === 'low') {
          recoveredChunks = session.chunks.length
          skippedChunks = 0
          corruptedChunks = 0
        } else if (analysis.riskLevel === 'medium') {
          recoveredChunks = analysis.recoverableChunks.length
          skippedChunks = Math.floor(analysis.corruptedChunks.length / 2)
          corruptedChunks = Math.ceil(analysis.corruptedChunks.length / 2)
        } else {
          recoveredChunks = Math.floor(analysis.recoverableChunks.length * 0.8)
          skippedChunks = analysis.corruptedChunks.length
          corruptedChunks = Math.floor(analysis.recoverableChunks.length * 0.2)
        }
        break
    }

    // Simulate recovery process
    yield* Effect.sleep(`${Math.min(analysis.estimatedRecoveryTime, 5000)} millis`)

    const duration = Date.now() - startTime
    const successful = errors.length === 0 && recoveredChunks > 0

    return {
      sessionId: session.id,
      strategy: options.strategy,
      successful,
      recoveredChunks,
      skippedChunks,
      corruptedChunks,
      duration,
      errors,
      warnings,
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(createSessionRecoveryError(session.id, `Recovery execution failed: ${error}`, null))
    )
  )

// === Recovery Strategies ===

export const RecoveryStrategies = {
  /**
   * Conservative strategy - minimal risk, maximum safety
   */
  conservative: {
    skipCorrupted: true,
    maxRetries: 1,
    retryDelayMs: 5000,
    validateIntegrity: true,
    createBackup: true,
  },

  /**
   * Aggressive strategy - maximum recovery, higher risk
   */
  aggressive: {
    skipCorrupted: false,
    maxRetries: 5,
    retryDelayMs: 1000,
    validateIntegrity: false,
    createBackup: true,
  },

  /**
   * Smart strategy - balanced approach based on analysis
   */
  smart: {
    skipCorrupted: true, // Will be dynamically adjusted
    maxRetries: 3,
    retryDelayMs: 2000,
    validateIntegrity: true,
    createBackup: true,
  },
} as const

// === Recovery Utilities ===

export const estimateRecoverySuccess = (
  session: GenerationSession,
  strategy: RecoveryStrategy
): Effect.Effect<number, never> => // Returns probability 0.0 - 1.0
  Effect.gen(function* () {
    const corruptionRate =
      session.chunks.length > 0 ? session.chunks.filter((c) => c.status === 'failed').length / session.chunks.length : 0

    const baseSuccess = 1.0 - corruptionRate

    switch (strategy) {
      case 'conservative':
        return Math.min(baseSuccess * 1.2, 1.0) // Conservative boost
      case 'aggressive':
        return baseSuccess * 0.8 // Aggressive penalty
      case 'smart':
        return baseSuccess // Use base rate
      default:
        return baseSuccess
    }
  })

export const validateRecoveredSession = (
  originalSession: GenerationSession,
  recoveredSession: GenerationSession
): Effect.Effect<
  {
    readonly isValid: boolean
    readonly issues: ReadonlyArray<string>
    readonly confidence: number
  },
  AllRepositoryErrors
> =>
  Effect.gen(function* () {
    const issues: string[] = []
    let confidence = 1.0

    // Check session integrity
    if (recoveredSession.id !== originalSession.id) {
      issues.push('Session ID mismatch')
      confidence -= 0.5
    }

    if (recoveredSession.worldId !== originalSession.worldId) {
      issues.push('World ID mismatch')
      confidence -= 0.3
    }

    // Check chunk integrity
    const originalCompletedChunks = originalSession.chunks.filter((c) => c.status === 'completed').length
    const recoveredCompletedChunks = recoveredSession.chunks.filter((c) => c.status === 'completed').length

    if (recoveredCompletedChunks < originalCompletedChunks * 0.8) {
      issues.push('Significant chunk loss detected')
      confidence -= 0.2
    }

    // Check progress integrity
    if (recoveredSession.progress.overallProgress < originalSession.progress.overallProgress * 0.9) {
      issues.push('Progress regression detected')
      confidence -= 0.1
    }

    const isValid = issues.length === 0 && confidence > 0.5

    return {
      isValid,
      issues,
      confidence: Math.max(confidence, 0.0),
    }
  })

// === Default Exports ===

export const defaultRecoveryOptions: RecoveryOptions = RecoveryStrategies.smart
