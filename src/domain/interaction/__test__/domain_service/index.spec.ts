import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { calculateBreakDuration, performRaycast, validatePlacement } from '../../domain_service'
import { fromNumbers } from '../../value_object/vector3'
import { fromNormalVector } from '../../value_object/block_face'

describe('domain_service', () => {
  it.effect('computes break duration with haste modifier', () =>
    Effect.gen(function* () {
      const duration = yield* calculateBreakDuration({ blockHardness: 5, toolEfficiency: 10, hasteLevel: 2 })
      expect(duration).toBeCloseTo(0.5 * (1 - 0.2), 5)
    })
  )

  it.effect('validates placement rules', () =>
    Effect.gen(function* () {
      const player = yield* fromNumbers(0, 0, 0)
      const block = yield* fromNumbers(0, 0, 1)
      const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
      yield* validatePlacement({ face, playerPosition: player, blockPosition: block })
    })
  )

  it.effect('rejects placement when too far', () =>
    Effect.gen(function* () {
      const player = yield* fromNumbers(0, 0, 0)
      const block = yield* fromNumbers(0, 0, 7)
      const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
      const exit = yield* Effect.either(validatePlacement({ face, playerPosition: player, blockPosition: block }))
      expect(exit._tag).toBe('Left')
    })
  )

  it.effect.prop('raycast returns bounded positions', [fc.double({ min: 1, max: 5 })], ([distance]) =>
    Effect.gen(function* () {
      const origin = yield* fromNumbers(0, 0, 0)
      const direction = yield* fromNumbers(1, 0, 0)
      const positions = yield* performRaycast({ origin, direction, maxDistance: distance, step: 0.5 })
      expect(positions.length).toBe(Math.max(1, Math.floor(distance / 0.5)))
    })
  )
})
