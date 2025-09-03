import { MaterialManager } from '@/runtime/services'
import { Data, Effect, Layer, HashMap } from 'effect'
import * as THREE from 'three'

export class MaterialNotFoundError extends Data.TaggedError('MaterialNotFoundError')<{
  readonly name: string
}> {}

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
        Effect.mapError(() => new MaterialNotFoundError({ name })),
      )

    return MaterialManager.of({
      getMaterial,
    })
  }),
)