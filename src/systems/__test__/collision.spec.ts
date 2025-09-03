import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer, Array as ReadonlyArray } from 'effect'
import * as fc from 'effect/FastCheck'
import { collisionSystem } from '../collision'
import { SpatialGrid, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { Collider, Player, Position, Velocity } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import {
  arbitraryPlayer,
  arbitraryPosition,
  arbitraryVelocity,
  arbitraryCollider,
} from '@test/arbitraries'
import { AABB, createAABB } from '@/domain/geometry'

const arbitraryBlock = fc.record({
  position: arbitraryPosition,
  collider: arbitraryCollider,
})

describe('collisionSystem', () => {
  it.effect('should adhere to collision properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          fc.option(
            fc.record({
              player: arbitraryPlayer,
              position: arbitraryPosition,
              velocity: arbitraryVelocity,
              collider: arbitraryCollider,
            }),
            { nil: undefined },
          ),
          fc.array(arbitraryBlock),
          async (playerOpt, blocks) => {
            const playerEntityId = toEntityId(0)
            const blockEntities = blocks.map((_, i) => toEntityId(i + 1))

            const playerSoa: SoAResult<typeof playerColliderQuery.components> = {
              entities: playerOpt ? [playerEntityId] : [],
              components: {
                player: playerOpt ? [playerOpt.player] : [],
                position: playerOpt ? [playerOpt.position] : [],
                velocity: playerOpt ? [playerOpt.velocity] : [],
                collider: playerOpt ? [playerOpt.collider] : [],
              },
            }
            const colliderSoa: SoAResult<typeof positionColliderQuery.components> = {
              entities: blockEntities,
              components: {
                position: blocks.map((b) => b.position),
                collider: blocks.map((b) => b.collider),
              },
            }

            const updatedValues: {
              position?: Position
              velocity?: Velocity
              player?: Player
            } = {}
            const updateComponentMock = vi.fn((_entityId, componentName, value) => {
              updatedValues[componentName as keyof typeof updatedValues] = value
              return Effect.succeed(undefined)
            })

            const mockWorld: Partial<World> = {
              querySoA: (query: any) => {
                if (query === playerColliderQuery) return Effect.succeed(playerSoa as any)
                if (query === positionColliderQuery) return Effect.succeed(colliderSoa as any)
                return Effect.fail(new Error('unexpected query'))
              },
              updateComponent: updateComponentMock,
            }

            const querySpy = vi.fn(() => Effect.succeed(new Set(blockEntities)))
            const mockSpatialGrid: SpatialGrid = {
              add: () => Effect.void,
              query: querySpy,
              clear: () => Effect.void,
              register: () => Effect.void,
            }

            const testLayer = Layer.merge(
              Layer.succeed(World, mockWorld as World),
              Layer.succeed(SpatialGrid, mockSpatialGrid),
            )

            await Effect.runPromise(collisionSystem.pipe(Effect.provide(testLayer)))

            if (!playerOpt) {
              assert.strictEqual(querySpy.mock.calls.length, 0)
              return
            }

            const finalPosition = updatedValues.position ?? playerOpt.position
            const finalVelocity = updatedValues.velocity ?? playerOpt.velocity
            const finalPlayer = updatedValues.player ?? playerOpt.player
            const playerAABB = createAABB(finalPosition, playerOpt.collider)

            const blockAABBs = blocks.map((b) => createAABB(b.position, b.collider))

            blockAABBs.forEach((blockAABB) => {
              assert.isFalse(AABB.intersects(playerAABB, blockAABB), 'Player should not intersect with any blocks')
            })

            const initialPlayerAABB = createAABB(playerOpt.position, playerOpt.collider)
            const collidedY = ReadonlyArray.some(blockAABBs, (blockAABB) => AABB.intersects(initialPlayerAABB, blockAABB) && playerOpt.velocity.dy < 0)
            if (collidedY) {
              assert.isTrue(finalPlayer.isGrounded, 'Player should be grounded after collision')
              assert.strictEqual(finalVelocity.dy, 0, 'Player dy should be 0 after collision')
            }
          },
        ),
      ),
    ),
  )
})