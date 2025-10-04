import { Schema } from '@effect/schema'
import { Effect, Option, pipe } from 'effect'
import * as Match from 'effect/Match'
import { BootstrapConfig, BootstrapConfigSchema } from './config'
import { EpochMilliseconds, EpochMillisecondsSchema } from './value'

export const LifecycleStateSchema = Schema.Literal('uninitialized', 'initializing', 'ready')
export type LifecycleState = Schema.Schema.Type<typeof LifecycleStateSchema>

export const LifecycleIntentSchema = Schema.Literal('initialize', 'status')
export type LifecycleIntent = Schema.Schema.Type<typeof LifecycleIntentSchema>

export const LifecycleSnapshotSchema = Schema.Struct({
  state: LifecycleStateSchema,
  updatedAt: EpochMillisecondsSchema,
  initializedAt: Schema.optional(EpochMillisecondsSchema),
  config: BootstrapConfigSchema,
})

export type LifecycleSnapshot = Schema.Schema.Type<typeof LifecycleSnapshotSchema>
export type LifecycleSnapshotInput = Schema.Schema.From<typeof LifecycleSnapshotSchema>

const decodeLifecycleSnapshot = Schema.decode(LifecycleSnapshotSchema)

export const makeLifecycleSnapshot = (params: {
  readonly state: LifecycleState
  readonly updatedAt: EpochMilliseconds
  readonly config: BootstrapConfig
  readonly initializedAt?: EpochMilliseconds
}): Effect.Effect<LifecycleSnapshot> =>
  decodeLifecycleSnapshot({
    state: params.state,
    updatedAt: params.updatedAt,
    initializedAt: Option.getOrUndefined(Option.fromNullable(params.initializedAt)),
    config: params.config,
  })

export const resolveInitializedAt = (snapshot: LifecycleSnapshot): EpochMilliseconds =>
  pipe(
    Option.fromNullable(snapshot.initializedAt),
    Option.getOrElse(() => snapshot.updatedAt)
  )

const makeReadySnapshot = (snapshot: LifecycleSnapshot) =>
  makeLifecycleSnapshot({
    state: 'ready',
    updatedAt: snapshot.updatedAt,
    initializedAt: snapshot.updatedAt,
    config: snapshot.config,
  })

export const ensureReadySnapshot = (snapshot: LifecycleSnapshot): Effect.Effect<LifecycleSnapshot> =>
  Match.value(snapshot.state).pipe(
    Match.when(Match.is('ready'), () => Effect.succeed(snapshot)),
    Match.orElse(() => makeReadySnapshot(snapshot))
  )

export const resetInitializedAt = (snapshot: LifecycleSnapshot): Effect.Effect<LifecycleSnapshot> =>
  makeReadySnapshot(snapshot)

export const markInitializedAt = (
  snapshot: LifecycleSnapshot,
  initializedAt: EpochMilliseconds
): Effect.Effect<LifecycleSnapshot> =>
  makeLifecycleSnapshot({
    state: snapshot.state,
    updatedAt: snapshot.updatedAt,
    initializedAt,
    config: snapshot.config,
  })

export const AppReadinessSchema = Schema.Struct({
  ready: Schema.Boolean,
  state: LifecycleStateSchema,
  initializedAt: EpochMillisecondsSchema,
  updatedAt: EpochMillisecondsSchema,
  config: BootstrapConfigSchema,
})

export type AppReadiness = Schema.Schema.Type<typeof AppReadinessSchema>
export type AppReadinessInput = Schema.Schema.From<typeof AppReadinessSchema>

const decodeAppReadiness = Schema.decode(AppReadinessSchema)

export const readinessProjection = (snapshot: LifecycleSnapshot, ready: boolean): Effect.Effect<AppReadiness> =>
  decodeAppReadiness({
    ready,
    state: snapshot.state,
    initializedAt: resolveInitializedAt(snapshot),
    updatedAt: snapshot.updatedAt,
    config: snapshot.config,
  })

export const AppInitializationResultSchema = Schema.Struct({
  ready: Schema.Literal(true),
  fresh: Schema.Boolean,
  state: LifecycleStateSchema,
  initializedAt: EpochMillisecondsSchema,
  updatedAt: EpochMillisecondsSchema,
  config: BootstrapConfigSchema,
})

export type AppInitializationResult = Schema.Schema.Type<typeof AppInitializationResultSchema>
export type AppInitializationResultInput = Schema.Schema.From<typeof AppInitializationResultSchema>

const decodeInitializationResult = Schema.decode(AppInitializationResultSchema)

export const initializationProjection = (
  snapshot: LifecycleSnapshot,
  fresh: boolean
): Effect.Effect<AppInitializationResult> =>
  decodeInitializationResult({
    ready: true,
    fresh,
    state: snapshot.state,
    initializedAt: resolveInitializedAt(snapshot),
    updatedAt: snapshot.updatedAt,
    config: snapshot.config,
  })
