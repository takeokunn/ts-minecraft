/**
 * @fileoverview TestClockを使用したプログレッシブローディングスケジューラーテスト
 * 複数タスクの異なる間隔でのスケジューリングを仮想時間で検証
 */

import { describe, expect, it } from '@effect/vitest'
import { Clock, Duration, Effect, Fiber, Queue, TestClock } from 'effect'

/**
 * スケジュールされたタスクの型定義
 */
type ScheduledTask = {
  id: string
  priority: 'high' | 'medium' | 'low'
  executionTime: number
}

/**
 * タスクスケジューラーのモック実装
 * 優先度に応じて異なる間隔でタスクを実行
 */
const createTaskScheduler = () =>
  Effect.gen(function* () {
    const taskQueue = yield* Queue.unbounded<ScheduledTask>()
    const executedTasks: ScheduledTask[] = []

    const scheduleTask = (task: ScheduledTask) =>
      Effect.gen(function* () {
        // 優先度に応じた待機時間
        const delay =
          task.priority === 'high'
            ? Duration.seconds(1)
            : task.priority === 'medium'
              ? Duration.seconds(3)
              : Duration.seconds(5)

        yield* Effect.sleep(delay)
        const executionTime = yield* Clock.currentTimeMillis

        const executedTask = { ...task, executionTime }
        yield* Queue.offer(taskQueue, executedTask)
        executedTasks.push(executedTask)

        return executedTask
      })

    return { scheduleTask, taskQueue, executedTasks }
  })

describe('Loading Scheduler with TestClock', () => {
  it.effect('should schedule tasks at different intervals', () =>
    Effect.gen(function* () {
      const scheduler = yield* createTaskScheduler()
      const taskResults: string[] = []

      // 異なる優先度のタスクを並列スケジュール
      const highPriorityTask = Effect.gen(function* () {
        yield* scheduler.scheduleTask({ id: 'high-1', priority: 'high', executionTime: 0 })
        taskResults.push('high')
      })

      const mediumPriorityTask = Effect.gen(function* () {
        yield* scheduler.scheduleTask({ id: 'medium-1', priority: 'medium', executionTime: 0 })
        taskResults.push('medium')
      })

      const lowPriorityTask = Effect.gen(function* () {
        yield* scheduler.scheduleTask({ id: 'low-1', priority: 'low', executionTime: 0 })
        taskResults.push('low')
      })

      // 全タスクを並列実行
      const taskFibers = yield* Effect.all(
        [Effect.fork(highPriorityTask), Effect.fork(mediumPriorityTask), Effect.fork(lowPriorityTask)],
        { concurrency: 'unbounded' }
      )

      // 段階的に時間を進める
      yield* TestClock.adjust(Duration.seconds(1)) // high完了
      expect(taskResults).toContain('high')
      expect(taskResults).not.toContain('medium')
      expect(taskResults).not.toContain('low')

      yield* TestClock.adjust(Duration.seconds(2)) // medium完了（合計3秒）
      expect(taskResults).toContain('medium')
      expect(taskResults).not.toContain('low')

      yield* TestClock.adjust(Duration.seconds(2)) // low完了（合計5秒）
      expect(taskResults).toContain('low')

      // 全Fiberの完了を待つ
      yield* Effect.all(taskFibers.map(Fiber.join))

      // 実行順序の確認
      expect(taskResults).toEqual(['high', 'medium', 'low'])
      expect(scheduler.executedTasks).toHaveLength(3)
    })
  )

  it.effect('should handle multiple tasks with same priority', () =>
    Effect.gen(function* () {
      const scheduler = yield* createTaskScheduler()

      // 同一優先度の複数タスク
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        priority: 'medium' as const,
        executionTime: 0,
      }))

      // 全タスクを並列スケジュール
      const taskFibers = yield* Effect.all(
        tasks.map((task) => Effect.fork(scheduler.scheduleTask(task))),
        { concurrency: 'unbounded' }
      )

      // 3秒進める（medium優先度の実行時間）
      yield* TestClock.adjust(Duration.seconds(3))

      // 全タスクの完了を待つ
      const results = yield* Effect.all(taskFibers.map(Fiber.join))

      // 全タスクが同時に完了することを確認
      expect(results).toHaveLength(5)
      expect(results.every((r) => r.executionTime === 3000)).toBe(true)

      const executionTimes = results.map((r) => r.executionTime)
      expect(new Set(executionTimes).size).toBe(1) // 全て同じ時刻
    })
  )

  it.effect('should respect task order within same priority', () =>
    Effect.gen(function* () {
      const scheduler = yield* createTaskScheduler()
      const executionOrder: string[] = []

      // 順次実行される同一優先度タスク
      const createOrderedTask = (id: string) =>
        Effect.gen(function* () {
          yield* scheduler.scheduleTask({ id, priority: 'high', executionTime: 0 })
          executionOrder.push(id)
        })

      // 3つのタスクを順次実行
      for (const id of ['task-1', 'task-2', 'task-3']) {
        const fiber = yield* Effect.fork(createOrderedTask(id))
        yield* TestClock.adjust(Duration.seconds(1))
        yield* Fiber.join(fiber)
      }

      // 実行順序が保持されることを確認
      expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3'])

      // 合計3秒経過
      const totalTime = yield* Clock.currentTimeMillis
      expect(totalTime).toBe(3000)
    })
  )

  it.effect('should handle task cancellation', () =>
    Effect.gen(function* () {
      const scheduler = yield* createTaskScheduler()

      // 5秒かかるタスク
      const longRunningTask = scheduler.scheduleTask({ id: 'long', priority: 'low', executionTime: 0 })

      const taskFiber = yield* Effect.fork(longRunningTask)

      // 2秒進める（まだ完了しない）
      yield* TestClock.adjust(Duration.seconds(2))

      // タスクをキャンセル
      yield* Fiber.interrupt(taskFiber)

      // キャンセル後に時間を進めてもタスクは完了しない
      yield* TestClock.adjust(Duration.seconds(5))

      // executedTasksにタスクが追加されていないことを確認
      expect(scheduler.executedTasks).toHaveLength(0)
    })
  )

  it.effect('should measure total scheduling time', () =>
    Effect.gen(function* () {
      const scheduler = yield* createTaskScheduler()
      const startTime = yield* Clock.currentTimeMillis

      // 複数優先度のタスクミックス
      const tasks = [
        { id: 'h1', priority: 'high' as const },
        { id: 'h2', priority: 'high' as const },
        { id: 'm1', priority: 'medium' as const },
        { id: 'l1', priority: 'low' as const },
      ]

      const taskFibers = yield* Effect.all(
        tasks.map((task) => Effect.fork(scheduler.scheduleTask({ ...task, executionTime: 0 }))),
        { concurrency: 'unbounded' }
      )

      // 全タスク完了まで時間を進める（最大5秒）
      yield* TestClock.adjust(Duration.seconds(5))

      yield* Effect.all(taskFibers.map(Fiber.join))

      const endTime = yield* Clock.currentTimeMillis
      const totalTime = endTime - startTime

      expect(totalTime).toBe(5000)
      expect(scheduler.executedTasks).toHaveLength(4)

      // 優先度順に実行時刻を確認
      const highTasks = scheduler.executedTasks.filter((t) => t.priority === 'high')
      const mediumTasks = scheduler.executedTasks.filter((t) => t.priority === 'medium')
      const lowTasks = scheduler.executedTasks.filter((t) => t.priority === 'low')

      expect(highTasks.every((t) => t.executionTime === 1000)).toBe(true)
      expect(mediumTasks.every((t) => t.executionTime === 3000)).toBe(true)
      expect(lowTasks.every((t) => t.executionTime === 5000)).toBe(true)
    })
  )
})
