import { Effect, Context, Layer, Ref } from 'effect'
import * as THREE from 'three'

export class MeshError {
  readonly _tag = 'MeshError'
  constructor(
    readonly message: string,
    readonly cause?: unknown
  ) {}
}

export interface BlockMeshService {
  readonly createMesh: (blockType: string, position: THREE.Vector3) => Effect.Effect<THREE.Mesh, MeshError>
  readonly createSolidBlockMesh: (color: string | number, position: THREE.Vector3) => Effect.Effect<THREE.Mesh, never>
  readonly getSharedGeometry: () => Effect.Effect<THREE.BoxGeometry, never>
  readonly disposeMesh: (mesh: THREE.Mesh) => Effect.Effect<void, never>
  readonly disposeAll: () => Effect.Effect<void, never>
}

export const BlockMeshService = Context.GenericTag<BlockMeshService>(
  '@minecraft/infrastructure/BlockMeshService'
)

export const BlockMeshServiceLive = Layer.effect(
  BlockMeshService,
  Effect.gen(function* () {
    const sharedGeometry = new THREE.BoxGeometry(1, 1, 1)

    const materialCache = yield* Ref.make<Map<string, THREE.Material>>(new Map())

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

    return BlockMeshService.of({
      createMesh: (blockType, position) =>
        Effect.gen(function* () {
          const mesh = new THREE.Mesh(
            sharedGeometry,
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              roughness: 0.8,
              metalness: 0,
            })
          )

          mesh.position.copy(position)

          mesh.geometry.computeBoundingBox()

          const box = mesh.geometry.boundingBox
          if (box) {
            const size = new THREE.Vector3()
            box.getSize(size)

            const uvAttribute = mesh.geometry.attributes.uv as THREE.BufferAttribute
            const uvArray = uvAttribute.array as Float32Array

            const faces = 6
            const uvPerFace = 4
            const uvsPerVertex = 2

            for (let face = 0; face < faces; face++) {
              const faceIndex = face * uvPerFace * uvsPerVertex

              for (let vertex = 0; vertex < uvPerFace; vertex++) {
                const vertexIndex = faceIndex + vertex * uvsPerVertex
                uvArray[vertexIndex] = 0
                uvArray[vertexIndex + 1] = 0
              }

              uvArray[faceIndex + 2] = 1
              uvArray[faceIndex + 3] = 0
              uvArray[faceIndex + 4] = 1
              uvArray[faceIndex + 5] = 1
              uvArray[faceIndex + 6] = 0
              uvArray[faceIndex + 7] = 1
            }

            uvAttribute.needsUpdate = true
          }

          return mesh
        }),

      createSolidBlockMesh: (color, position) =>
        Effect.gen(function* () {
          const material = yield* createMaterial(color)

          const mesh = new THREE.Mesh(sharedGeometry, material)

          mesh.position.copy(position)

          return mesh
        }),

      getSharedGeometry: () => Effect.sync(() => sharedGeometry),

      disposeMesh: (mesh) =>
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

      disposeAll: () =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(materialCache)
          cache.forEach((material) => material.dispose())
          yield* Ref.set(materialCache, new Map())
        })
    })
  })
)
