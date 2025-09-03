import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { collisionSystem } from '../collision'
import { SpatialGrid, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { Collider, Player, Position, Velocity } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'

describe('collisionSystem', () => {
  it.effect('should resolve collisions and update components', () =>
    Effect.gen(function* ($) {
      const playerEntityId = toEntityId(1)
      const playerPosition = new Position({ x: 0, y: 1, z: 0 })
      const playerVelocity = new Velocity({ dx: 0, dy: -1, dz: 0 })
      const playerCollider = new Collider({ width: 1, height: 2, depth: 1 })
      const player = new Player({ isGrounded: false })

      const blockEntityId = toEntityId(2)
      const blockPosition = new Position({ x: 0, y: 0, z: 0 })
      const blockCollider = new Collider({ width: 1, height: 1, depth: 1 })

      const playerSoa: SoAResult<typeof playerColliderQuery.components> = {
        entities: [playerEntityId],
        components: {
          player: [player],
          position: [playerPosition],
          velocity: [playerVelocity],
          collider: [playerCollider],
        },
      }
      const colliderSoa: SoAResult<typeof positionColliderQuery.components> = {
        entities: [blockEntityId],
        components: {
          position: [blockPosition],
          collider: [blockCollider],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: (query: any) => {
          if (query === playerColliderQuery) {
            return Effect.succeed(playerSoa as any)
          }
          if (query === positionColliderQuery) {
            return Effect.succeed(colliderSoa as any)
          }
          return Effect.fail(new Error('unexpected query'))
        },
        updateComponent: updateComponentMock,
      }

      const mockSpatialGrid: SpatialGrid = {
        add: () => Effect.void,
        query: () => Effect.succeed(new Set([blockEntityId])),
        clear: () => Effect.void,
        register: () => Effect.void,
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld as World),
        Layer.succeed(SpatialGrid, mockSpatialGrid),
      )

      yield* $(collisionSystem.pipe(Effect.provide(testLayer)))

      expect(updateComponentMock).toHaveBeenCalledWith(
        playerEntityId,
        'position',
        new Position({ x: 0, y: 1, z: 0 }),
      )
      expect(updateComponentMock).toHaveBeenCalledWith(
        playerEntityId,
        'velocity',
        new Velocity({ dx: 0, dy: 0, dz: 0 }),
      )
      expect(updateComponentMock).toHaveBeenCalledWith(
        playerEntityId,
        'player',
        new Player({ isGrounded: true }),
      )
    }))

  it.effect('should not do anything if there are no players', () =>
    Effect.gen(function* ($) {
      const playerSoa: SoAResult<typeof playerColliderQuery.components> = {
        entities: [],
        components: {
          player: [],
          position: [],
          velocity: [],
          collider: [],
        },
      }

      const querySoaMock = vi.fn((query: any) => {
        if (query === playerColliderQuery) {
          return Effect.succeed(playerSoa as any)
        }
        return Effect.succeed({ entities: [], components: {} } as any)
      })

      const mockWorld: Partial<World> = {
        querySoA: querySoaMock,
      }

      const queryMock = vi.fn(() => Effect.succeed(new Set()))
      const mockSpatialGrid: SpatialGrid = {
        add: () => Effect.void,
        query: queryMock,
        clear: () => Effect.void,
        register: () => Effect.void,
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld as World),
        Layer.succeed(SpatialGrid, mockSpatialGrid),
      )

      yield* $(collisionSystem.pipe(Effect.provide(testLayer)))

      expect(queryMock).not.toHaveBeenCalled()
    }))
})
