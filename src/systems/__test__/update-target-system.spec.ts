import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { updateTargetSystem } from '../update-target-system'
import { Raycast, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { SoAResult } from '@/domain/types'
import { playerQuery } from '@/domain/queries'
import { TargetBlock, TargetNone } from '@/domain/components'
import * as THREE from 'three'
import { Int, Vector3Int } from '@/domain/common'

const arbitraryVector3 = fc.record({
  x: fc.float(),
  y: fc.float(),
  z: fc.float(),
})

const arbitraryIntersection = fc.record({
  object: fc.record({ name: fc.uuid().map(toEntityId) }),
  point: arbitraryVector3.map((v) => new THREE.Vector3(v.x, v.y, v.z)),
  face: fc.record({ normal: arbitraryVector3.map((v) => new THREE.Vector3(v.x, v.y, v.z)) }),
})

describe('updateTargetSystem', () => {
  it.effect('should adhere to target update properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          fc.option(arbitraryIntersection, { nil: undefined }),
          fc.array(fc.uuid().map(toEntityId)),
          async (intersectionOpt, entityIds) => {
            const soa: SoAResult<typeof playerQuery.components> = {
              entities: entityIds,
            } as any

            const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))

            const mockWorld: Partial<World> = {
              querySoA: () => Effect.succeed(soa),
              updateComponent: updateComponentSpy,
            }

            const mockRaycast: Partial<Raycast> = {
              raycast: () => Effect.succeed(Option.fromNullable(intersectionOpt)),
            }

            const testLayer = Layer.succeed(World, mockWorld as World).pipe(
              Layer.provide(Layer.succeed(Raycast, mockRaycast as Raycast)),
            )

            await Effect.runPromise(updateTargetSystem.pipe(Effect.provide(testLayer)))

            assert.strictEqual(updateComponentSpy.mock.calls.length, entityIds.length)

            if (intersectionOpt) {
              const { object, point, face } = intersectionOpt
              const faceInt: Vector3Int = [
                Int(Math.round(face.normal.x)),
                Int(Math.round(face.normal.y)),
                Int(Math.round(face.normal.z)),
              ]
              const expectedTarget = new TargetBlock({
                _tag: 'block',
                entityId: object.name,
                face: faceInt,
                position: { x: point.x, y: point.y, z: point.z },
              })
              entityIds.forEach((entityId, i) => {
                assert.deepStrictEqual(updateComponentSpy.mock.calls[i], [
                  entityId,
                  'target',
                  expectedTarget,
                ])
              })
            } else {
              const expectedTarget = new TargetNone()
              entityIds.forEach((entityId, i) => {
                assert.deepStrictEqual(updateComponentSpy.mock.calls[i], [
                  entityId,
                  'target',
                  expectedTarget,
                ])
              })
            }
          },
        ),
      ),
    ),
  )
})