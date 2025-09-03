import { Effect, Layer, Option } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Raycast } from '@/runtime/services'
import { RaycastLive } from '../raycast-three'
import { ThreeJsContext } from '../three-js-context'
import * as THREE from 'three'

const MockThreeJsContext = (camera: THREE.PerspectiveCamera, scene: THREE.Scene) =>
  Layer.succeed(ThreeJsContext, {
    scene,
    camera,
    renderer: undefined as any,
  })

const vector3Arb = fc.tuple(fc.float(), fc.float(), fc.float()).map(([x, y, z]) => new THREE.Vector3(x, y, z))

describe('Raycast', () => {
  it.effect('should return an intersection when camera looks at an object', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(vector3Arb, vector3Arb, async (cameraPos, cubePos) => {
              if (cameraPos.equals(cubePos)) return

              const scene = new THREE.Scene()
              const camera = new THREE.PerspectiveCamera()
              camera.position.copy(cameraPos)
              camera.lookAt(cubePos)
              camera.updateMatrixWorld()

              const geometry = new THREE.BoxGeometry(1, 1, 1)
              const material = new THREE.MeshBasicMaterial()
              const cube = new THREE.Mesh(geometry, material)
              cube.position.copy(cubePos)
              scene.add(cube)

              return Effect.gen(function* (_) {
                const raycastService = yield* _(Raycast)
                const result = yield* _(raycastService.raycast())
                assert.isTrue(Option.isSome(result))
              }).pipe(Effect.provide(RaycastLive), Effect.provide(MockThreeJsContext(camera, scene)), Effect.runPromise)
            }),
          ),
        ),
      )
    }))

  it.effect('should return none if no intersection', () =>
    Effect.gen(function* (_) {
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()
      const raycastService = yield* _(Raycast)
      const result = yield* _(raycastService.raycast())
      assert.isTrue(Option.isNone(result))
    }).pipe(Effect.provide(RaycastLive), Effect.provide(MockThreeJsContext(new THREE.PerspectiveCamera(), new THREE.Scene()))))
})
