import { describe, expect, it } from '@effect/vitest'
import { Effect, Either, Layer, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import * as Match from 'effect/Match'
import {
  AppService,
  AppServiceTag,
  ConfigService,
  ConfigServiceTag,
  ensureReadySnapshot,
  initializationResult,
  instantiateLifecycleSnapshot,
  markInitializedAt,
  projectInitialization,
  projectReadiness,
  readinessResult,
  resetInitializedAt,
  resolveLifecycleInitialization,
  reviveEpochZero,
  stageFromAppError,
} from './application'
import {
  AppError,
  BootstrapConfigDefaults,
  bootstrapConfigSnapshot,
  makeInitializationError,
  makeLifecycleError,
  materializeConfigSnapshot,
} from './domain'
import { epochMilliseconds, unsafeEpochMilliseconds } from './domain/value'

const baseConfig = BootstrapConfigDefaults
const baseTimestamp = unsafeEpochMilliseconds(1_000)

const makeSnapshot = (state: 'uninitialized' | 'initializing' | 'ready', initializedAt?: number) =>
  instantiateLifecycleSnapshot({
    state,
    updatedAt: unsafeEpochMilliseconds(2_000),
    initializedAt: initializedAt === undefined ? undefined : unsafeEpochMilliseconds(initializedAt),
    config: baseConfig,
  })

const configSnapshot = materializeConfigSnapshot(baseConfig, reviveEpochZero())

const stubConfigService = (): ConfigService => ({
  snapshot: Effect.succeed(configSnapshot),
  snapshotResult: Effect.succeed(Either.right(configSnapshot)),
  reload: Effect.succeed(configSnapshot),
  reloadResult: Effect.succeed(Either.right(configSnapshot)),
  current: Effect.succeed(baseConfig),
  currentResult: Effect.succeed(Either.right(baseConfig)),
  refresh: Effect.succeed(baseConfig),
  refreshResult: Effect.succeed(Either.right(baseConfig)),
})

const stubAppService = (): AppService => ({
  initialize: Effect.succeed({
    ready: true,
    fresh: true,
    state: 'ready',
    initializedAt: reviveEpochZero(),
    updatedAt: reviveEpochZero(),
    config: baseConfig,
  }),
  initializeResult: Effect.succeed(
    Either.right({
      ready: true,
      fresh: true,
      state: 'ready',
      initializedAt: reviveEpochZero(),
      updatedAt: reviveEpochZero(),
      config: baseConfig,
    })
  ),
  readiness: Effect.succeed({
    ready: true,
    state: 'ready',
    initializedAt: reviveEpochZero(),
    updatedAt: reviveEpochZero(),
    config: baseConfig,
  }),
  readinessResult: Effect.succeed(
    Either.right({
      ready: true,
      state: 'ready',
      initializedAt: reviveEpochZero(),
      updatedAt: reviveEpochZero(),
      config: baseConfig,
    })
  ),
  lifecycle: bootstrapConfigSnapshot({ config: baseConfig, loadedAt: reviveEpochZero() }).pipe(
    Effect.flatMap(({ config }) =>
      instantiateLifecycleSnapshot({
        state: 'ready',
        updatedAt: baseTimestamp,
        initializedAt: baseTimestamp,
        config,
      })
    )
  ),
})

describe('bootstrap/application', () => {
  it.effect('Context TagsはLayer提供経由で取得できる', () =>
    Effect.gen(function* () {
      const configService = yield* ConfigServiceTag
      const snapshot = yield* configService.snapshot
      expect(snapshot).toStrictEqual(configSnapshot)

      const appService = yield* AppServiceTag
      const readiness = yield* appService.readiness
      expect(readiness.ready).toBe(true)
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(ConfigServiceTag, stubConfigService()),
          Layer.succeed(AppServiceTag, stubAppService())
        )
      )
    )
  )

  it.effect('instantiateLifecycleSnapshotはスキーマ準拠の値を生成する', () =>
    instantiateLifecycleSnapshot({
      state: 'ready',
      updatedAt: baseTimestamp,
      initializedAt: baseTimestamp,
      config: baseConfig,
    }).pipe(
      Effect.map((snapshot) => {
        expect(snapshot.state).toBe('ready')
        expect(snapshot.initializedAt).toBe(baseTimestamp)
      })
    )
  )

  it.effect('projectReadinessはready状態で成功する', () =>
    makeSnapshot('ready', 2_000).pipe(
      Effect.flatMap((snapshot) =>
        projectReadiness(snapshot).pipe(
          Effect.map((readiness) => {
            expect(readiness.ready).toBe(true)
            expect(readiness.state).toBe('ready')
          })
        )
      )
    )
  )

  it.effect('projectReadinessはinitializing状態でLifecycleエラーになる', () =>
    makeSnapshot('initializing').pipe(
      Effect.flatMap((snapshot) =>
        projectReadiness(snapshot).pipe(
          Effect.either,
          Effect.map((result) => {
            expect(result._tag).toBe('Left')
          })
        )
      )
    )
  )

  it.effect('projectReadinessはuninitialized状態でもLifecycleエラーになる', () =>
    makeSnapshot('uninitialized').pipe(
      Effect.flatMap((snapshot) =>
        projectReadiness(snapshot).pipe(
          Effect.either,
          Effect.map((result) => {
            expect(result._tag).toBe('Left')
          })
        )
      )
    )
  )

  it.effect('projectInitializationはready状態でfreshフラグに従う', () =>
    makeSnapshot('ready', 2_500).pipe(
      Effect.flatMap((snapshot) =>
        projectInitialization(snapshot, false).pipe(
          Effect.map((initialization) => {
            expect(initialization.ready).toBe(true)
            expect(initialization.fresh).toBe(false)
          })
        )
      )
    )
  )

  it.effect('projectInitializationはuninitializedで失敗する', () =>
    makeSnapshot('uninitialized').pipe(
      Effect.flatMap((snapshot) =>
        projectInitialization(snapshot, true).pipe(
          Effect.either,
          Effect.map((result) => {
            expect(result._tag).toBe('Left')
          })
        )
      )
    )
  )

  it.effect('projectInitializationはinitializing状態でも失敗する', () =>
    makeSnapshot('initializing').pipe(
      Effect.flatMap((snapshot) =>
        projectInitialization(snapshot, true).pipe(
          Effect.either,
          Effect.map((result) => {
            expect(result._tag).toBe('Left')
          })
        )
      )
    )
  )

  it.effect('ensureReadySnapshotとresetInitializedAtはreadyへ射影する', () =>
    makeSnapshot('initializing').pipe(
      Effect.flatMap((snapshot) =>
        ensureReadySnapshot(snapshot).pipe(
          Effect.flatMap((ready) =>
            resetInitializedAt(ready).pipe(
              Effect.map((resetSnapshot) => {
                expect(ready.state).toBe('ready')
                expect(resetSnapshot.initializedAt).toBe(resetSnapshot.updatedAt)
              })
            )
          )
        )
      )
    )
  )

  it.effect('markInitializedAtは明示的なタイムスタンプを設定する', () => {
    const markedAt = unsafeEpochMilliseconds(9_000)
    return makeSnapshot('ready', 3_000).pipe(
      Effect.flatMap((snapshot) =>
        markInitializedAt(snapshot, markedAt).pipe(
          Effect.flatMap((updated) =>
            epochMilliseconds(updated.initializedAt).pipe(
              Effect.map((brand) => {
                expect(updated.initializedAt).toBe(markedAt)
                expect(brand).toBe(markedAt)
              })
            )
          )
        )
      )
    )
  })

  it.effect('readinessResultはEither.Rightを返す', () =>
    makeSnapshot('ready', 4_000).pipe(
      Effect.flatMap((snapshot) =>
        readinessResult(snapshot).pipe(
          Effect.map((result) =>
            Match.value(result).pipe(
              Match.when({ _tag: 'Right' }, ({ right }) => {
                expect(right.ready).toBe(true)
              }),
              Match.exhaustive
            )
          )
        )
      )
    )
  )

  it.effect('readinessResultはエラー時にLeftを返す', () =>
    makeSnapshot('uninitialized').pipe(
      Effect.flatMap((snapshot) =>
        readinessResult(snapshot).pipe(
          Effect.map((result) => {
            expect(result._tag).toBe('Left')
          })
        )
      )
    )
  )

  it.effect('initializationResultはEitherの成功/失敗を包む', () =>
    makeSnapshot('ready', 5_000).pipe(
      Effect.flatMap((snapshot) =>
        initializationResult(snapshot, true).pipe(
          Effect.map((result) =>
            Match.value(result).pipe(
              Match.when({ _tag: 'Right' }, ({ right }) => {
                expect(right.fresh).toBe(true)
              }),
              Match.exhaustive
            )
          )
        )
      )
    )
  )

  it.effect('initializationResultは未初期化ならLeftを返す', () =>
    makeSnapshot('initializing').pipe(
      Effect.flatMap((snapshot) =>
        initializationResult(snapshot, true).pipe(
          Effect.map((result) => {
            expect(result._tag).toBe('Left')
          })
        )
      )
    )
  )

  it.effect('resolveLifecycleInitializationはinitializedAtを優先する', () =>
    makeSnapshot('ready', 6_000).pipe(
      Effect.map((snapshot) => {
        expect(resolveLifecycleInitialization(snapshot)).toBe(unsafeEpochMilliseconds(6_000))
      })
    )
  )

  it.effect('resolveLifecycleInitializationは未設定時にupdatedAtを返す', () =>
    makeSnapshot('initializing').pipe(
      Effect.map((snapshot) => {
        expect(resolveLifecycleInitialization(snapshot)).toBe(snapshot.updatedAt)
      })
    )
  )

  it('reviveEpochZeroはブランド付きゼロを返す', () => {
    expect(reviveEpochZero()).toBe(0)
  })

  it('stageFromAppErrorはLifecycleエラーではNoneを返す', () => {
    const error = makeLifecycleError({ current: 'ready', requested: 'initialize', message: 'noop' })
    const stage = stageFromAppError(error)
    expect(stage).toStrictEqual(Option.none())
  })

  it.prop(
    'stageFromAppErrorはInitialization以外でSomeにならない',
    [
      fc.constantFrom<AppError>(
        makeLifecycleError({ current: 'ready', requested: 'status', message: 'ok' }),
        makeLifecycleError({ current: 'uninitialized', requested: 'initialize', message: 'pending' })
      ),
    ],
    ([error]) => {
      expect(stageFromAppError(error)).toStrictEqual(Option.none())
    }
  )

  it('stageFromAppErrorはInitializationErrorでSomeを返す', () => {
    const error = makeInitializationError({ stage: 'services', message: 'failed to start' })
    const stage = stageFromAppError(error)
    expect(stage).toStrictEqual(Option.some('services'))
  })
})
