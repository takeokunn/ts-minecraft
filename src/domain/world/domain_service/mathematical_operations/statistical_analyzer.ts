/**
 * Statistical Analyzer Service - 統計解析ドメインサービス
 */

import { Context, Effect, Layer } from 'effect'
import type { GenerationError } from '../../types/errors/generation_errors.js'

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

export const StatisticalAnalyzerServiceLive = Layer.effect(
  StatisticalAnalyzerService,
  Effect.succeed({
    calculateMean: (values) => {
      if (values.length === 0)
        return Effect.fail({ type: 'StatisticalError', message: 'Empty array' } as GenerationError)
      const sum = values.reduce((acc, val) => acc + val, 0)
      return Effect.succeed(sum / values.length)
    },
    calculateStandardDeviation: (values) => {
      if (values.length === 0)
        return Effect.fail({ type: 'StatisticalError', message: 'Empty array' } as GenerationError)
      const mean = values.reduce((acc, val) => acc + val, 0) / values.length
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
      return Effect.succeed(Math.sqrt(variance))
    },
    calculatePercentile: (values, percentile) => {
      if (values.length === 0)
        return Effect.fail({ type: 'StatisticalError', message: 'Empty array' } as GenerationError)
      const sorted = [...values].sort((a, b) => a - b)
      const index = Math.ceil((percentile / 100) * sorted.length) - 1
      return Effect.succeed(sorted[Math.max(0, index)])
    },
  })
)
