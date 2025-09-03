import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import * as fc from 'effect/FastCheck'
import { physicsSystem } from '../physics'
import { Clock, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { Player, Position, Velocity } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, GRAVITY, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { arbitraryPlayer, arbitraryPosition, arbitraryVelocity } from '@test/arbitraries'
import { toFloat } from '@/domain/common'

const arbitraryPhysicsEntity = fc.record({
  player: arbitraryPlayer,
  position: arbitraryPosition,
  velocity: arbitraryVelocity,
})

describe('physicsSystem', () => {
  it.effect('should adhere to physics properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          fc.array(arbitraryPhysicsEntity),
          fc.float({ min: 0, max: 1 }), // deltaTime
          async (entities, deltaTime) => {
            const entityIds = entities.map((_, i) => toEntityId(i))
            const soa: SoAResult<typeof physicsQuery.components> = {
              entities: entityIds,
              components: {
                player: entities.map((e) => e.player),
                position: entities.map((e) => e.position),
                velocity: entities.map((e) => e.velocity),
                gravity: [],
              },
            }

            const querySoaSpy = vi.fn(() => Effect.succeed(soa as any))
            const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))

            const mockWorld: Partial<World> = {
              querySoA: querySoaSpy,
              updateComponent: updateComponentSpy,
            }

            const mockClock: Clock = {
              deltaTime: Ref.unsafeMake(deltaTime),
              onFrame: () => Effect.void,
            }

            const testLayer = Layer.merge(
              Layer.succeed(World, mockWorld as World),
              Layer.succeed(Clock, mockClock),
            )

            await Effect.runPromise(physicsSystem.pipe(Effect.provide(testLayer)))

            if (deltaTime === 0) {
              assert.strictEqual(querySoaSpy.mock.calls.length, 0)
              return
            }

            assert.strictEqual(querySoaSpy.mock.calls.length, 1)
            assert.strictEqual(updateComponentSpy.mock.calls.length, entities.length * 2)

            entities.forEach((entity, i) => {
              const { player, position, velocity } = entity
              let expectedDx = velocity.dx
              let expectedDz = velocity.dz
              let expectedDy = velocity.dy

              if (player.isGrounded) {
                expectedDx *= FRICTION
                expectedDz *= FRICTION
                expectedDy = toFloat(0)
              } else {
                expectedDy = Math.max(-TERMINAL_VELOCITY, velocity.dy - GRAVITY * deltaTime)
              }

              const expectedVelocity = new Velocity({
                dx: toFloat(expectedDx),
                dy: toFloat(expectedDy),
                dz: toFloat(expectedDz),
              })

              const expectedPosition = new Position({
                x: toFloat(position.x + expectedVelocity.dx * deltaTime),
                y: toFloat(position.y + expectedVelocity.dy * deltaTime),
                z: toFloat(position.z + expectedVelocity.dz * deltaTime),
              })

              const entityId = entityIds[i]
              const calls = updateComponentSpy.mock.calls.filter((call) => call[0] === entityId)
              expect(calls).toContainEqual([entityId, 'velocity', expectedVelocity])
              expect(calls).toContainEqual([entityId, 'position', expectedPosition])
            })
          },
        ),
      ),
    ),
  )
})