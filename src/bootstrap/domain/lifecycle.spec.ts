import * as Arbitrary from '@effect/schema/Arbitrary'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, Schema, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { BootstrapConfigDefaults } from './config'
import {
  AppInitializationResultSchema,
  AppReadinessSchema,
  LifecycleSnapshotSchema,
  ensureReadySnapshot,
  initializationProjection,
  makeLifecycleSnapshot,
  markInitializedAt,
  readinessProjection,
  resetInitializedAt,
  resolveInitializedAt,
} from './lifecycle'
import { epochMilliseconds, reviveEpochZero, unsafeEpochMilliseconds } from './value'

const snapshotArb = Arbitrary.make(LifecycleSnapshotSchema)

describe('bootstrap/domain/lifecycle', () => {
  it.effect('makeLifecycleSnapshotはinitializedAt未指定時にundefinedを保持する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(1_000)
      const snapshot = yield* makeLifecycleSnapshot({
        state: 'initializing',
        updatedAt,
        config: BootstrapConfigDefaults,
      })
      expect(snapshot.initializedAt).toBeUndefined()
      expect(snapshot.updatedAt).toBe(updatedAt)
    })
  )

  it.effect('resolveInitializedAtはinitializedAtが存在すればそれを返す', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(2_000)
      const initializedAt = unsafeEpochMilliseconds(5_000)
      const snapshot = yield* makeLifecycleSnapshot({
        state: 'ready',
        updatedAt,
        initializedAt,
        config: BootstrapConfigDefaults,
      })
      expect(resolveInitializedAt(snapshot)).toBe(initializedAt)
    })
  )

  it.effect('resolveInitializedAtはinitializedAt未指定時にupdatedAtを返す', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(3_000)
      const snapshot = yield* makeLifecycleSnapshot({
        state: 'initializing',
        updatedAt,
        config: BootstrapConfigDefaults,
      })
      expect(resolveInitializedAt(snapshot)).toBe(updatedAt)
    })
  )

  it.effect('ensureReadySnapshotはstateとinitializedAtを正規化する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(4_000)
      const base = yield* makeLifecycleSnapshot({
        state: 'initializing',
        updatedAt,
        config: BootstrapConfigDefaults,
      })
      const ready = yield* ensureReadySnapshot(base)
      expect(ready.state).toBe('ready')
      expect(ready.initializedAt).toBe(ready.updatedAt)
    })
  )

  it.effect('resetInitializedAtはready状態に強制する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(6_000)
      const base = yield* makeLifecycleSnapshot({
        state: 'ready',
        updatedAt,
        initializedAt: reviveEpochZero(),
        config: BootstrapConfigDefaults,
      })
      const reset = yield* resetInitializedAt(base)
      expect(reset.state).toBe('ready')
      expect(reset.initializedAt).toBe(reset.updatedAt)
    })
  )

  it.effect('markInitializedAtは任意のタイムスタンプを保持する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(7_000)
      const markedAt = unsafeEpochMilliseconds(9_000)
      const base = yield* makeLifecycleSnapshot({
        state: 'initializing',
        updatedAt,
        config: BootstrapConfigDefaults,
      })
      const marked = yield* markInitializedAt(base, markedAt)
      expect(marked.initializedAt).toBe(markedAt)
      expect(marked.state).toBe('initializing')
    })
  )

  it.effect('readinessProjectionはReadyスナップショットを射影する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(10_000)
      const base = yield* makeLifecycleSnapshot({
        state: 'ready',
        updatedAt,
        initializedAt: updatedAt,
        config: BootstrapConfigDefaults,
      })
      const readiness = yield* readinessProjection(base, true)
      expect(readiness.ready).toBe(true)
      expect(readiness.state).toBe('ready')
      Schema.decodeUnknownSync(AppReadinessSchema)(readiness)
    })
  )

  it.effect('initializationProjectionはfreshフラグを反映する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(12_000)
      const base = yield* makeLifecycleSnapshot({
        state: 'ready',
        updatedAt,
        initializedAt: updatedAt,
        config: BootstrapConfigDefaults,
      })
      const initialization = yield* initializationProjection(base, false)
      expect(initialization.ready).toBe(true)
      expect(initialization.fresh).toBe(false)
      Schema.decodeUnknownSync(AppInitializationResultSchema)(initialization)
    })
  )

  it.prop('resolveInitializedAtは任意スナップショットでも整合性を保つ', [snapshotArb], ([snapshot]) => {
    const resolved = resolveInitializedAt(snapshot)
    pipe(
      snapshot.initializedAt,
      Option.fromNullable,
      Option.match({
        onNone: () => expect(resolved).toBe(snapshot.updatedAt),
        onSome: (initializedAt) => expect(resolved).toBe(initializedAt),
      })
    )
    return true
  })

  it.prop('ensureReadySnapshotは任意スナップショットをreadyへ正規化する', [snapshotArb], ([snapshot]) => {
    const ready = Effect.runSync(ensureReadySnapshot(snapshot))
    expect(ready.state).toBe('ready')
    const decoded = Schema.decodeUnknownSync(LifecycleSnapshotSchema)(ready)
    expect(decoded.state).toBe('ready')
    return true
  })

  it.prop(
    'readinessProjectionはresolveInitializedAtの結果と同期する',
    [snapshotArb, fc.boolean()],
    ([snapshot, readyFlag]) => {
      const readiness = Effect.runSync(readinessProjection(snapshot, readyFlag))
      expect(readiness.initializedAt).toBe(resolveInitializedAt(snapshot))
      expect(readiness.ready).toBe(readyFlag)
      return true
    }
  )

  it.effect('initializationProjectionはepochMillisecondsブランドを保持する', () =>
    Effect.gen(function* () {
      const updatedAt = unsafeEpochMilliseconds(16_000)
      const base = yield* makeLifecycleSnapshot({
        state: 'ready',
        updatedAt,
        initializedAt: updatedAt,
        config: BootstrapConfigDefaults,
      })
      const result = yield* initializationProjection(base, true)
      yield* epochMilliseconds(result.initializedAt)
    })
  )
})
