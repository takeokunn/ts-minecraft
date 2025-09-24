import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { ErrorReporter } from '../ErrorReporter'

describe('ErrorReporter', () => {
  describe('Error Reporting and Analytics', () => {
    it.effect('reports errors with proper categorization', () =>
      Effect.gen(function* () {
        const error = new Error('Test error')
        yield* ErrorReporter.reportError(error, 'critical')

        const stats = yield* ErrorReporter.getErrorStats()
        expect(stats.critical).toBeGreaterThan(0)
        expect(stats.total).toBeGreaterThan(0)
      })
    )

    it.effect('aggregates error statistics', () =>
      Effect.gen(function* () {
        // Report multiple errors
        yield* ErrorReporter.reportError(new Error('Error 1'), 'critical')
        yield* ErrorReporter.reportError(new Error('Error 2'), 'warning')
        yield* ErrorReporter.reportError(new Error('Error 3'), 'critical')

        const stats = yield* ErrorReporter.getErrorStats()
        expect(stats.total).toBeGreaterThanOrEqual(3)
        expect(stats.critical).toBeGreaterThanOrEqual(2)
        expect(stats.warning).toBeGreaterThanOrEqual(1)
      })
    )
  })
})
