import { Effect, Layer } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { createArchetype } from '@/domain/archetypes'
import { playerColliderQuery } from '@/domain/queries'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { SpatialGridService } from '@/runtime/services'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
import { collisionSystem } from '../collision'
import { AABB } from '@/domain/geometry'
import { EntityId } from '@/domain/entity'

class MockSpatialGrid implements SpatialGrid {
  constructor(private entities: EntityId[] = []) {}
  clear = Effect.void
  register = (_entityId: EntityId, _aabb: AABB) => Effect.void
  query = (_aabb: AABB) => Effect.succeed(this.entities)
}

const setupWorld = (playerVelocity: { dx: number; dy: number; dz: number }, blocks: { x: number; y: number; z: number }[]) =>
  Effect.gen(function* ($) {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 1.6, z: 0 },
    })
    const playerId = yield* $(World.addArchetype(playerArchetype))
    yield* $(World.updateComponent(playerId, 'velocity', playerVelocity))

    const blockIds: EntityId[] = []
    for (const pos of blocks) {
      const blockArchetype = createArchetype({
        type: 'block',
        pos,
        blockType: 'dirt',
      })
      const blockId = yield* $(World.addArchetype(blockArchetype))
      blockIds.push(blockId)
    }

    return { playerId, blockIds }
  })

describe('collisionSystem', () => {
  it('should resolve collision and set isGrounded to true', () =>
    Effect.gen(function* ($) {
      const { playerId, blockIds } = yield* $(setupWorld({ dx: 0, dy: -1, dz: 0 }, [{ x: 0, y: 0, z: 0 }]))
      const mockSpatialGrid = new MockSpatialGrid([playerId, ...blockIds])
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, mockSpatialGrid)

      yield* $(Effect.provide(collisionSystem, MockSpatialGridLayer))

      const player = (yield* $(World.query(playerColliderQuery)))[0]
      if (player) {
        expect(player.player.isGrounded).toBe(true)
        expect(player.position.y).toBeCloseTo(1.5, 2)
      } else {
        expect(player).toBeDefined()
      }
    }).pipe(Effect.provide(provideTestLayer())))
})
