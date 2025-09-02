import * as THREE from 'three'
import { match, P } from 'ts-pattern'
import { Context, Effect, Layer, Option } from 'effect'
import { EntityId } from '@/domain/entity'
import { ThreeCameraService } from './camera-three'

const REACH = 8

export type RaycastResult = {
  readonly entityId: EntityId
  readonly face: { x: number; y: number; z: number }
  readonly intersection: THREE.Intersection
}

// --- Service Definition ---

export interface RaycastService {
  readonly cast: (scene: THREE.Scene, terrainBlockMap: ReadonlyMap<string, EntityId>) => Effect.Effect<Option.Option<RaycastResult>>
}

export const RaycastService = Context.GenericTag<RaycastService>('app/RaycastService')

// --- Live Implementation ---

export const RaycastServiceLive = Layer.effect(
  RaycastService,
  Effect.gen(function* (_) {
    const cameraService = yield* _(ThreeCameraService)
    const raycaster = new THREE.Raycaster()
    const hitPosVec = new THREE.Vector3()
    const centerScreenVec = new THREE.Vector2(0, 0)

    const findHitEntity = (intersection: THREE.Intersection, terrainBlockMap: ReadonlyMap<string, EntityId>): Option.Option<RaycastResult> => {
      if (!intersection.face) {
        return Option.none()
      }
      hitPosVec.copy(intersection.point).add(intersection.face.normal.multiplyScalar(-0.5)).floor()
      const key = `${hitPosVec.x},${hitPosVec.y},${hitPosVec.z}`
      const entityId = terrainBlockMap.get(key)
      if (entityId === undefined) {
        return Option.none()
      }
      return Option.some({
        entityId,
        face: {
          x: intersection.face.normal.x,
          y: intersection.face.normal.y,
          z: intersection.face.normal.z,
        },
        intersection,
      })
    }

    const cast = (scene: THREE.Scene, terrainBlockMap: ReadonlyMap<string, EntityId>) =>
      Effect.sync(() => {
        raycaster.setFromCamera(centerScreenVec, cameraService.camera.camera)
        const intersects = raycaster.intersectObjects(scene.children, false)

        for (const intersection of intersects) {
          const result = match(intersection)
            .with({ distance: P.number.lt(REACH), object: { userData: { type: 'chunk' } } }, (hit) => findHitEntity(hit, terrainBlockMap))
            .otherwise(() => Option.none())

          if (Option.isSome(result)) {
            return result
          }
        }
        return Option.none()
      })

    return { cast }
  }),
)
