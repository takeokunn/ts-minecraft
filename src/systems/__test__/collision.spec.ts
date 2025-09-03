import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { collisionSystem } from '../collision'
import { SpatialGrid, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { Collider, Player, Position, Velocity } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import { AABB } from '@/domain/geometry'
import { Box3 } from 'three'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
  updateComponent: vi.fn(),
}

const mockSpatialGrid: Partial<SpatialGrid> = {
  query: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)
const spatialGridLayer = Layer.succeed(SpatialGrid, mockSpatialGrid as SpatialGrid)
const testLayer = worldLayer.pipe(Layer.provide(spatialGridLayer))

describe('collisionSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should resolve collisions and update components', () =>
    Effect.gen(function* ($) {
      const playerEntityId = EntityId('player')
      const playerPosition = new Position({ x: 0, y: 1, z: 0 })
      const playerVelocity = new Velocity({ dx: 0, dy: -1, dz: 0 })
      const playerCollider = new Collider({ width: 1, height: 2, depth: 1 })
      const player = new Player({ isGrounded: false })

      const blockEntityId = EntityId('block')
      const blockPosition = new Position({ x: 0, y: 0, z: 0 })
      const blockCollider = new Collider({ width: 1, height: 1, depth: 1 })

      const playerSoa: SoA<typeof playerColliderQuery> = {
        entities: [playerEntityId],
        components: {
          player: [player],
          position: [playerPosition],
          velocity: [playerVelocity],
          collider: [playerCollider],
        },
      }
      const colliderSoa: SoA<typeof positionColliderQuery> = {
        entities: [blockEntityId],
        components: {
          position: [blockPosition],
          collider: [blockCollider],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockImplementation((query) => {
        if (query === playerColliderQuery) {
          return Effect.succeed(playerSoa)
        }
        if (query === positionColliderQuery) {
          return Effect.succeed(colliderSoa)
        }
        return Effect.fail(new Error('unexpected query'))
      })
      vi.spyOn(mockSpatialGrid, 'query').mockReturnValue(Effect.succeed([blockEntityId]))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(collisionSystem)

      expect(mockWorld.updateComponent).toHaveBeenCalledWith(
        playerEntityId,
        'position',
        new Position({ x: 0, y: 1, z: 0 }),
      )
      expect(mockWorld.updateComponent).toHaveBeenCalledWith(
        playerEntityId,
        'velocity',
        new Velocity({ dx: 0, dy: 0, dz: 0 }),
      )
      expect(mockWorld.updateComponent).toHaveBeenCalledWith(
        playerEntityId,
        'player',
        new Player({ isGrounded: true }),
      )
    }).pipe(Effect.provide(testLayer)))

  it.effect('should not do anything if there are no players', () =>
    Effect.gen(function* ($) {
      const playerSoa: SoA<typeof playerColliderQuery> = {
        entities: [],
        components: {
          player: [],
          position: [],
          velocity: [],
          collider: [],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockImplementation((query) => {
        if (query === playerColliderQuery) {
          return Effect.succeed(playerSoa)
        }
        return Effect.succeed({ entities: [], components: {} })
      })

      yield* $(collisionSystem)

      expect(mockSpatialGrid.query).not.toHaveBeenCalled()
    }).pipe(Effect.provide(testLayer)))
})
