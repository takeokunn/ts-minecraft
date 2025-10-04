import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { calculateBreakDuration, performRaycast, validatePlacement } from '../../domain-service'
import { fromNumbers } from '../../value_object/vector3'
import { fromNormalVector } from '../../value_object/block-face'

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

  const finiteNumber = fc.double({
    min: -100,
    max: 100,
    noDefaultInfinity: true,
    noNaN: true,
  })

  const directionVector = fc.constantFrom<[number, number, number]>(
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  )

  it.effect('raycast returns bounded positions', () =>
    Effect.gen(function* () {
      const origin = yield* fromNumbers(0, 0, 0)
      const cases: ReadonlyArray<{ direction: [number, number, number]; maxDistance: number; step: number }> = [
        { direction: [1, 0, 0], maxDistance: 3, step: 0.5 },
        { direction: [0, 1, 0], maxDistance: 4, step: 1 },
        { direction: [0, 0, -1], maxDistance: 2, step: 0.25 },
      ]

      for (const scenario of cases) {
        const direction = yield* fromNumbers(...scenario.direction)
        const positions = yield* performRaycast({
          origin,
          direction,
          maxDistance: scenario.maxDistance,
          step: scenario.step,
        })

        expect(positions.length).toBeGreaterThanOrEqual(1)
        positions.forEach((position) => {
          const dx = position.x - origin.x
          const dy = position.y - origin.y
          const dz = position.z - origin.z
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          expect(distance).toBeLessThanOrEqual(scenario.maxDistance + 1e-6)
        })
      }
    })
  )
})
