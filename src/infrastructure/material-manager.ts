import { MaterialManager } from '@/runtime/services'
import { Effect, Layer, HashMap } from 'effect'
import { MaterialNotFoundError } from '@/core/errors'
import * as THREE from 'three'

export const MaterialManagerLive = Layer.scoped(
  MaterialManager,
  Effect.gen(function* (_) {
    const materials = yield* _(
      Effect.acquireRelease(
        Effect.sync(() =>
          HashMap.make(
            [
              'chunk',
              new THREE.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0,
                roughness: 1,
              }),
            ],
          ),
        ),
        (materials) =>
          Effect.sync(() => {
            for (const [, material] of materials) {
              material.dispose()
            }
          }),
      ),
    )

    const getMaterial = (name: string) =>
      HashMap.get(materials, name).pipe(
        Effect.mapError(() => new MaterialNotFoundError(name)),
      )

    return {
      getMaterial,
    }
  }),
)