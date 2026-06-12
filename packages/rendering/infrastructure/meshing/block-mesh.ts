import { Array as Arr, Effect, Ref, HashMap, Option } from 'effect'
import * as THREE from 'three'
import { MaterialCacheKey } from '@ts-minecraft/core'

export class BlockMeshService extends Effect.Service<BlockMeshService>()(
  '@minecraft/infrastructure/three/BlockMeshService',
  {
    scoped: Effect.gen(function* () {
      const sharedGeometry = yield* Effect.acquireRelease(
        Effect.sync(() => new THREE.BoxGeometry(1, 1, 1)),
        (geo) => Effect.sync(() => geo.dispose())
      )
      const materialCache = yield* Ref.make(HashMap.empty<MaterialCacheKey, THREE.Material>())

      const createMaterial = (colorOrUrl: string | number): Effect.Effect<THREE.Material, never> =>
        Effect.gen(function* () {
          const cacheKey = MaterialCacheKey.make(colorOrUrl)

          const cached = Option.getOrNull(HashMap.get(yield* Ref.get(materialCache), cacheKey))
          if (cached !== null) return cached
          const material = yield* Effect.sync(() => new THREE.MeshLambertMaterial({
            color: typeof colorOrUrl === 'string' ? colorOrUrl : colorOrUrl,
          }))
          yield* Ref.update(materialCache, (c) => HashMap.set(c, cacheKey, material))
          return material
        })

      yield* Effect.addFinalizer(() => Effect.gen(function* () {
        const cache = yield* Ref.get(materialCache)
        yield* Effect.sync(() => {
          Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (mat) => mat.dispose())
        })
      }))

      return {
        createSolidBlockMesh: (color: string | number, position: THREE.Vector3): Effect.Effect<THREE.Mesh, never> =>
          Effect.gen(function* () {
            const material = yield* createMaterial(color)

            return yield* Effect.sync(() => {
              const mesh = new THREE.Mesh(sharedGeometry, material)
              mesh.position.copy(position)
              return mesh
            })
          }),

        getSharedGeometry: (): Effect.Effect<THREE.BoxGeometry, never> => Effect.succeed(sharedGeometry),

        disposeMesh: (mesh: THREE.Mesh): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (mesh.material) {
              const materials: ReadonlyArray<THREE.Material> = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]
              yield* Effect.forEach(
                materials,
                (mat) =>
                  Effect.gen(function* () {
                    const cache = yield* Ref.get(materialCache)
                    const cacheKeyOpt = Option.map(
                      Arr.findFirst(Arr.fromIterable(cache), ([, m]) => m === mat),
                      ([k]) => k
                    )
                    if (Option.isNone(cacheKeyOpt)) yield* Effect.sync(() => mat.dispose())
                  }),
                { concurrency: 1 }
              )
            }
          }),

        disposeAll: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(materialCache)
            yield* Effect.sync(() => {
              Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (material) => material.dispose())
            })
            yield* Ref.set(materialCache, HashMap.empty())
          }),
      }
    }),
  }
) {}
export const BlockMeshServiceLive = BlockMeshService.Default
