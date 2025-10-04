import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { CollisionResult } from '../collision_result'
import { aabb, vector3 } from '../../types/core'

describe('CollisionResult', () => {
  const box = aabb({
    min: vector3({ x: 0, y: 0, z: 0 }),
    max: vector3({ x: 1, y: 1, z: 1 }),
  })

  it.effect('detects collision with static block', () =>
    CollisionResult.detect({
      position: vector3({ x: 0, y: 1, z: 0 }),
      velocity: vector3({ x: 0, y: -4, z: 0 }),
      deltaTime: 0.5,
      body: box,
      sample: () => [
        aabb({
          min: vector3({ x: 0, y: -1, z: 0 }),
          max: vector3({ x: 1, y: 0, z: 1 }),
        }),
      ],
    }).pipe(
      Effect.map((result) => {
        expect(result.collidedAxes.y).toBe(true)
        expect(result.isGrounded).toBe(true)
      })
    )
  )

  it.effect.prop('translate maintains size', [fc.float({ min: -5, max: 5 })], ([offset]) =>
    CollisionResult.translate(box, vector3({ x: offset, y: 0, z: 0 })).pipe(
      Effect.map((translated) => {
        expect(translated.max.x - translated.min.x).toBeCloseTo(1)
      })
    )
  )
})
