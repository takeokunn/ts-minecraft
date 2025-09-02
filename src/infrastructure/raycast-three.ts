import { Context, Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { EntityId } from '@/domain/entity'
import { Vector3 } from '@/domain/geometry'
import { ThreeContextService } from './types'

// --- Service Definition ---

export type RaycastResult = {
  readonly entityId: EntityId
  readonly face: { readonly x: number; readonly y: number; readonly z: number }
  readonly intersection: {
    readonly distance: number
    readonly point: Vector3
  }
}

export class RaycastError extends Data.TaggedError('RaycastError')<{
  readonly originalError: unknown
}> {}

export interface RaycastService {
  readonly cast: (
    scene: THREE.Scene,
    terrainBlockMap: ReadonlyMap<string, EntityId>,
  ) => Effect.Effect<Option.Option<RaycastResult>, RaycastError>
}

export const RaycastService = Context.GenericTag<RaycastService>('app/RaycastService')

// --- Live Implementation ---

export const RaycastServiceLive = Layer.effect(
  RaycastService,
  Effect.gen(function* ($) {
    const threeContext = yield* $(ThreeContextService)
    const raycaster = new THREE.Raycaster()

    const cast = (scene: THREE.Scene, terrainBlockMap: ReadonlyMap<string, EntityId>) =>
      Effect.try({
        try: () => {
          const { camera } = threeContext.camera
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
          const intersects = raycaster.intersectObjects(scene.children)

          for (const intersect of intersects) {
            const { object, point, face } = intersect
            if (object.userData.type === 'chunk' && face) {
              const hitPosition = new THREE.Vector3().copy(point).sub(face.normal.clone().multiplyScalar(0.5)).floor()
              const key = `${hitPosition.x},${hitPosition.y},${hitPosition.z}`
              const entityId = terrainBlockMap.get(key)

              if (entityId) {
                return Option.some<RaycastResult>({
                  entityId,
                  face: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
                  intersection: {
                    distance: intersect.distance,
                    point: [point.x, point.y, point.z],
                  },
                })
              }
            }
          }
          return Option.none<RaycastResult>()
        },
        catch: (originalError) => new RaycastError({ originalError }),
      })

    return { cast }
  }),
)
