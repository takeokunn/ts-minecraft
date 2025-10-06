import { Effect, Match, Schema } from 'effect'
import {
  ActivationFailure,
  ChunkLifetimeSchema,
  DeactivationFailure,
  LifecycleStageSchema,
  type ChunkLifetime,
  type DestructionReason,
  type LifecycleStage,
  type Timestamp,
} from '../../types'

const decodeStage = Schema.decodeUnknownSync(LifecycleStageSchema)
const decodeLifetime = Schema.decodeUnknownSync(ChunkLifetimeSchema)

export const createInitializedStage = (createdAt: Timestamp): LifecycleStage =>
  decodeStage({ _tag: 'Initialized', createdAt })

export const activateStage = (
  stage: LifecycleStage,
  now: Timestamp
): Effect.Effect<LifecycleStage, ActivationFailure> =>
  Match.value(stage).pipe(
    Match.tag('Active', () => Effect.fail<ActivationFailure>({ _tag: 'AlreadyActive' })),
    Match.tag('Initialized', () => Effect.succeed(decodeStage({ _tag: 'Active', activatedAt: now }))),
    Match.tag('Inactive', () => Effect.succeed(decodeStage({ _tag: 'Active', activatedAt: now }))),
    Match.orElse(() => Effect.fail<ActivationFailure>({ _tag: 'LifecycleViolation', stage: stage._tag }))
  )

export const deactivateStage = (
  stage: LifecycleStage,
  now: Timestamp
): Effect.Effect<LifecycleStage, DeactivationFailure> =>
  Match.value(stage).pipe(
    Match.tag('Active', (active) =>
      Effect.succeed(
        decodeStage({
          _tag: 'Inactive',
          deactivatedAt: now,
          idleFor: decodeLifetime(0),
        })
      )
    ),
    Match.tag('Inactive', () => Effect.fail<DeactivationFailure>({ _tag: 'NotActive' })),
    Match.orElse(() => Effect.fail<DeactivationFailure>({ _tag: 'LifecycleViolation', stage: stage._tag }))
  )

export const markPendingDestruction = (
  stage: LifecycleStage,
  now: Timestamp,
  reason: DestructionReason
): Effect.Effect<LifecycleStage, DeactivationFailure> =>
  Match.value(stage).pipe(
    Match.tag('Inactive', () =>
      Effect.succeed(
        decodeStage({
          _tag: 'PendingDestruction',
          markedAt: now,
          reason,
        })
      )
    ),
    Match.orElse(() => Effect.fail<DeactivationFailure>({ _tag: 'LifecycleViolation', stage: stage._tag }))
  )

export const destroyStage = (
  stage: LifecycleStage,
  now: Timestamp
): Effect.Effect<LifecycleStage, DeactivationFailure> =>
  Match.value(stage).pipe(
    Match.tag('PendingDestruction', () => Effect.succeed(decodeStage({ _tag: 'Destroyed', destroyedAt: now }))),
    Match.orElse(() => Effect.fail<DeactivationFailure>({ _tag: 'LifecycleViolation', stage: stage._tag }))
  )

export const updateIdleDuration = (stage: LifecycleStage, idleTime: ChunkLifetime): LifecycleStage =>
  Match.value(stage).pipe(
    Match.tag('Inactive', (inactive) =>
      decodeStage({
        _tag: 'Inactive',
        deactivatedAt: inactive.deactivatedAt,
        idleFor: idleTime,
      })
    ),
    Match.orElse(() => stage)
  )
