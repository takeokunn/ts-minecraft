import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { guardLifecycleTransition, permittedTargets } from './lifecycle'
import type { ApplicationLifecycleState } from './types'

const lifecycleStates: ReadonlyArray<ApplicationLifecycleState> = [
  'Uninitialized',
  'Initializing',
  'Initialized',
  'Starting',
  'Running',
  'Pausing',
  'Paused',
  'Resuming',
  'Stopping',
  'Stopped',
  'Error',
]

describe('application/lifecycle', () => {
  it.effect('allows declared transitions only', () =>
    Effect.forEach(lifecycleStates, (state) =>
      Effect.forEach(permittedTargets(state), (target) => guardLifecycleTransition(state, target))
    )
  )

  it.effect('fails with details on invalid transition', () =>
    guardLifecycleTransition('Running', 'Initialized').pipe(
      Effect.flip,
      Effect.tap((error) => {
        expect(error._tag).toBe('InvalidStateTransitionError')
        expect(error.attemptedState).toBe('Initialized')
        expect(error.currentState).toBe('Running')
      })
    )
  )

  it.effect('rejects disallowed transitions', () =>
    Effect.forEach(lifecycleStates, (state) =>
      Effect.forEach(
        lifecycleStates.filter((candidate) => !permittedTargets(state).includes(candidate)),
        (target) =>
          guardLifecycleTransition(state, target).pipe(
            Effect.flip,
            Effect.tap((error) => expect(error.attemptedState).toBe(target))
          )
      )
    )
  )
})
