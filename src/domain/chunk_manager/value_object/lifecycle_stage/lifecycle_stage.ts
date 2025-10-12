import { Effect, Match } from 'effect'
import {
  ActivationFailure,
  DeactivationFailure,
  type ChunkLifetime,
  type DestructionReason,
  type LifecycleStage,
  type Timestamp,
} from '../../types'

const toStage = (value: LifecycleStage): LifecycleStage => value
const toLifetime = (value: number): ChunkLifetime => value as ChunkLifetime

export const createInitializedStage = (createdAt: Timestamp): LifecycleStage =>
  toStage({ _tag: 'Initialized', createdAt })

export const activateStage = (
  stage: LifecycleStage,
  now: Timestamp
): Effect.Effect<LifecycleStage, ActivationFailure> =>
  Match.value(stage).pipe(
    Match.tag('Active', () => Effect.fail<ActivationFailure>({ _tag: 'AlreadyActive' })),
    Match.tag('Initialized', () => Effect.succeed(toStage({ _tag: 'Active', activatedAt: now }))),
    Match.tag('Inactive', () => Effect.succeed(toStage({ _tag: 'Active', activatedAt: now }))),
    Match.orElse(() => Effect.fail<ActivationFailure>({ _tag: 'LifecycleViolation', stage: stage._tag }))
  )

export const deactivateStage = (
  stage: LifecycleStage,
  now: Timestamp
): Effect.Effect<LifecycleStage, DeactivationFailure> =>
  Match.value(stage).pipe(
    Match.tag('Active', (active) =>
      Effect.succeed(
        toStage({
          _tag: 'Inactive',
          deactivatedAt: now,
          idleFor: toLifetime(0),
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
        toStage({
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
    Match.tag('PendingDestruction', () => Effect.succeed(toStage({ _tag: 'Destroyed', destroyedAt: now }))),
    Match.orElse(() => Effect.fail<DeactivationFailure>({ _tag: 'LifecycleViolation', stage: stage._tag }))
  )

export const updateIdleDuration = (stage: LifecycleStage, idleTime: ChunkLifetime): LifecycleStage =>
  Match.value(stage).pipe(
    Match.tag('Inactive', (inactive) =>
      toStage({
        _tag: 'Inactive',
        deactivatedAt: inactive.deactivatedAt,
        idleFor: idleTime,
      })
    ),
    Match.orElse(() => stage)
  )
