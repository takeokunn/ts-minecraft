import { Effect, Ref, HashMap, Option } from 'effect'
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
          const cache = yield* Ref.get(materialCache)
          yield* Ref.set(materialCache, HashMap.set(cache, cacheKey, material))
          return material
        })

      yield* Effect.addFinalizer(() => Effect.gen(function* () {
        const cache = yield* Ref.get(materialCache)
        yield* Effect.sync(() => {
          for (const mat of HashMap.values(cache)) mat.dispose()
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
            const material = mesh.material
            if (!material) return

            const cache = yield* Ref.get(materialCache)
            yield* Effect.sync(() => {
              if (Array.isArray(material)) {
                for (const mat of material) {
                  let cached = false
                  for (const [, cachedMaterial] of cache) {
                    if (cachedMaterial !== mat) continue
                    cached = true
                    break
                  }
                  if (!cached) mat.dispose()
                }
                return
              }

              let cached = false
              for (const [, cachedMaterial] of cache) {
                if (cachedMaterial !== material) continue
                cached = true
                break
              }
              if (!cached) material.dispose()
            })
          }),

        disposeAll: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(materialCache)
            yield* Effect.sync(() => {
              for (const material of HashMap.values(cache)) material.dispose()
            })
            yield* Ref.set(materialCache, HashMap.empty())
          }),
      }
    }),
  }
) {}
