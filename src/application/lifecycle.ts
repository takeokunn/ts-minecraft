import { Effect, Match, Option, Schema, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import * as HashMap from 'effect/HashMap'
import { InvalidStateTransitionError, JsonValue, createErrorContext } from './errors'
import type { ApplicationLifecycleState } from './types'

const lifecycleArray = Schema.decodeUnknown(Schema.Array(Schema.String))
const decodeJsonValue = Schema.decodeUnknown(JsonValue)

const allowedTransitions = HashMap.fromIterable<
  ApplicationLifecycleState,
  ReadonlyArray.ReadonlyArray<ApplicationLifecycleState>
>([
  ['Uninitialized', ['Initializing']],
  ['Initializing', ['Initialized', 'Error']],
  ['Initialized', ['Starting', 'Error']],
  ['Starting', ['Running', 'Error']],
  ['Running', ['Pausing', 'Stopping', 'Error']],
  ['Pausing', ['Paused', 'Error']],
  ['Paused', ['Resuming', 'Stopping', 'Error']],
  ['Resuming', ['Running', 'Error']],
  ['Stopping', ['Stopped', 'Error']],
  ['Stopped', ['Initializing']],
  ['Error', ['Initializing', 'Stopping']],
])

const validTargets = (current: ApplicationLifecycleState): ReadonlyArray.ReadonlyArray<ApplicationLifecycleState> =>
  pipe(
    HashMap.get(allowedTransitions, current),
    Option.getOrElse(() => ReadonlyArray.empty())
  )

const invalidTransition = (
  current: ApplicationLifecycleState,
  target: ApplicationLifecycleState
): Effect.Effect<never, InvalidStateTransitionError> =>
  Effect.gen(function* () {
    const valid = validTargets(current)
    const currentJson = yield* decodeJsonValue(current)
    const targetJson = yield* decodeJsonValue(target)
    const validList = yield* lifecycleArray(valid)
    const validTransitionsJson = yield* decodeJsonValue(validList)

    const context = yield* createErrorContext({
      system: 'GameApplication',
      operation: 'guardTransition',
      details: [
        { key: 'current', value: currentJson },
        { key: 'target', value: targetJson },
        { key: 'validTransitions', value: validTransitionsJson },
      ],
    })
    return yield* Effect.fail(
      new InvalidStateTransitionError({
        context,
        currentState: current,
        attemptedState: target,
        validTransitions: [...valid],
      })
    )
  })

export const guardLifecycleTransition = (
  current: ApplicationLifecycleState,
  target: ApplicationLifecycleState
): Effect.Effect<void, InvalidStateTransitionError> =>
  Match.value(ReadonlyArray.some(validTargets(current), (state) => state === target)).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() => invalidTransition(current, target))
  )

export const permittedTargets = validTargets
