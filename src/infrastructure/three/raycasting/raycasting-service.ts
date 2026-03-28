import { Array as Arr, Effect, Option, Schema } from 'effect'
import * as THREE from 'three'
import { Vector3Schema } from '@/shared/math/three'

/**
 * Result of a raycast hit
 */
export const RaycastHitSchema = Schema.Struct({
  /** World position of hit point */
  point: Vector3Schema,
  /** Normal of hit surface */
  normal: Vector3Schema,
  /** Distance from ray origin */
  distance: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  /** Block X coordinate */
  blockX: Schema.Number.pipe(Schema.int()),
  /** Block Y coordinate */
  blockY: Schema.Number.pipe(Schema.int()),
  /** Block Z coordinate */
  blockZ: Schema.Number.pipe(Schema.int()),
})
export type RaycastHit = Schema.Schema.Type<typeof RaycastHitSchema>

/**
 * Default ray distance for block interaction (5 blocks reach)
 */
export const DEFAULT_RAY_DISTANCE = 5.0

/**
 * Raycasting service class for block targeting
 */
export class RaycastingService extends Effect.Service<RaycastingService>()(
  '@minecraft/infrastructure/three/RaycastingService',
  {
    effect: Effect.sync(() => {
      // Cached raycaster and screen-center vector — allocated once at service creation.
      // Prevents per-frame GC pressure from ~60 Raycaster + Vector2 allocations/second.
      const raycaster = new THREE.Raycaster()
      const center = new THREE.Vector2(0, 0)

      return {
        /**
         * Cast a ray from camera center forward
         * @param camera - The camera to cast from
         * @param scene - The scene to cast against
         * @param maxDistance - Maximum distance to cast (default: 5 blocks)
         */
        raycastFromCamera: (
          camera: THREE.Camera,
          scene: THREE.Scene,
          maxDistance = DEFAULT_RAY_DISTANCE
        ): Effect.Effect<Option.Option<RaycastHit>, never> =>
          Effect.sync(() => {
            raycaster.far = maxDistance

            // Cast ray from camera center (reuses cached Vector2)
            raycaster.setFromCamera(center, camera)

            // Get all intersects
            const intersects = raycaster.intersectObjects(scene.children, true)

            // Option.flatMap chains: None-propagates through both guards,
            // then Option.map builds the result only when both hit and face are present.
            return Option.flatMap(
              Arr.get(intersects, 0),
              (hit) => Option.map(
                Option.fromNullable(hit.face),
                (face) => {
                  // Calculate block coordinates from hit point
                  // Offset slightly in the direction of the normal to get the block we hit
                  const blockX = Math.floor(hit.point.x - face.normal.x * 0.01)
                  const blockY = Math.floor(hit.point.y - face.normal.y * 0.01)
                  const blockZ = Math.floor(hit.point.z - face.normal.z * 0.01)
                  return {
                    point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
                    normal: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
                    distance: hit.distance,
                    blockX,
                    blockY,
                    blockZ,
                  }
                }
              )
            )
          }),

        /**
         * Convert world position to block coordinates
         */
        worldToBlock: (
          worldPos: { x: number; y: number; z: number }
        ): Effect.Effect<{ x: number; y: number; z: number }, never> =>
          Effect.succeed({
            x: Math.floor(worldPos.x),
            y: Math.floor(worldPos.y),
            z: Math.floor(worldPos.z),
          }),
      }
    }),
  }
) {}
export const RaycastingServiceLive = RaycastingService.Default
