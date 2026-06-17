import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'

import { handleRightClickPriority } from './interaction-right-click-handler'

type Step = 'shear' | 'feed' | 'consume' | 'farm' | 'bucket' | 'ignite' | 'place'

const makeHandlers = (results: Partial<Record<Step, boolean>> = {}) => {
  const calls: Step[] = []

  return {
    calls,
    handlers: {
      shearAnimal: () =>
        Effect.sync(() => {
          calls.push('shear')
          return results.shear ?? false
        }),
      feedAnimal: () =>
        Effect.sync(() => {
          calls.push('feed')
          return results.feed ?? false
        }),
      consumeFood: () =>
        Effect.sync(() => {
          calls.push('consume')
          return results.consume ?? false
        }),
      farm: () =>
        Effect.sync(() => {
          calls.push('farm')
          return results.farm ?? false
        }),
      bucket: () =>
        Effect.sync(() => {
          calls.push('bucket')
          return results.bucket ?? false
        }),
      ignite: () =>
        Effect.sync(() => {
          calls.push('ignite')
          return results.ignite ?? false
        }),
      place: () =>
        Effect.sync(() => {
          calls.push('place')
        }),
    },
  }
}

describe('handleRightClickPriority', () => {
  const cases: Array<{
    readonly name: string
    readonly results: Partial<Record<Step, boolean>>
    readonly expectedCalls: Step[]
  }> = [
    {
      name: 'stops after shearing succeeds',
      results: { shear: true },
      expectedCalls: ['shear'],
    },
    {
      name: 'stops after feeding succeeds',
      results: { feed: true },
      expectedCalls: ['shear', 'feed'],
    },
    {
      name: 'stops after consuming food succeeds',
      results: { consume: true },
      expectedCalls: ['shear', 'feed', 'consume'],
    },
    {
      name: 'stops after farming succeeds',
      results: { farm: true },
      expectedCalls: ['shear', 'feed', 'consume', 'farm'],
    },
    {
      name: 'stops after bucket interaction succeeds',
      results: { bucket: true },
      expectedCalls: ['shear', 'feed', 'consume', 'farm', 'bucket'],
    },
    {
      name: 'stops after ignition succeeds',
      results: { ignite: true },
      expectedCalls: ['shear', 'feed', 'consume', 'farm', 'bucket', 'ignite'],
    },
    {
      name: 'falls through to placement when no earlier handler succeeds',
      results: {},
      expectedCalls: ['shear', 'feed', 'consume', 'farm', 'bucket', 'ignite', 'place'],
    },
  ]

  for (const testCase of cases) {
    it.effect(testCase.name, () =>
      Effect.gen(function* () {
        const { calls, handlers } = makeHandlers(testCase.results)

        yield* handleRightClickPriority(handlers)

        expect(calls).toEqual(testCase.expectedCalls)
      }),
    )
  }
})
