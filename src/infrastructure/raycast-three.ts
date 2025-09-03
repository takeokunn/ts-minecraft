import { Raycast } from '@/runtime/services'
import { Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { ThreeJsContext } from './three-js-context'

export const RaycastLive = Layer.effect(
  Raycast,
  Effect.gen(function* (_) {
    const { camera, scene } = yield* _(ThreeJsContext)
    const raycaster = yield* _(Effect.sync(() => new THREE.Raycaster()))

    const raycast = () =>
      Effect.sync(() => {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
        const intersects = raycaster.intersectObjects(scene.children)
        return Option.fromNullable(intersects[0])
      })

    return Raycast.of({
      raycast,
    })
  }),
)
