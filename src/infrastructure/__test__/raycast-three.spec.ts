import { Effect, Layer, Option } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { Raycast } from '@/runtime/services'
import { RaycastLive } from '../raycast-three'
import { ThreeJsContext } from '../three-js-context'
import * as THREE from 'three'

const MockThreeJsContext = Layer.effect(
  ThreeJsContext,
  Effect.sync(() => ({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    renderer: undefined as any,
  })),
)

describe('Raycast', () => {
  it.effect('should return an intersection', () =>
    Effect.gen(function* (_) {
      const { scene, camera } = yield* _(ThreeJsContext)
      const raycastService = yield* _(Raycast)

      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      const cube = new THREE.Mesh(geometry, material)
      cube.position.z = -5
      scene.add(cube)
      camera.position.z = 5
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()

      const result = yield* _(raycastService.raycast())
      assert.isTrue(Option.isSome(result))
    }).pipe(Effect.provide(RaycastLive), Effect.provide(MockThreeJsContext)))

  it.effect('should return none if no intersection', () =>
    Effect.gen(function* (_) {
      const raycastService = yield* _(Raycast)
      const result = yield* _(raycastService.raycast())
      assert.isTrue(Option.isNone(result))
    }).pipe(Effect.provide(RaycastLive), Effect.provide(MockThreeJsContext)))
})
