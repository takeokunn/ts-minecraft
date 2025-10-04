/**
 * SystemRegistry ECS Architecture Tests - it.effect理想系パターン
 * Context7準拠のEffect-TS v3.17+最新パターン使用
 */

import { it } from '@effect/vitest'
import * as Cause from 'effect/Cause'
import * as Chunk from 'effect/Chunk'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import { createSystem, makeSystemError } from '../System'
import {
  isSystemRegistryError,
  SystemRegistryError,
  SystemRegistryService,
  SystemRegistryServiceLive,
} from '../SystemRegistry'
import type { World } from '../World'

// ================================================================================
// Test Layers - Layer-based DI Pattern
// ================================================================================

const TestLayer = SystemRegistryServiceLive

// ================================================================================
// SystemRegistry Tests - it.effect Pattern
// ================================================================================

describe('SystemRegistry ECS Architecture', () => {
  describe('システム登録', () => {
    it.effect('システムを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService
        const testSystem = createSystem('TestSystem', () => Effect.void)

        yield* registry.register(testSystem, 'normal', 500)

        const systems = yield* registry.getSystems
        expect(systems).toHaveLength(1)
        expect(systems[0]?.name).toBe('TestSystem')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('同じ名前のシステムは重複登録されない', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService
        const system1 = createSystem('DuplicateSystem', () => Effect.void)
        const system2 = createSystem('DuplicateSystem', () => Effect.succeed('different'))

        yield* registry.register(system1)
        yield* registry.register(system2) // 同じ名前なので無視される

        const systems = yield* registry.getSystems
        expect(systems).toHaveLength(1)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('異なる優先度でシステムを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const criticalSystem = createSystem('CriticalSystem', () => Effect.void)
        const normalSystem = createSystem('NormalSystem', () => Effect.void)
        const deferredSystem = createSystem('DeferredSystem', () => Effect.void)

        yield* registry.register(criticalSystem, 'critical')
        yield* registry.register(normalSystem, 'normal')
        yield* registry.register(deferredSystem, 'deferred')

        const orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems[0]?.name).toBe('CriticalSystem')
        expect(orderedSystems[1]?.name).toBe('NormalSystem')
        expect(orderedSystems[2]?.name).toBe('DeferredSystem')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('同じ優先度内でorder値によってソートされる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const system1 = createSystem('System1', () => Effect.void)
        const system2 = createSystem('System2', () => Effect.void)
        const system3 = createSystem('System3', () => Effect.void)

        yield* registry.register(system3, 'normal', 300)
        yield* registry.register(system1, 'normal', 100)
        yield* registry.register(system2, 'normal', 200)

        const orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems[0]?.name).toBe('System1')
        expect(orderedSystems[1]?.name).toBe('System2')
        expect(orderedSystems[2]?.name).toBe('System3')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('システム削除', () => {
    it.effect('登録されたシステムを削除できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService
        const testSystem = createSystem('TestSystem', () => Effect.void)

        yield* registry.register(testSystem)
        yield* registry.unregister('TestSystem')

        const systems = yield* registry.getSystems
        expect(systems).toHaveLength(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect.skip('存在しないシステムの削除でエラーが発生する', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const result = yield* Effect.exit(registry.unregister('NonExistentSystem'))

        yield* pipe(
          result,
          Exit.match({
            onSuccess: (value) => Effect.fail(new Error('Should have failed with SystemRegistryError')),
            onFailure: () => Effect.succeed(undefined),
          })
        )

        const failures = Exit.isFailure(result) ? Chunk.toArray(Cause.failures(result.cause)) : []
        yield* pipe(
          failures.length !== 1,
          Match.value,
          Match.when(true, () => Effect.fail(new Error('Expected exactly one failure'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )

        if (!isSystemRegistryError(failures[0])) {
          yield* Effect.fail(new Error('Expected SystemRegistryError'))
        }

        const error = failures[0] as SystemRegistryError
        yield* Effect.sync(() =>
          expect(Option.getOrElse(error.systemName, () => ''))
            .toBe('NonExistentSystem')
        )
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('システムの有効/無効', () => {
    it.effect('システムを無効化できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        let executed = false
        const testSystem = createSystem('TestSystem', () =>
          Effect.sync(() => {
            executed = true
          })
        )

        yield* registry.register(testSystem)
        yield* registry.setEnabled('TestSystem', false)

        const orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems).toHaveLength(0) // 無効化されたシステムは実行順序から除外

        yield* registry.update({} as World, 16)
        expect(executed).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('システムを再度有効化できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        let executionCount = 0
        const testSystem = createSystem('TestSystem', () =>
          Effect.sync(() => {
            executionCount++
          })
        )

        yield* registry.register(testSystem)
        yield* registry.setEnabled('TestSystem', false)
        yield* registry.update({} as World, 16)
        expect(executionCount).toBe(0)

        yield* registry.setEnabled('TestSystem', true)
        yield* registry.update({} as World, 16)
        expect(executionCount).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('優先度変更', () => {
    it.effect('システムの優先度を変更できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const system1 = createSystem('System1', () => Effect.void)
        const system2 = createSystem('System2', () => Effect.void)

        yield* registry.register(system1, 'normal')
        yield* registry.register(system2, 'high')

        let orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems[0]?.name).toBe('System2') // high priority first

        yield* registry.setPriority('System1', 'critical')

        orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems[0]?.name).toBe('System1') // critical priority first
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('システムの実行順序を変更できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const system1 = createSystem('System1', () => Effect.void)
        const system2 = createSystem('System2', () => Effect.void)

        yield* registry.register(system1, 'normal', 100)
        yield* registry.register(system2, 'normal', 200)

        let orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems[0]?.name).toBe('System1')

        yield* registry.setPriority('System1', 'normal', 300)

        orderedSystems = yield* registry.getOrderedSystems
        expect(orderedSystems[0]?.name).toBe('System2') // System2が先になる
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('システム実行', () => {
    it.effect('有効なシステムのみを実行する', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const executions: string[] = []

        const system1 = createSystem('System1', () => Effect.sync(() => executions.push('System1')))
        const system2 = createSystem('System2', () => Effect.sync(() => executions.push('System2')))
        const system3 = createSystem('System3', () => Effect.sync(() => executions.push('System3')))

        yield* registry.register(system1)
        yield* registry.register(system2)
        yield* registry.register(system3)

        yield* registry.setEnabled('System2', false)

        yield* registry.update({} as World, 16)

        expect(executions).toEqual(['System1', 'System3'])
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('グローバルな有効/無効状態を制御できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        let executed = false
        const testSystem = createSystem('TestSystem', () =>
          Effect.sync(() => {
            executed = true
          })
        )

        yield* registry.register(testSystem)

        yield* registry.setGlobalEnabled(false)
        yield* registry.update({} as World, 16)
        expect(executed).toBe(false)

        yield* registry.setGlobalEnabled(true)
        yield* registry.update({} as World, 16)
        expect(executed).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect.skip('システムエラーを適切に処理する', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const failingSystem = createSystem('FailingSystem', () =>
          Effect.fail(makeSystemError('FailingSystem', 'Test error'))
        )

        yield* registry.register(failingSystem)

        const result = yield* Effect.either(registry.update({} as World, 16))
        expect(result._tag).toBe('Left')

        // エラーが統計に記録される
        const stats = yield* registry.getStats('FailingSystem')
        expect(stats.errors).toHaveLength(1)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('実行統計', () => {
    it.effect.skip('システムの実行統計を取得できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        let executionCount = 0
        const testSystem = createSystem('TestSystem', () =>
          Effect.sync(() => {
            executionCount++
            // 処理時間をシミュレート
            const start = Date.now()
            while (Date.now() - start < 5) {
              // 5ms待機
            }
          })
        )

        yield* registry.register(testSystem)

        yield* registry.update({} as World, 16)
        yield* registry.update({} as World, 16)
        yield* registry.update({} as World, 16)

        const stats = yield* registry.getStats('TestSystem')

        expect(stats.systemName).toBe('TestSystem')
        expect(stats.executionCount).toBe(3)
        expect(stats.averageDuration).toBeGreaterThan(0)
        expect(stats.maxDuration).toBeGreaterThanOrEqual(5)
        expect(stats.totalDuration).toBeGreaterThanOrEqual(15)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect.skip('存在しないシステムの統計取得でエラーが発生する', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const result = yield* Effect.exit(registry.getStats('NonExistentSystem'))

        yield* pipe(
          result,
          Exit.match({
            onSuccess: (value) => Effect.fail(new Error('Should have failed with SystemRegistryError')),
            onFailure: () => Effect.succeed(undefined),
          })
        )

        const failures = Exit.isFailure(result) ? Chunk.toArray(Cause.failures(result.cause)) : []
        yield* pipe(
          failures.length !== 1,
          Match.value,
          Match.when(true, () => Effect.fail(new Error('Expected exactly one failure'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )

        yield* pipe(
          !isSystemRegistryError(failures[0]),
          Match.value,
          Match.when(true, () => Effect.fail(new Error('Expected SystemRegistryError'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect.skip('エラー履歴が記録される', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        let failCount = 0
        const unreliableSystem = createSystem('UnreliableSystem', () =>
          Effect.gen(function* () {
            failCount++
            yield* pipe(
              failCount % 2 === 1,
              Match.value,
              Match.when(true, () => Effect.fail(makeSystemError('UnreliableSystem', `Failure ${failCount}`))),
              Match.when(false, () => Effect.succeed(undefined)),
              Match.exhaustive
            )
          })
        )

        yield* registry.register(unreliableSystem)

        // エラーを無視して複数回実行
        for (let i = 0; i < 5; i++) {
          yield* registry.update({} as World, 16).pipe(Effect.ignore)
        }

        const stats = yield* registry.getStats('UnreliableSystem')
        expect(stats.errors.length).toBeGreaterThan(0)
        expect(stats.errors.length).toBeLessThanOrEqual(10) // 最大10件のエラーを保持
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect.skip('非SystemErrorのエラーが適切に記録される', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const systemWithGenericError = createSystem('GenericErrorSystem', () =>
          Effect.fail(makeSystemError('GenericErrorSystem', 'Generic string error'))
        )

        yield* registry.register(systemWithGenericError)

        // エラーを無視して実行
        yield* registry.update({} as World, 16).pipe(Effect.ignore)

        const stats = yield* registry.getStats('GenericErrorSystem')
        expect(stats.errors).toHaveLength(1)
        expect(stats.errors[0]).toBe('Generic string error')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('レジストリクリア', () => {
    it.effect('レジストリをクリアできる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const system1 = createSystem('System1', () => Effect.void)
        const system2 = createSystem('System2', () => Effect.void)

        yield* registry.register(system1)
        yield* registry.register(system2)

        let systems = yield* registry.getSystems
        expect(systems).toHaveLength(2)

        yield* registry.clear

        systems = yield* registry.getSystems
        expect(systems).toHaveLength(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('クリア後も新しいシステムを登録できる', () =>
      Effect.gen(function* () {
        const registry = yield* SystemRegistryService

        const system1 = createSystem('System1', () => Effect.void)
        yield* registry.register(system1)
        yield* registry.clear

        const system2 = createSystem('System2', () => Effect.void)
        yield* registry.register(system2)

        const systems = yield* registry.getSystems
        expect(systems).toHaveLength(1)
        expect(systems[0]?.name).toBe('System2')
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
