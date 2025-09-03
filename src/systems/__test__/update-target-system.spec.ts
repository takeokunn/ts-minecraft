import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { updateTargetSystem } from '../update-target-system'
import { Raycast, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { SoA } from '@/domain/world'
import { playerQuery } from '@/domain/queries'
import { TargetBlock, TargetNone } from '@/domain/components'
import * as THREE from 'three'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
  updateComponent: vi.fn(),
}

const mockRaycast: Partial<Raycast> = {
  raycast: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)
const raycastLayer = Layer.succeed(Raycast, mockRaycast as Raycast)
const testLayer = worldLayer.pipe(Layer.provide(raycastLayer))

describe('updateTargetSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should update target to TargetNone when raycast does not intersect', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('player')
      const soa: SoA<typeof playerQuery> = {
        entities: [entityId],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockRaycast, 'raycast').mockReturnValue(Effect.succeed(Option.none()))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(updateTargetSystem)

      expect(mockWorld.updateComponent).toHaveBeenCalledWith(entityId, 'target', new TargetNone())
    }).pipe(Effect.provide(testLayer)))

  it.effect('should update target to TargetBlock when raycast intersects', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('player')
      const soa: SoA<typeof playerQuery> = {
        entities: [entityId],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
        },
      }

      const intersection = {
        object: { name: 'targetEntity' },
        point: new THREE.Vector3(1, 2, 3),
        face: { normal: new THREE.Vector3(0, 1, 0) },
      } as THREE.Intersection

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockRaycast, 'raycast').mockReturnValue(Effect.succeed(Option.some(intersection)))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(updateTargetSystem)

      const expectedTarget = new TargetBlock({
        _tag: 'block',
        entityId: EntityId('targetEntity'),
        face: [0, 1, 0],
        position: { x: 1, y: 2, z: 3 },
      })

      expect(mockWorld.updateComponent).toHaveBeenCalledWith(entityId, 'target', expectedTarget)
    }).pipe(Effect.provide(testLayer)))
})
