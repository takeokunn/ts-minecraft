import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { calculateBreakDuration, performRaycast, validatePlacement } from '../../domain_service'
import { fromNormalVector } from '../../value_object/block_face'
import { fromNumbers } from '../../value_object/vector3'

const propertyConfig: fc.Parameters = { numRuns: 48 }

const finiteNumber = fc.float({ min: -100, max: 100, noDefaultInfinity: true, noNaN: true })

const directionArbitrary = fc
  .tuple(finiteNumber, finiteNumber, finiteNumber)
  .filter(([x, y, z]) => Math.abs(x) + Math.abs(y) + Math.abs(z) > 1e-5)

const raycastInput = fc
  .tuple(directionArbitrary, fc.float({ min: 0.1, max: 8, noDefaultInfinity: true, noNaN: true }), fc.float({ min: 0.05, max: 2, noDefaultInfinity: true, noNaN: true }))
  .filter(([, maxDistance, step]) => step <= maxDistance)

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

  it('raycast returns bounded positions (PBT)', () =>
    fc.assert(
      fc.property(raycastInput, ([directionComponents, maxDistance, step]) => {
        const origin = Effect.runSync(fromNumbers(0, 0, 0))
        const direction = Effect.runSync(fromNumbers(...directionComponents))
        const positions = Effect.runSync(performRaycast({ origin, direction, maxDistance, step }))

        const expectedSteps = Math.max(1, Math.floor(maxDistance / step))
        expect(positions.length).toBeLessThanOrEqual(expectedSteps)

        positions.forEach((position) => {
          const distance = Math.hypot(position.x - origin.x, position.y - origin.y, position.z - origin.z)
          expect(distance).toBeLessThanOrEqual(maxDistance + 1e-6)
        })
      }),
      propertyConfig
    )
  )
})
