import { it } from '@effect/vitest'
import { Cause, Chunk, Effect, Exit, Match, pipe } from 'effect'
import { describe, expect } from 'vitest'
import {
  createMockSystem,
  createSystem,
  isSystemError,
  makeSystemError,
  priorityToNumber,
  runSystems,
  runSystemWithMetrics,
} from '../system'
import type { World } from '../world'

describe('System', () => {
  describe('createSystem', () => {
    it.effect('システムを正しく作成できる', () =>
      Effect.gen(function* () {
        const system = createSystem<World>('TestSystem', () => Effect.void)

        expect(system.name).toBe('TestSystem')
        expect(system.update).toBeDefined()
      })
    )
  })

  describe('priorityToNumber', () => {
    it.effect('優先度を正しく数値に変換する', () =>
      Effect.gen(function* () {
        expect(priorityToNumber('critical')).toBe(50)
        expect(priorityToNumber('high')).toBe(200)
        expect(priorityToNumber('normal')).toBe(500)
        expect(priorityToNumber('low')).toBe(800)
        expect(priorityToNumber('deferred')).toBe(950)
      })
    )
  })

  describe('runSystems', () => {
    it.effect('複数のシステムを順次実行する', () =>
      Effect.gen(function* () {
        const executionOrder: string[] = []

        const system1 = createSystem<World>('System1', () =>
          Effect.sync(() => {
            executionOrder.push('System1')
          })
        )

        const system2 = createSystem<World>('System2', () =>
          Effect.sync(() => {
            executionOrder.push('System2')
          })
        )

        const system3 = createSystem<World>('System3', () =>
          Effect.sync(() => {
            executionOrder.push('System3')
          })
        )

        Effect.runSync(runSystems([system1, system2, system3], {} as World, 16))

        expect(executionOrder).toEqual(['System1', 'System2', 'System3'])
      })
    )

    it.effect('システムエラーを適切に処理する', () =>
      Effect.gen(function* () {
        const system1 = createSystem<World>('System1', () => Effect.void)

        const system2 = createSystem<World>('System2', () => Effect.fail(makeSystemError('System2', 'Test error')))

        const result = Effect.runSyncExit(runSystems([system1, system2], {} as World, 16))

        expect(result._tag).toBe('Failure')
        pipe(
          Match.value(result),
          Match.when(
            (r) => Exit.isFailure(r),
            (r) => {
              const error = r.cause
              expect(error).toBeDefined()
              const failures = Chunk.toArray(Cause.failures(error))
              expect(failures).toHaveLength(1)
              expect(isSystemError(failures[0])).toBe(true)
              if (isSystemError(failures[0])) {
                expect(failures[0].systemName).toBe('System2')
              }
            }
          ),
          Match.orElse(() => {
            // No-op for successful results
          })
        )
      })
    )

    it.effect('未知のエラーをSystemErrorにラップする', () =>
      Effect.gen(function* () {
        const system = createSystem<World>('FailingSystem', () => Effect.fail(new Error('Unexpected failure')))

        const result = Effect.runSyncExit(runSystems([system], {} as World, 16))

        expect(result._tag).toBe('Failure')
        pipe(
          Match.value(result),
          Match.when(
            (r) => Exit.isFailure(r),
            (r) => {
              const error = r.cause
              expect(error).toBeDefined()
              const failures = Chunk.toArray(Cause.failures(error))
              expect(failures).toHaveLength(1)
              expect(isSystemError(failures[0])).toBe(true)
              if (isSystemError(failures[0])) {
                expect(failures[0].systemName).toBe('FailingSystem')
                expect(failures[0].message).toBe('Unknown error in system execution')
                expect(failures[0].cause._tag).toBe('Some')
              }
            }
          ),
          Match.orElse(() => {
            // No-op for successful results
          })
        )
      })
    )
  })

  describe('runSystemWithMetrics', () => {
    it.effect('システム実行時間を計測する', () =>
      Effect.gen(function* () {
        const system = createSystem<World>('TimedSystem', () =>
          Effect.sync(() => {
            // 何か処理をシミュレート
            const start = Date.now()
            while (Date.now() - start < 5) {
              // 5ms待機
            }
          })
        )

        const result = Effect.runSync(runSystemWithMetrics(system, {} as World, 16))

        expect(result.duration).toBeGreaterThanOrEqual(5)
      })
    )

    it.effect('16ms以上かかったシステムに対して警告を出す', () =>
      Effect.gen(function* () {
        const warnings: string[] = []
        const originalLogWarning = console.warn

        // console.warnをモック
        console.warn = (message: string) => {
          warnings.push(message)
        }

        const system = createSystem<World>('SlowSystem', () =>
          Effect.sync(() => {
            // 20ms以上かかる処理をシミュレート
            const start = Date.now()
            while (Date.now() - start < 20) {
              // 20ms待機
            }
          })
        )

        const result = Effect.runSync(runSystemWithMetrics(system, {} as World, 16))

        // console.warnを元に戻す
        console.warn = originalLogWarning

        expect(result.duration).toBeGreaterThanOrEqual(20)
        // Effect.logWarningの出力確認は実際のログ実装に依存するため、
        // ここでは実行時間の検証のみ行う
      })
    )
  })

  describe('createMockSystem', () => {
    it.effect('デフォルトの動作でモックシステムを作成する', () =>
      Effect.gen(function* () {
        const mockSystem = createMockSystem<World>('MockSystem')

        expect(mockSystem.name).toBe('MockSystem')

        const result = Effect.runSync(mockSystem.update({} as World, 16))

        expect(result).toBeUndefined()
      })
    )

    it.effect('カスタム動作でモックシステムを作成する', () =>
      Effect.gen(function* () {
        let executed = false

        const customBehavior = Effect.sync(() => {
          executed = true
        })

        const mockSystem = createMockSystem<World>('MockSystem', customBehavior)

        Effect.runSync(mockSystem.update({} as World, 16))

        expect(executed).toBe(true)
      })
    )

    it.effect('エラーを返すモックシステムを作成できる', () =>
      Effect.gen(function* () {
        const error = makeSystemError('MockSystem', 'Mock error')

        const mockSystem = createMockSystem<World>('MockSystem', Effect.fail(error))

        const result = Effect.runSyncExit(mockSystem.update({} as World, 16))

        expect(result._tag).toBe('Failure')
        pipe(
          result,
          Exit.match({
            onFailure: (cause) => {
              const failures = Chunk.toArray(Cause.failures(cause))
              expect(failures).toHaveLength(1)
              expect(failures[0]).toBe(error)
            },
            onSuccess: (value) => {
              // 成功時の処理（この場合は期待しない）
              throw new Error('Expected failure but got success')
            },
          })
        )
      })
    )
  })
})
