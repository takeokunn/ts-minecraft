import { GameApplicationLive } from '@application/game-application-live'
import { SettingsApplicationServiceLive } from '@application/settings'
import { GameEventQueueLive, GameLoopSupervisorLive } from '@application/game_loop'
import { ObservabilityLayer } from '@application/observability/layer'
import { GameLoopServiceLive } from '@domain/game_loop'
import { InputServiceLive } from '@domain/input'
import { InteractionDomainLive } from '@domain/interaction'
import { SceneManagerLive } from '@domain/scene/manager/live'
import { MenuActionsLive, MenuControllerLive, MenuInputLayer, MenuStateStoreLive } from '@presentation/menu'
import { Clock, ConfigProvider, Effect, Config as EffectConfig, Either, Layer } from 'effect'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as SynchronizedRef from 'effect/SynchronizedRef'
import {
  AppServiceTag,
  ConfigServiceTag,
  instantiateLifecycleSnapshot,
  projectInitialization,
  projectReadiness,
} from './application'
import type {
  BootstrapConfig,
  BootstrapConfigInput,
  BootstrapConfigSnapshot,
  EpochMilliseconds,
  LifecycleState,
} from './domain'
import {
  AppError,
  BootstrapConfigDefaults,
  bootstrapConfig,
  epochMilliseconds,
  makeConfigError,
  makeInitializationError,
  makeLifecycleError,
  materializeConfigSnapshot,
  reviveEpochZero,
  toConfigIssueList,
} from './domain'

const toEither = <A>(effect: Effect.Effect<A, AppError>) => Effect.either(effect)

const acquireProvider = Effect.serviceOption(ConfigProvider.ConfigProvider).pipe(
  Effect.map(Option.getOrElse(() => ConfigProvider.fromEnv({ pathDelim: '_', seqDelim: ',' })))
)

const configDescriptor = EffectConfig.all({
  debug: EffectConfig.boolean('APP_DEBUG').pipe(EffectConfig.withDefault(BootstrapConfigDefaults.debug)),
  fps: EffectConfig.integer('APP_FPS').pipe(EffectConfig.withDefault(BootstrapConfigDefaults.fps)),
  memoryLimit: EffectConfig.integer('APP_MEMORY_LIMIT').pipe(
    EffectConfig.withDefault(BootstrapConfigDefaults.memoryLimit)
  ),
})

const decodeConfig = (input: BootstrapConfigInput) =>
  bootstrapConfig(input).pipe(Effect.mapError((error) => makeConfigError(toConfigIssueList(error))))

const loadFromProvider = (provider: ConfigProvider.ConfigProvider) =>
  provider.load(configDescriptor).pipe(
    Effect.mapError((error) =>
      makeInitializationError({
        stage: 'config',
        message: `Failed to access configuration provider: ${String(error)}`,
        details: String(error),
      })
    )
  )

const hydrateConfig = (provider: ConfigProvider.ConfigProvider) =>
  loadFromProvider(provider).pipe(Effect.flatMap(decodeConfig))

const materializeSnapshot = (config: BootstrapConfig): Effect.Effect<BootstrapConfigSnapshot> =>
  Effect.flatMap(Clock.currentTimeMillis, (millis) =>
    Effect.map(epochMilliseconds(millis), (loadedAt) => materializeConfigSnapshot(config, loadedAt))
  )

const hydrateSnapshot = (provider: ConfigProvider.ConfigProvider) =>
  hydrateConfig(provider).pipe(Effect.flatMap(materializeSnapshot))

const initializedTimestamp = (state: LifecycleState, timestamp: EpochMilliseconds): EpochMilliseconds =>
  Match.value(state).pipe(
    Match.when(Match.is('ready'), () => Option.some(timestamp)),
    Match.orElse(() => Option.none<EpochMilliseconds>()),
    Option.getOrElse(() => reviveEpochZero())
  )

const createLifecycleSnapshot = (state: LifecycleState, config: BootstrapConfig) =>
  Effect.flatMap(Clock.currentTimeMillis, (millis) =>
    Effect.flatMap(epochMilliseconds(millis), (timestamp) =>
      instantiateLifecycleSnapshot({
        state,
        updatedAt: timestamp,
        initializedAt: initializedTimestamp(state, timestamp),
        config,
      })
    )
  )

export const makeConfigService = Effect.gen(function* () {
  const provider = yield* acquireProvider

  const initialSnapshot = materializeConfigSnapshot(BootstrapConfigDefaults, reviveEpochZero())

  const state = yield* SynchronizedRef.make(initialSnapshot)

  const reloadSnapshot = hydrateSnapshot(provider).pipe(Effect.tap((snapshot) => SynchronizedRef.set(state, snapshot)))

  yield* reloadSnapshot.pipe(Effect.catchAll(() => Effect.void))

  const snapshotEffect = SynchronizedRef.get(state)
  const currentConfig = snapshotEffect.pipe(Effect.map((snapshot) => snapshot.config))
  const refreshConfig = reloadSnapshot.pipe(Effect.map((snapshot) => snapshot.config))

  const snapshotResult = snapshotEffect.pipe(
    Effect.map((snapshot) => Either.right<AppError, BootstrapConfigSnapshot>(snapshot))
  )

  const currentResult = currentConfig.pipe(Effect.map((config) => Either.right<AppError, BootstrapConfig>(config)))

  const reloadResult = toEither(reloadSnapshot)
  const refreshResult = toEither(refreshConfig)

  return ConfigServiceTag.of({
    snapshot: snapshotEffect,
    snapshotResult,
    reload: reloadSnapshot,
    reloadResult,
    current: currentConfig,
    currentResult,
    refresh: refreshConfig,
    refreshResult,
  })
})

export const ConfigLayer = Layer.scoped(ConfigServiceTag, makeConfigService)

export const makeAppService = Effect.gen(function* () {
  const configService = yield* ConfigServiceTag

  const configSnapshot = yield* configService.snapshot

  const baseSnapshot = yield* instantiateLifecycleSnapshot({
    state: 'uninitialized',
    updatedAt: reviveEpochZero(),
    config: configSnapshot.config,
  })

  const state = yield* SynchronizedRef.make(baseSnapshot)

  const initialize = Effect.gen(function* () {
    const current = yield* SynchronizedRef.get(state)

    return yield* Match.value(current.state).pipe(
      Match.when(Match.is('ready'), () => projectInitialization(current, false)),
      Match.when(Match.is('initializing'), () =>
        Effect.fail(
          makeLifecycleError({
            current: 'initializing',
            requested: 'initialize',
            message: 'Bootstrap初期化が既に進行中です',
          })
        )
      ),
      Match.when(Match.is('uninitialized'), () =>
        Effect.gen(function* () {
          const preflight = yield* createLifecycleSnapshot('initializing', current.config)
          yield* SynchronizedRef.set(state, preflight)
          const hydratedConfig = yield* configService.refresh
          const readySnapshot = yield* createLifecycleSnapshot('ready', hydratedConfig)
          yield* SynchronizedRef.set(state, readySnapshot)
          return yield* projectInitialization(readySnapshot, true)
        })
      ),
      Match.exhaustive
    )
  })

  const readiness = Effect.gen(function* () {
    const current = yield* SynchronizedRef.get(state)
    return yield* projectReadiness(current)
  })

  const lifecycle = SynchronizedRef.get(state)

  return AppServiceTag.of({
    initialize,
    initializeResult: toEither(initialize),
    readiness,
    readinessResult: toEither(readiness),
    lifecycle,
  })
})

export const AppServiceLayer = Layer.scoped(AppServiceTag, makeAppService)

const BaseServicesLayer = Layer.mergeAll(
  GameLoopServiceLive,
  GameEventQueueLive,
  GameLoopSupervisorLive,
  SceneManagerLive,
  InputServiceLive,
  InteractionDomainLive
)

const ApplicationLayer = Layer.mergeAll(GameApplicationLive, SettingsApplicationServiceLive).pipe(
  Layer.provide(BaseServicesLayer)
)

export const MainLayer = Layer.mergeAll(
  ObservabilityLayer,
  BaseServicesLayer,
  ApplicationLayer,
  ConfigLayer,
  AppServiceLayer
)

export const TestLayer = Layer.mergeAll(ConfigLayer, AppServiceLayer)

export const PresentationLayer = Layer.mergeAll(
  MenuStateStoreLive,
  MenuControllerLive,
  MenuActionsLive,
  MenuInputLayer
)

export const MainPresentationLayer = Layer.mergeAll(MainLayer, PresentationLayer)
