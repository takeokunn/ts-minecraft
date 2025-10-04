import type { ParseError } from '@effect/schema/ParseResult'
import { Context, Either, Effect, pipe } from 'effect'
import * as Match from 'effect/Match'
import {
  AppError,
  AppInitializationResult,
  AppReadiness,
  BootstrapConfig,
  BootstrapConfigSnapshot,
  EpochMilliseconds,
  LifecycleSnapshot,
  LifecycleState,
  appErrorStage,
  initializationProjection,
  makeConfigError,
  makeLifecycleError,
  makeLifecycleSnapshot,
  readinessProjection,
  resolveInitializedAt,
  reviveEpochZero as reviveEpochZeroValue,
  toConfigIssueList,
} from './domain'

const toEither = <A>(effect: Effect.Effect<A, AppError>) => Effect.either(effect)
const schemaFailure = (error: ParseError): AppError => makeConfigError(toConfigIssueList(error))

export interface ConfigService {
  readonly snapshot: Effect.Effect<BootstrapConfigSnapshot>
  readonly snapshotResult: Effect.Effect<Either.Either<AppError, BootstrapConfigSnapshot>>
  readonly reload: Effect.Effect<BootstrapConfigSnapshot, AppError>
  readonly reloadResult: Effect.Effect<Either.Either<AppError, BootstrapConfigSnapshot>>
  readonly current: Effect.Effect<BootstrapConfig>
  readonly currentResult: Effect.Effect<Either.Either<AppError, BootstrapConfig>>
  readonly refresh: Effect.Effect<BootstrapConfig, AppError>
  readonly refreshResult: Effect.Effect<Either.Either<AppError, BootstrapConfig>>
}

export const ConfigServiceTag = Context.GenericTag<ConfigService>('@minecraft/bootstrap/ConfigService')
export const ConfigService = ConfigServiceTag

export interface AppService {
  readonly initialize: Effect.Effect<AppInitializationResult, AppError>
  readonly initializeResult: Effect.Effect<Either.Either<AppError, AppInitializationResult>>
  readonly readiness: Effect.Effect<AppReadiness, AppError>
  readonly readinessResult: Effect.Effect<Either.Either<AppError, AppReadiness>>
  readonly lifecycle: Effect.Effect<LifecycleSnapshot>
}

export const AppServiceTag = Context.GenericTag<AppService>('@minecraft/bootstrap/AppService')
export const AppService = AppServiceTag

export const instantiateLifecycleSnapshot = (params: {
  readonly state: LifecycleState
  readonly updatedAt: EpochMilliseconds
  readonly config: BootstrapConfig
  readonly initializedAt?: EpochMilliseconds
}): Effect.Effect<LifecycleSnapshot, AppError> =>
  pipe(makeLifecycleSnapshot(params), Effect.mapError(schemaFailure))

export const projectReadiness = (
  snapshot: LifecycleSnapshot
): Effect.Effect<AppReadiness, AppError> =>
  Match.value(snapshot.state).pipe(
    Match.when(Match.is('ready'), () =>
      pipe(readinessProjection(snapshot, true), Effect.mapError(schemaFailure))
    ),
    Match.when(Match.is('initializing'), () =>
      Effect.fail(
        makeLifecycleError({
          current: 'initializing',
          requested: 'status',
          message: 'Bootstrapは初期化処理の完了待ちです',
        })
      )
    ),
    Match.when(Match.is('uninitialized'), () =>
      Effect.fail(
        makeLifecycleError({
          current: 'uninitialized',
          requested: 'status',
          message: 'Bootstrapはまだ初期化されていません',
        })
      )
    ),
    Match.exhaustive
  )

export const projectInitialization = (
  snapshot: LifecycleSnapshot,
  fresh: boolean
): Effect.Effect<AppInitializationResult, AppError> =>
  Match.value(snapshot.state).pipe(
    Match.when(Match.is('ready'), () =>
      pipe(initializationProjection(snapshot, fresh), Effect.mapError(schemaFailure))
    ),
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
      Effect.fail(
        makeLifecycleError({
          current: 'uninitialized',
          requested: 'initialize',
          message: 'Bootstrapはまだ初期化されていません',
        })
      )
    ),
    Match.exhaustive
  )

export const ensureReadySnapshot = (
  snapshot: LifecycleSnapshot
): Effect.Effect<LifecycleSnapshot, AppError> =>
  Match.value(snapshot.state).pipe(
    Match.when(Match.is('ready'), () => Effect.succeed(snapshot)),
    Match.orElse(() =>
      instantiateLifecycleSnapshot({
        state: 'ready',
        updatedAt: snapshot.updatedAt,
        initializedAt: snapshot.updatedAt,
        config: snapshot.config,
      })
    )
  )

export const resetInitializedAt = (
  snapshot: LifecycleSnapshot
): Effect.Effect<LifecycleSnapshot, AppError> =>
  instantiateLifecycleSnapshot({
    state: snapshot.state,
    updatedAt: snapshot.updatedAt,
    initializedAt: snapshot.updatedAt,
    config: snapshot.config,
  })

export const markInitializedAt = (
  snapshot: LifecycleSnapshot,
  initializedAt: EpochMilliseconds
): Effect.Effect<LifecycleSnapshot, AppError> =>
  instantiateLifecycleSnapshot({
    state: snapshot.state,
    updatedAt: snapshot.updatedAt,
    initializedAt,
    config: snapshot.config,
  })

export const stageFromAppError = appErrorStage

export const reviveEpochZero = (): EpochMilliseconds => reviveEpochZeroValue()

export const readinessResult = (
  snapshot: LifecycleSnapshot
): Effect.Effect<Either.Either<AppError, AppReadiness>> => toEither(projectReadiness(snapshot))

export const initializationResult = (
  snapshot: LifecycleSnapshot,
  fresh: boolean
): Effect.Effect<Either.Either<AppError, AppInitializationResult>> =>
  toEither(projectInitialization(snapshot, fresh))

export const resolveLifecycleInitialization = (
  snapshot: LifecycleSnapshot
): EpochMilliseconds => resolveInitializedAt(snapshot)
