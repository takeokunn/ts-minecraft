import { Array as Arr, Effect, Ref, HashMap, Option } from 'effect'
import * as THREE from 'three'
import { MaterialCacheKey } from '@/shared/kernel'

export class BlockMeshService extends Effect.Service<BlockMeshService>()(
  '@minecraft/infrastructure/three/BlockMeshService',
  {
    scoped: Effect.all([
      Effect.acquireRelease(
        Effect.sync(() => new THREE.BoxGeometry(1, 1, 1)),
        (geo) => Effect.sync(() => geo.dispose())
      ),
      Ref.make(HashMap.empty<MaterialCacheKey, THREE.Material>()),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([sharedGeometry, materialCache]) => {
        const createMaterial = (colorOrUrl: string | number): Effect.Effect<THREE.Material, never> =>
          Effect.gen(function* () {
            const cacheKey = MaterialCacheKey.make(colorOrUrl)

            return yield* Option.match(HashMap.get(yield* Ref.get(materialCache), cacheKey), {
              onSome: Effect.succeed,
              onNone: () => Effect.gen(function* () {
                const material = yield* Effect.sync(() => new THREE.MeshLambertMaterial({
                  color: typeof colorOrUrl === 'string' ? colorOrUrl : colorOrUrl,
                }))
                yield* Ref.update(materialCache, (c) => HashMap.set(c, cacheKey, material))
                return material
              }),
            })
          })

        return Effect.acquireRelease(
          Effect.void,
          () => Effect.gen(function* () {
            const cache = yield* Ref.get(materialCache)
            yield* Effect.sync(() => {
              Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (mat) => mat.dispose())
            })
          })
        ).pipe(Effect.as({
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
                      yield* Option.match(cacheKeyOpt, {
                        onNone: () => Effect.sync(() => mat.dispose()),
                        onSome: () => Effect.void,
                      })
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
        }))
      })
    ),
  }
) {}
export const BlockMeshServiceLive = BlockMeshService.Default
