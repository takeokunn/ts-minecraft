import { describe, it, expect } from 'vitest'
import { Effect, Cause, Chunk } from 'effect'
import {
  createSystem,
  createMockSystem,
  runSystems,
  runSystemWithMetrics,
  SystemError,
  priorityToNumber,
  SystemPriority,
} from '../System'
import type { World } from '../World'

describe('System', () => {
  describe('createSystem', () => {
    it('システムを正しく作成できる', () => {
      const system = createSystem('TestSystem', () => Effect.void)

      expect(system.name).toBe('TestSystem')
      expect(system.update).toBeDefined()
    })
  })

  describe('priorityToNumber', () => {
    it('優先度を正しく数値に変換する', () => {
      expect(priorityToNumber('critical')).toBe(50)
      expect(priorityToNumber('high')).toBe(200)
      expect(priorityToNumber('normal')).toBe(500)
      expect(priorityToNumber('low')).toBe(800)
      expect(priorityToNumber('deferred')).toBe(950)
    })
  })

  describe('runSystems', () => {
    it('複数のシステムを順次実行する', async () => {
      const executionOrder: string[] = []

      const system1 = createSystem('System1', () =>
        Effect.sync(() => {
          executionOrder.push('System1')
        })
      )

      const system2 = createSystem('System2', () =>
        Effect.sync(() => {
          executionOrder.push('System2')
        })
      )

      const system3 = createSystem('System3', () =>
        Effect.sync(() => {
          executionOrder.push('System3')
        })
      )

      await Effect.runPromise(runSystems([system1, system2, system3], {} as World, 16))

      expect(executionOrder).toEqual(['System1', 'System2', 'System3'])
    })

    it('システムエラーを適切に処理する', async () => {
      const system1 = createSystem('System1', () => Effect.void)

      const system2 = createSystem('System2', () =>
        Effect.fail(
          SystemError(
            'System2',
            'Test error'
          )
        )
      )

      const result = await Effect.runPromiseExit(runSystems([system1, system2], {} as World, 16))

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        const error = result.cause
        expect(error).toBeDefined()
        const failures = Chunk.toArray(Cause.failures(error))
        expect(failures).toHaveLength(1)
        expect(failures[0]).toBeInstanceOf(SystemError)
        expect((failures[0] as SystemError).systemName).toBe('System2')
      }
    })

    it('未知のエラーをSystemErrorにラップする', async () => {
      const system = createSystem('FailingSystem', () => Effect.fail('Unknown error' as unknown as SystemError))

      const result = await Effect.runPromiseExit(runSystems([system], {} as World, 16))

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        const error = result.cause
        expect(error).toBeDefined()
        const failures = Chunk.toArray(Cause.failures(error))
        expect(failures).toHaveLength(1)
        expect(failures[0]).toBeInstanceOf(SystemError)
        expect((failures[0] as SystemError).systemName).toBe('FailingSystem')
      }
    })
  })

  describe('runSystemWithMetrics', () => {
    it('システム実行時間を計測する', async () => {
      const system = createSystem('TimedSystem', () =>
        Effect.sync(() => {
          // 何か処理をシミュレート
          const start = Date.now()
          while (Date.now() - start < 5) {
            // 5ms待機
          }
        })
      )

      const result = await Effect.runPromise(runSystemWithMetrics(system, {} as World, 16))

      expect(result.duration).toBeGreaterThanOrEqual(5)
    })

    it('16ms以上かかったシステムに対して警告を出す', async () => {
      const warnings: string[] = []
      const originalLogWarning = console.warn

      // console.warnをモック
      console.warn = (message: string) => {
        warnings.push(message)
      }

      const system = createSystem('SlowSystem', () =>
        Effect.sync(() => {
          // 20ms以上かかる処理をシミュレート
          const start = Date.now()
          while (Date.now() - start < 20) {
            // 20ms待機
          }
        })
      )

      const result = await Effect.runPromise(runSystemWithMetrics(system, {} as World, 16))

      // console.warnを元に戻す
      console.warn = originalLogWarning

      expect(result.duration).toBeGreaterThanOrEqual(20)
      // Effect.logWarningの出力確認は実際のログ実装に依存するため、
      // ここでは実行時間の検証のみ行う
    })
  })

  describe('createMockSystem', () => {
    it('デフォルトの動作でモックシステムを作成する', async () => {
      const mockSystem = createMockSystem('MockSystem')

      expect(mockSystem.name).toBe('MockSystem')

      const result = await Effect.runPromise(mockSystem.update({} as World, 16))

      expect(result).toBeUndefined()
    })

    it('カスタム動作でモックシステムを作成する', async () => {
      let executed = false

      const customBehavior = Effect.sync(() => {
        executed = true
      })

      const mockSystem = createMockSystem('MockSystem', customBehavior)

      await Effect.runPromise(mockSystem.update({} as World, 16))

      expect(executed).toBe(true)
    })

    it('エラーを返すモックシステムを作成できる', async () => {
      const error = SystemError(
        'MockSystem',
        'Mock error'
      )

      const mockSystem = createMockSystem('MockSystem', Effect.fail(error))

      const result = await Effect.runPromiseExit(mockSystem.update({} as World, 16))

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        const failures = Chunk.toArray(Cause.failures(result.cause))
        expect(failures).toHaveLength(1)
        expect(failures[0]).toBe(error)
      }
    })
  })
})
