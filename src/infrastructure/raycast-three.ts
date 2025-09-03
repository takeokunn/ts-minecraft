import { Raycast } from '@/runtime/services'
import { Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { ThreeJsContextTag } from './three-js-context'

export const RaycastLive = Layer.effect(
  Raycast,
  Effect.gen(function* (_) {
    const { camera, scene } = yield* _(ThreeJsContextTag)
    const raycaster = yield* _(Effect.sync(() => new THREE.Raycaster()))

    const raycast = () =>
      Effect.sync(() => {
        raycaster.setFromCamera({ x: 0, y: 0 }, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        return Option.fromNullable(intersects[0])
      })

    return Raycast.of({
      raycast,
    })
  }),
)
