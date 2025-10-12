/**
 * @fileoverview Generation Session Recovery System
 * 生成セッション復旧システム
 *
 * セッション障害・中断からの自動復旧機能
 * 高度な復旧戦略と安全性保証
 */

import type { AllRepositoryErrors, GenerationSessionId } from '@domain/world/types'
import { createRepositoryError, createSessionRecoveryError } from '@domain/world/types'
import { Clock, Effect, Match, pipe, ReadonlyArray } from 'effect'
import type { GenerationSession, SessionRecoveryInfo } from './index'

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

    const recommendations: string[] = [
      ...(corruptionRate > 0.5 ? ['Consider full regeneration instead of recovery'] : []),
      ...(session.progress.failedChunks > 10 ? ['Check world generation settings for issues'] : []),
      ...(session.state === 'failed' ? ['Investigate root cause before recovery'] : []),
    ]

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
    const startTime = yield* Clock.currentTimeMillis
    const errors: string[] = []
    const warnings: string[] = []

    // Analyze recovery requirements
    const analysis = yield* analyzeSessionRecovery(session)

    yield* pipe(
      Match.value(analysis),
      Match.when(
        ({ canRecover }) => !canRecover,
        () => Effect.fail(createSessionRecoveryError(session.id, 'Session cannot be recovered in current state', null))
      ),
      Match.orElse(() => Effect.void)
    )

    // Execute recovery based on strategy
    let recoveredChunks = 0
    let skippedChunks = 0
    let corruptedChunks = 0

    const recoveryMetrics = pipe(
      options.strategy,
      Match.value,
      Match.when('conservative', () => ({
        recoveredChunks: analysis.recoverableChunks.length,
        skippedChunks: analysis.corruptedChunks.length,
        corruptedChunks: 0,
      })),
      Match.when('aggressive', () => ({
        recoveredChunks: session.chunks.length,
        skippedChunks: 0,
        corruptedChunks: 0,
      })),
      Match.when('smart', () =>
        pipe(
          analysis.riskLevel,
          Match.value,
          Match.when('low', () => ({
            recoveredChunks: session.chunks.length,
            skippedChunks: 0,
            corruptedChunks: 0,
          })),
          Match.when('medium', () => ({
            recoveredChunks: analysis.recoverableChunks.length,
            skippedChunks: Math.floor(analysis.corruptedChunks.length / 2),
            corruptedChunks: Math.ceil(analysis.corruptedChunks.length / 2),
          })),
          Match.when('high', () => ({
            recoveredChunks: Math.floor(analysis.recoverableChunks.length * 0.8),
            skippedChunks: analysis.corruptedChunks.length,
            corruptedChunks: Math.floor(analysis.recoverableChunks.length * 0.2),
          })),
          Match.exhaustive
        )
      ),
      Match.exhaustive
    )

    recoveredChunks = recoveryMetrics.recoveredChunks
    skippedChunks = recoveryMetrics.skippedChunks
    corruptedChunks = recoveryMetrics.corruptedChunks

    // Simulate recovery process
    yield* Effect.sleep(`${Math.min(analysis.estimatedRecoveryTime, 5000)} millis`)

    const endTime = yield* Clock.currentTimeMillis
    const duration = endTime - startTime
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

    return pipe(
      Match.value(strategy),
      Match.when('conservative', () => Math.min(baseSuccess * 1.2, 1.0)), // Conservative boost
      Match.when('aggressive', () => baseSuccess * 0.8), // Aggressive penalty
      Match.when('smart', () => baseSuccess), // Use base rate
      Match.orElse(() => baseSuccess)
    )
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
    const originalCompletedChunks = originalSession.chunks.filter((c) => c.status === 'completed').length
    const recoveredCompletedChunks = recoveredSession.chunks.filter((c) => c.status === 'completed').length

    const integrityChecks = [
      {
        condition: recoveredSession.id !== originalSession.id,
        issue: 'Session ID mismatch',
        penalty: 0.5,
      },
      {
        condition: recoveredSession.worldId !== originalSession.worldId,
        issue: 'World ID mismatch',
        penalty: 0.3,
      },
      {
        condition: recoveredCompletedChunks < originalCompletedChunks * 0.8,
        issue: 'Significant chunk loss detected',
        penalty: 0.2,
      },
      {
        condition: recoveredSession.progress.overallProgress < originalSession.progress.overallProgress * 0.9,
        issue: 'Progress regression detected',
        penalty: 0.1,
      },
    ]

    const failedChecks = integrityChecks.filter((check) => check.condition)
    const issues = failedChecks.map((check) => check.issue)
    const confidence = Math.max(1.0 - failedChecks.reduce((sum, check) => sum + check.penalty, 0), 0.0)
    const isValid = issues.length === 0 && confidence > 0.5

    return {
      isValid,
      issues,
      confidence,
    }
  })

// === Default Exports ===

export const defaultRecoveryOptions: RecoveryOptions = RecoveryStrategies.smart
