import { Effect, Ref } from 'effect'
import * as THREE from 'three'

export class BlockMeshService extends Effect.Service<BlockMeshService>()(
  '@minecraft/infrastructure/three/BlockMeshService',
  {
    scoped: Effect.gen(function* () {
      const sharedGeometry = yield* Effect.acquireRelease(
        Effect.sync(() => new THREE.BoxGeometry(1, 1, 1)),
        (geo) => Effect.sync(() => geo.dispose())
      )

      const materialCache = yield* Ref.make<Map<string, THREE.Material>>(new Map())

      yield* Effect.acquireRelease(
        Effect.void,
        () => Effect.gen(function* () {
          const cache = yield* Ref.get(materialCache)
          cache.forEach((mat) => mat.dispose())
        })
      )

      const createMaterial = (colorOrUrl: string | number): Effect.Effect<THREE.Material, never> =>
        Effect.gen(function* () {
          const cacheKey = `material-${typeof colorOrUrl}-${colorOrUrl}`

          const cache = yield* Ref.get(materialCache)
          if (cache.has(cacheKey)) {
            return cache.get(cacheKey)!
          }

          const material = new THREE.MeshStandardMaterial({
            color: typeof colorOrUrl === 'string' ? colorOrUrl : colorOrUrl,
            roughness: 0.8,
            metalness: 0,
          })

          yield* Ref.update(materialCache, (c) => new Map(c).set(cacheKey, material))

          return material
        })

      return {
        createSolidBlockMesh: (color: string | number, position: THREE.Vector3): Effect.Effect<THREE.Mesh, never> =>
          Effect.gen(function* () {
            const material = yield* createMaterial(color)

            const mesh = new THREE.Mesh(sharedGeometry, material)

            mesh.position.copy(position)

            return mesh
          }),

        getSharedGeometry: (): Effect.Effect<THREE.BoxGeometry, never> => Effect.succeed(sharedGeometry),

        disposeMesh: (mesh: THREE.Mesh): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

              for (const mat of materials) {
                const cache = yield* Ref.get(materialCache)
                const cacheKey = Array.from(cache.entries()).find(
                  ([_, m]) => m === mat
                )?.[0]

                if (!cacheKey) {
                  mat.dispose()
                }
              }
            }
          }),

        disposeAll: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.modify(materialCache, (cache): [void, Map<string, THREE.Material>] => {
              cache.forEach((material) => material.dispose())
              return [undefined, new Map()]
            })
          }),
      }
    }),
  }
) {}
export const BlockMeshServiceLive = BlockMeshService.Default
