import { Effect, Option, Schema } from 'effect'
import * as THREE from 'three'
import { Vector3Schema } from '@ts-minecraft/core'

export const RaycastHitSchema = Schema.Struct({
  point: Vector3Schema,
  normal: Vector3Schema,
  distance: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  blockX: Schema.Number.pipe(Schema.int()),
  blockY: Schema.Number.pipe(Schema.int()),
  blockZ: Schema.Number.pipe(Schema.int()),
})
export type RaycastHit = Schema.Schema.Type<typeof RaycastHitSchema>

export const DEFAULT_RAY_DISTANCE = 5.0

export class RaycastingService extends Effect.Service<RaycastingService>()(
  '@minecraft/infrastructure/three/RaycastingService',
  {
    effect: Effect.sync(() => {
      // Cached raycaster and screen-center vector — allocated once at service creation.
      // Prevents per-frame GC pressure from ~60 Raycaster + Vector2 allocations/second.
      const raycaster = new THREE.Raycaster()
      const center = new THREE.Vector2(0, 0)
      const scratchNormal = new THREE.Vector3()

      return {
        raycastFromCamera: (
          camera: THREE.Camera,
          scene: THREE.Scene,
          maxDistance = DEFAULT_RAY_DISTANCE
        ): Effect.Effect<Option.Option<RaycastHit>, never> =>
          Effect.sync(() => {
            raycaster.far = maxDistance

            // Cast ray from camera center (reuses cached Vector2)
            raycaster.setFromCamera(center, camera)

            // The scene graph is flat for world geometry (direct child meshes only),
            // so we can skip recursive traversal and save per-frame tree walking.
            const intersects = raycaster.intersectObjects(scene.children, false)

            // Take the nearest intersection that carries face data (a solid
            // triangle mesh). Face-less hits — LineSegments (block highlight),
            // Points/Sprites (particles) — are overlay objects, not world
            // geometry; treating intersects[0] as THE hit let them mask the
            // terrain behind and clear the block target.
            const hit = intersects.find((intersection) => intersection.face != null) ?? null
            if (hit === null) return Option.none()
            const face = hit.face ?? null
            if (face === null) return Option.none()
            // face.normal is the AUTHORED object-space normal: three.js does not
            // flip it for back-face hits, and chunk materials are DoubleSide, so
            // a quad wound the "wrong" way reports a normal pointing ALONG the
            // ray. Transform to world space and force it against the ray — the
            // entry face of a solid always faces the viewer. Without this, the
            // 0.01 nudge lands in the AIR cell in front of the block: mining
            // reads AIR (progress never starts) and placement targets the cell
            // behind the face.
            scratchNormal.copy(face.normal).transformDirection(hit.object.matrixWorld)
            if (scratchNormal.dot(raycaster.ray.direction) > 0) {
              scratchNormal.multiplyScalar(-1)
            }
            // Offset slightly against the normal to get the block we hit, not the block in front of it.
            const blockX = Math.floor(hit.point.x - scratchNormal.x * 0.01)
            const blockY = Math.floor(hit.point.y - scratchNormal.y * 0.01)
            const blockZ = Math.floor(hit.point.z - scratchNormal.z * 0.01)
            return Option.some({
              point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
              normal: { x: scratchNormal.x, y: scratchNormal.y, z: scratchNormal.z },
              distance: hit.distance,
              blockX,
              blockY,
              blockZ,
            })
          }),

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
