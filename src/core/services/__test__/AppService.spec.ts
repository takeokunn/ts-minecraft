import { describe, expect, it as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Exit } from 'effect'
import * as fc from 'fast-check'
import { AppService, AppServiceLive } from '../AppService'

describe('AppService', () => {
  describe('Service Interface', () => {
    it.effect('should initialize successfully', () =>
      Effect.gen(function* () {
        const service = yield* AppService
        const result = yield* service.initialize()

        expect(result).toHaveProperty('success')
        expect(result.success).toBe(true)

        return result
      }).pipe(Effect.provide(AppServiceLive))
    )

    it.effect('should return ready status', () =>
      Effect.gen(function* () {
        const service = yield* AppService
        const status = yield* service.getReadyStatus()

        expect(status).toHaveProperty('ready')
        expect(status.ready).toBe(true)

        return status
      }).pipe(Effect.provide(AppServiceLive))
    )

    it.effect('should handle sequential calls', () =>
      Effect.gen(function* () {
        const service = yield* AppService

        // Initialize multiple times
        const init1 = yield* service.initialize()
        const init2 = yield* service.initialize()

        expect(init1).toEqual(init2)
        expect(init1.success).toBe(true)

        // Get status multiple times
        const status1 = yield* service.getReadyStatus()
        const status2 = yield* service.getReadyStatus()

        expect(status1).toEqual(status2)
        expect(status1.ready).toBe(true)
      }).pipe(Effect.provide(AppServiceLive))
    )
  })

  describe('Layer Behavior', () => {
    vitestIt('should be a valid Layer', () => {
      expect(Layer.isLayer(AppServiceLive)).toBe(true)
    })

    vitestIt('should provide AppService context', () => {
      const program = Effect.gen(function* () {
        const service = yield* AppService
        return service
      })

      const runnable = Effect.provide(program, AppServiceLive)
      const result = Effect.runSync(runnable)

      expect(result).toBeDefined()
      expect(typeof result.initialize).toBe('function')
      expect(typeof result.getReadyStatus).toBe('function')
    })

    vitestIt('should compose with other layers', () => {
      const composedLayer = Layer.merge(AppServiceLive, Layer.empty)
      expect(Layer.isLayer(composedLayer)).toBe(true)
    })
  })

  describe('Effect Integration', () => {
    it.effect('should work with Effect.all', () =>
      Effect.gen(function* () {
        const service = yield* AppService

        const [initResult, status] = yield* Effect.all([
          service.initialize(),
          service.getReadyStatus(),
        ])

        expect(initResult.success).toBe(true)
        expect(status.ready).toBe(true)
      }).pipe(Effect.provide(AppServiceLive))
    )

    it.effect('should work with Effect.forEach', () =>
      Effect.gen(function* () {
        const service = yield* AppService
        const operations = [1, 2, 3]

        const results = yield* Effect.forEach(operations, () =>
          service.initialize()
        )

        expect(results).toHaveLength(3)
        results.forEach(result => {
          expect(result.success).toBe(true)
        })
      }).pipe(Effect.provide(AppServiceLive))
    )

    it.effect('should handle Effect.retry patterns', () =>
      Effect.gen(function* () {
        const service = yield* AppService

        const result = yield* service.initialize().pipe(
          Effect.retry({ times: 3 })
        )

        expect(result.success).toBe(true)
      }).pipe(Effect.provide(AppServiceLive))
    )
  })

  describe('Error Handling', () => {
    vitestIt('should handle missing service context', () => {
      const program = Effect.gen(function* () {
        const service = yield* AppService
        return yield* service.initialize()
      })

      // Without providing the service
      const exit = Effect.runSyncExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it.effect('should work with Effect.catchAll', () =>
      Effect.gen(function* () {
        const service = yield* AppService

        const result = yield* service.initialize().pipe(
          Effect.catchAll(() => Effect.succeed({ success: false }))
        )

        expect(result.success).toBe(true)
      }).pipe(Effect.provide(AppServiceLive))
    )
  })

  describe('Property-Based Testing', () => {
    it.effect('should always return consistent initialize results', () =>
      Effect.gen(function* () {
        const service = yield* AppService

        yield* Effect.promise(async () => {
          await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (count) => {
              const results = await Promise.all(
                Array(count).fill(null).map(() =>
                  Effect.runPromise(service.initialize())
                )
              )

              // All results should be identical
              const firstResult = results[0]
              results.forEach(result => {
                expect(result).toEqual(firstResult)
                expect(result.success).toBe(true)
              })
            })
          )
        })
      }).pipe(Effect.provide(AppServiceLive))
    )

    it.effect('should always return consistent status results', () =>
      Effect.gen(function* () {
        const service = yield* AppService

        yield* Effect.promise(async () => {
          await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (count) => {
              const results = await Promise.all(
                Array(count).fill(null).map(() =>
                  Effect.runPromise(service.getReadyStatus())
                )
              )

              // All status results should be identical
              const firstStatus = results[0]
              results.forEach(status => {
                expect(status).toEqual(firstStatus)
                expect(status.ready).toBe(true)
              })
            })
          )
        })
      }).pipe(Effect.provide(AppServiceLive))
    )

    vitestIt('should handle concurrent access patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('initialize', 'getReadyStatus'), { minLength: 1, maxLength: 20 }),
          async (operations) => {
            const program = Effect.gen(function* () {
              const service = yield* AppService

              const results = yield* Effect.all(
                operations.map(op =>
                  op === 'initialize'
                    ? service.initialize()
                    : service.getReadyStatus()
                ),
                { concurrency: 'unbounded' }
              )

              return results
            }).pipe(Effect.provide(AppServiceLive))

            const results = await Effect.runPromise(program)

            // Verify all operations completed successfully
            results.forEach((result, index) => {
              if (operations[index] === 'initialize') {
                expect(result).toHaveProperty('success')
                expect((result as any).success).toBe(true)
              } else {
                expect(result).toHaveProperty('ready')
                expect((result as any).ready).toBe(true)
              }
            })
          }
        )
      )
    })

    vitestIt('should maintain service invariants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initCount: fc.integer({ min: 0, max: 10 }),
            statusCount: fc.integer({ min: 0, max: 10 }),
            interleaved: fc.boolean(),
          }),
          async ({ initCount, statusCount, interleaved }) => {
            const program = Effect.gen(function* () {
              const service = yield* AppService
              const results: any[] = []

              if (interleaved) {
                // Interleave operations
                for (let i = 0; i < Math.max(initCount, statusCount); i++) {
                  if (i < initCount) {
                    results.push(yield* service.initialize())
                  }
                  if (i < statusCount) {
                    results.push(yield* service.getReadyStatus())
                  }
                }
              } else {
                // Sequential operations
                for (let i = 0; i < initCount; i++) {
                  results.push(yield* service.initialize())
                }
                for (let i = 0; i < statusCount; i++) {
                  results.push(yield* service.getReadyStatus())
                }
              }

              return results
            }).pipe(Effect.provide(AppServiceLive))

            const results = await Effect.runPromise(program)

            // All operations should complete successfully
            expect(results).toHaveLength(initCount + statusCount)

            // Verify invariants
            const initResults = results.filter(r => 'success' in r)
            const statusResults = results.filter(r => 'ready' in r)

            expect(initResults).toHaveLength(initCount)
            expect(statusResults).toHaveLength(statusCount)

            initResults.forEach(r => expect(r.success).toBe(true))
            statusResults.forEach(r => expect(r.ready).toBe(true))
          }
        )
      )
    })
  })

  describe('Performance Characteristics', () => {
    it.effect('should handle rapid successive calls', () =>
      Effect.gen(function* () {
        const service = yield* AppService
        const iterations = 1000

        const start = Date.now()

        for (let i = 0; i < iterations; i++) {
          yield* service.initialize()
          yield* service.getReadyStatus()
        }

        const elapsed = Date.now() - start

        // Should complete quickly (less than 1 second for 1000 iterations)
        expect(elapsed).toBeLessThan(1000)
      }).pipe(Effect.provide(AppServiceLive))
    )

    it.effect('should handle parallel operations efficiently', () =>
      Effect.gen(function* () {
        const service = yield* AppService
        const batchSize = 100

        const start = Date.now()

        const operations = Array(batchSize).fill(null).map((_, i) =>
          i % 2 === 0 ? service.initialize() : service.getReadyStatus()
        )

        const results = yield* Effect.all(operations, { concurrency: 'unbounded' })

        const elapsed = Date.now() - start

        // Parallel execution should be fast
        expect(elapsed).toBeLessThan(500)
        expect(results).toHaveLength(batchSize)
      }).pipe(Effect.provide(AppServiceLive))
    )
  })
})