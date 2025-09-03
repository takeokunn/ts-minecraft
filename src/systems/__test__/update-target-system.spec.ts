import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { updateTargetSystem } from '../update-target-system'
import { Raycast, World } from '@/runtime/services'
import { EntityId, toEntityId } from '@/domain/entity'
import { SoA } from '@/domain/world'
import { playerQuery } from '@/domain/queries'
import { TargetBlock, TargetNone } from '@/domain/components'
import * as THREE from 'three'

describe('updateTargetSystem', () => {
  it.effect('should update target to TargetNone when raycast does not intersect', () =>
    Effect.gen(function* ($) {
      const entityId = toEntityId(1)
      const soa: SoA<typeof playerQuery> = {
        entities: [entityId],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: updateComponentMock,
      }

      const mockRaycast: Partial<Raycast> = {
        raycast: () => Effect.succeed(Option.none()),
      }

      const testLayer = Layer.succeed(World, mockWorld as World).pipe(
        Layer.provide(Layer.succeed(Raycast, mockRaycast as Raycast)),
      )

      yield* $(updateTargetSystem.pipe(Effect.provide(testLayer)))

      expect(updateComponentMock).toHaveBeenCalledWith(entityId, 'target', new TargetNone())
    }))

  it.effect('should update target to TargetBlock when raycast intersects', () =>
    Effect.gen(function* ($) {
      const entityId = toEntityId(1)
      const soa: SoA<typeof playerQuery> = {
        entities: [entityId],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }

      const intersection = {
        object: { name: 'targetEntity' },
        point: new THREE.Vector3(1, 2, 3),
        face: { normal: new THREE.Vector3(0, 1, 0) },
      } as THREE.Intersection

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: updateComponentMock,
      }

      const mockRaycast: Partial<Raycast> = {
        raycast: () => Effect.succeed(Option.some(intersection)),
      }

      const testLayer = Layer.succeed(World, mockWorld as World).pipe(
        Layer.provide(Layer.succeed(Raycast, mockRaycast as Raycast)),
      )

      yield* $(updateTargetSystem.pipe(Effect.provide(testLayer)))

      const expectedTarget = new TargetBlock({
        _tag: 'block',
        entityId: toEntityId(0),
        face: [0, 1, 0],
        position: { x: 1, y: 2, z: 3 },
      })

      expect(updateComponentMock).toHaveBeenCalledWith(entityId, 'target', expectedTarget)
    }))
})
