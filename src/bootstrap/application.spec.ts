import { describe, expect, it } from '@effect/vitest'
import { Effect, Either } from 'effect'
import * as Option from 'effect/Option'
import {
  AppService,
  AppServiceTag,
  ConfigService,
  ConfigServiceTag,
  ensureReadySnapshot,
  instantiateLifecycleSnapshot,
  markInitializedAt,
  projectInitialization,
  projectReadiness,
  resolveLifecycleInitialization,
  resetInitializedAt,
  reviveEpochZero,
  stageFromAppError,
} from './application'
import {
  BootstrapConfigDefaults,
  makeInitializationError,
  unsafeEpochMilliseconds,
} from './domain'

describe('bootstrap/application', () => {
  it('instantiates lifecycle snapshots with explicit values', () => {
    const snapshot = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'uninitialized',
        updatedAt: unsafeEpochMilliseconds(100),
        initializedAt: unsafeEpochMilliseconds(50),
        config: BootstrapConfigDefaults,
      })
    )
    expect(snapshot.state).toBe('uninitialized')
    expect(snapshot.initializedAt).toEqual(unsafeEpochMilliseconds(50))
  })

  it('resolves initializedAt fallback when missing', () => {
    const snapshot = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'initializing',
        updatedAt: unsafeEpochMilliseconds(10),
        config: BootstrapConfigDefaults,
      })
    )

    const resolved = resolveLifecycleInitialization(snapshot)

    expect(resolved).toEqual(snapshot.updatedAt)
  })

  it('projects readiness for ready snapshots and rejects others', () => {
    const readySnapshot = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'ready',
        updatedAt: unsafeEpochMilliseconds(20),
        initializedAt: unsafeEpochMilliseconds(20),
        config: BootstrapConfigDefaults,
      })
    )
    const uninitialized = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'uninitialized',
        updatedAt: unsafeEpochMilliseconds(0),
        config: BootstrapConfigDefaults,
      })
    )

    const readiness = Effect.runSync(Effect.either(projectReadiness(readySnapshot)))
    expect(Either.isRight(readiness)).toBe(true)

    const pending = Effect.runSync(Effect.either(projectReadiness(uninitialized)))
    expect(Either.isLeft(pending)).toBe(true)
  })

  it('projects initialization results with freshness flag', () => {
    const readySnapshot = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'ready',
        updatedAt: unsafeEpochMilliseconds(30),
        initializedAt: unsafeEpochMilliseconds(30),
        config: BootstrapConfigDefaults,
      })
    )
    const initializing = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'initializing',
        updatedAt: unsafeEpochMilliseconds(5),
        config: BootstrapConfigDefaults,
      })
    )

    const initialized = Effect.runSync(
      Effect.either(projectInitialization(readySnapshot, true))
    )
    expect(Either.isRight(initialized)).toBe(true)

    const invalid = Effect.runSync(
      Effect.either(projectInitialization(initializing, false))
    )
    expect(Either.isLeft(invalid)).toBe(true)
  })

  it('normalizes snapshots when enforcing ready state', () => {
    const pendingSnapshot = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'initializing',
        updatedAt: unsafeEpochMilliseconds(40),
        config: BootstrapConfigDefaults,
      })
    )
    const normalized = Effect.runSync(ensureReadySnapshot(pendingSnapshot))
    expect(normalized.state).toBe('ready')
    expect(normalized.initializedAt).toEqual(normalized.updatedAt)
  })

  it('resets and marks initialization timestamps explicitly', () => {
    const snapshot = Effect.runSync(
      instantiateLifecycleSnapshot({
        state: 'ready',
        updatedAt: unsafeEpochMilliseconds(60),
        initializedAt: unsafeEpochMilliseconds(55),
        config: BootstrapConfigDefaults,
      })
    )
    const reset = Effect.runSync(resetInitializedAt(snapshot))
    expect(reset.initializedAt).toEqual(reset.updatedAt)

    const marked = Effect.runSync(markInitializedAt(snapshot, unsafeEpochMilliseconds(70)))
    expect(marked.initializedAt).toEqual(unsafeEpochMilliseconds(70))
  })

  it('exposes contextual stage information from errors', () => {
    const error = makeInitializationError({ stage: 'services', message: 'failed' })
    const stage = stageFromAppError(error)
    expect(Option.isSome(stage)).toBe(true)
    expect(stage.value).toBe('services')
  })

  it('revives epoch zero as branded timestamp', () => {
    const zero = reviveEpochZero()
    expect(zero).toEqual(unsafeEpochMilliseconds(0))
  })

  it('re-exports service tags for DI compatibility', () => {
    expect(ConfigService).toBe(ConfigServiceTag)
    expect(AppService).toBe(AppServiceTag)
  })
})
