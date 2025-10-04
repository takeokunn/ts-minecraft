import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { CollisionResult } from '../collision-result'
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

  it.effect('translate maintains size', () =>
    Effect.gen(function* (_) {
      const offset = vector3({ x: 3, y: -2, z: 5 })
      const translated = yield* _(CollisionResult.translate(box, offset))

      expect(translated.min).toStrictEqual({
        x: box.min.x + offset.x,
        y: box.min.y + offset.y,
        z: box.min.z + offset.z,
      })
      expect(translated.max).toStrictEqual({
        x: box.max.x + offset.x,
        y: box.max.y + offset.y,
        z: box.max.z + offset.z,
      })

      const originalSize = {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z,
      }

      const translatedSize = {
        x: translated.max.x - translated.min.x,
        y: translated.max.y - translated.min.y,
        z: translated.max.z - translated.min.z,
      }

      expect(translatedSize).toStrictEqual(originalSize)
    })
  )
})
