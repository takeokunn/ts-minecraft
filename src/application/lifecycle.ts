import { Effect, Match, Option, Schema, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import * as HashMap from 'effect/HashMap'
import { InvalidStateTransitionError, JsonValue, createErrorContext } from './errors'
import type { ApplicationLifecycleState } from './types'

const lifecycleArray = Schema.decodeSync(Schema.Array(Schema.String))
const decodeJsonValue = Schema.decodeUnknownSync(JsonValue)

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
    const context = yield* createErrorContext({
      system: 'GameApplication',
      operation: 'guardTransition',
      details: [
        { key: 'current', value: decodeJsonValue(current) },
        { key: 'target', value: decodeJsonValue(target) },
        { key: 'validTransitions', value: decodeJsonValue(lifecycleArray(valid)) },
      ],
    })
    return yield* Effect.fail(
      InvalidStateTransitionError.make({
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
