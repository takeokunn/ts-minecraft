/**
 * Statistical Analyzer Service - 統計解析ドメインサービス
 */

import type { GenerationError } from '@domain/world/types/errors'
import { Context, Effect, Layer } from 'effect'

export interface StatisticalAnalyzerService {
  readonly calculateMean: (values: ReadonlyArray<number>) => Effect.Effect<number, GenerationError>
  readonly calculateStandardDeviation: (values: ReadonlyArray<number>) => Effect.Effect<number, GenerationError>
  readonly calculatePercentile: (
    values: ReadonlyArray<number>,
    percentile: number
  ) => Effect.Effect<number, GenerationError>
}

export const StatisticalAnalyzerService = Context.GenericTag<StatisticalAnalyzerService>(
  '@minecraft/domain/world/StatisticalAnalyzer'
)

const emptyArrayError: GenerationError = {
  type: 'StatisticalError',
  message: 'Empty array',
} as GenerationError

const ensureNonEmpty = (values: ReadonlyArray<number>) =>
  Effect.succeed(values).pipe(Effect.filterOrFail((xs) => xs.length > 0, () => emptyArrayError))

export const StatisticalAnalyzerServiceLive = Layer.effect(
  StatisticalAnalyzerService,
  Effect.succeed({
    calculateMean: (values) =>
      ensureNonEmpty(values).pipe(
        Effect.map((nonEmpty) => nonEmpty.reduce((acc, val) => acc + val, 0) / nonEmpty.length)
      ),
    calculateStandardDeviation: (values) =>
      ensureNonEmpty(values).pipe(
        Effect.map((nonEmpty) => {
          const mean = nonEmpty.reduce((acc, val) => acc + val, 0) / nonEmpty.length
          const variance = nonEmpty.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nonEmpty.length
          return Math.sqrt(variance)
        })
      ),
    calculatePercentile: (values, percentile) =>
      ensureNonEmpty(values).pipe(
        Effect.map((nonEmpty) => {
          const sorted = [...nonEmpty].sort((a, b) => a - b)
          const index = Math.ceil((percentile / 100) * sorted.length) - 1
          return sorted[Math.max(0, index)]
        })
      ),
  })
)
