import type { ParseError } from '@effect/schema/ParseResult'
import { Context, Effect, Either } from 'effect'
import * as Match from 'effect/Match'
import {
  AppError,
  appErrorStage,
  ensureReadySnapshot as ensureReadySnapshotSchema,
  initializationProjection,
  makeConfigError,
  makeLifecycleError,
  makeLifecycleSnapshot,
  markInitializedAt as markInitializedAtSchema,
  readinessProjection,
  resetInitializedAt as resetInitializedAtSchema,
  resolveInitializedAt,
  reviveEpochZero as reviveEpochZeroValue,
  toConfigIssueList,
} from './domain'
import type {
  AppInitializationResult,
  AppReadiness,
  BootstrapConfig,
  BootstrapConfigSnapshot,
  EpochMilliseconds,
  LifecycleSnapshot,
  LifecycleState,
} from './domain/index'

type LifecycleCases<A> = {
  readonly onReady: () => Effect.Effect<A, AppError>
  readonly onInitializing: () => Effect.Effect<A, AppError>
  readonly onUninitialized: () => Effect.Effect<A, AppError>
}

const matchLifecycleState = <A>(snapshot: LifecycleSnapshot, cases: LifecycleCases<A>): Effect.Effect<A, AppError> =>
  Match.value(snapshot.state).pipe(
    Match.when(Match.is('ready'), cases.onReady),
    Match.when(Match.is('initializing'), cases.onInitializing),
    Match.when(Match.is('uninitialized'), cases.onUninitialized),
    Match.exhaustive
  )

const toEither = <A>(effect: Effect.Effect<A, AppError>) => Effect.either(effect)

const schemaFailure = (error: ParseError): AppError => makeConfigError(toConfigIssueList(error))

const withSchemaFailure = <A>(effect: Effect.Effect<A, ParseError>): Effect.Effect<A, AppError> =>
  effect.pipe(Effect.mapError(schemaFailure))

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
}): Effect.Effect<LifecycleSnapshot, AppError> => withSchemaFailure(makeLifecycleSnapshot(params))

export const projectReadiness = (snapshot: LifecycleSnapshot): Effect.Effect<AppReadiness, AppError> =>
  matchLifecycleState(snapshot, {
    onReady: () => withSchemaFailure(readinessProjection(snapshot, true)),
    onInitializing: () =>
      Effect.fail(
        makeLifecycleError({
          current: 'initializing',
          requested: 'status',
          message: 'Bootstrapは初期化処理の完了待ちです',
        })
      ),
    onUninitialized: () =>
      Effect.fail(
        makeLifecycleError({
          current: 'uninitialized',
          requested: 'status',
          message: 'Bootstrapはまだ初期化されていません',
        })
      ),
  })

export const projectInitialization = (
  snapshot: LifecycleSnapshot,
  fresh: boolean
): Effect.Effect<AppInitializationResult, AppError> =>
  matchLifecycleState(snapshot, {
    onReady: () => withSchemaFailure(initializationProjection(snapshot, fresh)),
    onInitializing: () =>
      Effect.fail(
        makeLifecycleError({
          current: 'initializing',
          requested: 'initialize',
          message: 'Bootstrap初期化が既に進行中です',
        })
      ),
    onUninitialized: () =>
      Effect.fail(
        makeLifecycleError({
          current: 'uninitialized',
          requested: 'initialize',
          message: 'Bootstrapはまだ初期化されていません',
        })
      ),
  })

export const ensureReadySnapshot = (snapshot: LifecycleSnapshot): Effect.Effect<LifecycleSnapshot, AppError> =>
  withSchemaFailure(ensureReadySnapshotSchema(snapshot))

export const resetInitializedAt = (snapshot: LifecycleSnapshot): Effect.Effect<LifecycleSnapshot, AppError> =>
  withSchemaFailure(resetInitializedAtSchema(snapshot))

export const markInitializedAt = (
  snapshot: LifecycleSnapshot,
  initializedAt: EpochMilliseconds
): Effect.Effect<LifecycleSnapshot, AppError> => withSchemaFailure(markInitializedAtSchema(snapshot, initializedAt))

export const stageFromAppError = appErrorStage

export const reviveEpochZero = (): EpochMilliseconds => reviveEpochZeroValue()

export const readinessResult = (snapshot: LifecycleSnapshot): Effect.Effect<Either.Either<AppError, AppReadiness>> =>
  toEither(projectReadiness(snapshot))

export const initializationResult = (
  snapshot: LifecycleSnapshot,
  fresh: boolean
): Effect.Effect<Either.Either<AppError, AppInitializationResult>> => toEither(projectInitialization(snapshot, fresh))

export const resolveLifecycleInitialization = (snapshot: LifecycleSnapshot): EpochMilliseconds =>
  resolveInitializedAt(snapshot)
