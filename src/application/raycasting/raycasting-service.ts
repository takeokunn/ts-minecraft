import { Effect } from 'effect'
import * as THREE from 'three'

/**
 * Result of a raycast hit
 */
export interface RaycastHit {
  /** World position of hit point */
  readonly point: { x: number; y: number; z: number }
  /** Normal of hit surface */
  readonly normal: { x: number; y: number; z: number }
  /** Distance from ray origin */
  readonly distance: number
  /** Block X coordinate */
  readonly blockX: number
  /** Block Y coordinate */
  readonly blockY: number
  /** Block Z coordinate */
  readonly blockZ: number
}

/**
 * Default ray distance for block interaction (5 blocks reach)
 */
export const DEFAULT_RAY_DISTANCE = 5.0

/**
 * Raycasting service class for block targeting
 */
export class RaycastingService extends Effect.Service<RaycastingService>()(
  '@minecraft/layer/RaycastingService',
  {
    effect: Effect.gen(function* () {
      return {
        /**
         * Create a raycaster with default settings
         */
        createRaycaster: (): Effect.Effect<THREE.Raycaster, never> =>
          Effect.sync(() => {
            const raycaster = new THREE.Raycaster()
            raycaster.far = DEFAULT_RAY_DISTANCE
            return raycaster
          }),

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
        ): Effect.Effect<RaycastHit | null, never> =>
          Effect.gen(function* () {
            const raycaster = new THREE.Raycaster()
            raycaster.far = maxDistance

            // Cast ray from camera center
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

            // Get all intersects
            const intersects = raycaster.intersectObjects(scene.children, true)

            const hit = intersects[0]
            if (!hit) {
              return null
            }

            const point = hit.point
            const face = hit.face

            if (!point || !face) {
              return null
            }

            // Calculate block coordinates from hit point
            // Offset slightly in the direction of the normal to get the block we hit
            const blockX = Math.floor(point.x - face.normal.x * 0.01)
            const blockY = Math.floor(point.y - face.normal.y * 0.01)
            const blockZ = Math.floor(point.z - face.normal.z * 0.01)

            return {
              point: { x: point.x, y: point.y, z: point.z },
              normal: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
              distance: hit.distance,
              blockX,
              blockY,
              blockZ,
            }
          }),

        /**
         * Convert world position to block coordinates
         */
        worldToBlock: (
          worldPos: { x: number; y: number; z: number }
        ): Effect.Effect<{ x: number; y: number; z: number }, never> =>
          Effect.sync(() => ({
            x: Math.floor(worldPos.x),
            y: Math.floor(worldPos.y),
            z: Math.floor(worldPos.z),
          })),
      }
    }),
  }
) {}
export { RaycastingService as RaycastingServiceLive }
