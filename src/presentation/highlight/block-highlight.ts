import { Effect, Option, Ref, Schema } from 'effect'
import * as THREE from 'three'
import { RaycastHit, RaycastingService } from '@/infrastructure/three/raycasting/raycasting-service'

/**
 * Schema for block target coordinates (integer block positions)
 */
export const BlockTargetSchema = Schema.Struct({
  x: Schema.Int,
  y: Schema.Int,
  z: Schema.Int,
})
export type BlockTarget = Schema.Schema.Type<typeof BlockTargetSchema>

/**
 * Default highlight color (black wireframe)
 */
export const DEFAULT_HIGHLIGHT_COLOR = 0x000000

/**
 * Create a wireframe cube mesh for block highlighting
 * @param color - The color of the wireframe lines
 * @returns A THREE.LineSegments mesh representing the wireframe cube
 */
export const createWireframeCube = (color: number = DEFAULT_HIGHLIGHT_COLOR): THREE.LineSegments => {
  // Create a slightly larger box to avoid z-fighting with the block
  const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01)
  const edges = new THREE.EdgesGeometry(geometry)
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 2,
  })
  return new THREE.LineSegments(edges, material)
}

/**
 * BlockHighlight service for visual feedback on targeted blocks
 *
 * Provides functionality to:
 * - Initialize a wireframe cube for block highlighting
 * - Update highlight position based on raycast results
 * - Control visibility of the highlight
 * - Get current target block coordinates
 */
export class BlockHighlightService extends Effect.Service<BlockHighlightService>()(
  '@minecraft/presentation/BlockHighlight',
  {
    effect: Effect.gen(function* () {
      const raycastingService = yield* RaycastingService

      // Wireframe cube mesh for highlighting
      const highlightMeshRef = yield* Ref.make<Option.Option<THREE.LineSegments>>(Option.none())
      // Current target block coordinates
      const currentTargetRef = yield* Ref.make<Option.Option<BlockTarget>>(Option.none())
      // Full raycast hit for current target (includes surface normal for placement)
      const currentHitRef = yield* Ref.make<Option.Option<RaycastHit>>(Option.none())

      return {
        /**
         * Initialize the highlight mesh and add it to the scene
         * @param scene - The Three.js scene to add the highlight to
         */
        initialize: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const mesh = createWireframeCube()
            mesh.visible = false
            scene.add(mesh)
            yield* Ref.set(highlightMeshRef, Option.some(mesh))
          }),

        /**
         * Update highlight position based on camera raycast
         * @param camera - The camera to raycast from
         * @param scene - The scene containing block meshes
         */
        update: (camera: THREE.Camera, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const highlightMeshOpt = yield* Ref.get(highlightMeshRef)
            if (Option.isNone(highlightMeshOpt)) return
            const highlightMesh = highlightMeshOpt.value

            const hitOption = yield* raycastingService.raycastFromCamera(camera, scene)

            if (Option.isSome(hitOption)) {
              const hit = hitOption.value
              // Position highlight at block coordinates (center of the block)
              highlightMesh.position.set(
                hit.blockX + 0.5,
                hit.blockY + 0.5,
                hit.blockZ + 0.5
              )
              highlightMesh.visible = true
              yield* Ref.set(currentTargetRef, Option.some({ x: hit.blockX, y: hit.blockY, z: hit.blockZ }))
              yield* Ref.set(currentHitRef, Option.some(hit))
            } else {
              highlightMesh.visible = false
              yield* Ref.set(currentTargetRef, Option.none())
              yield* Ref.set(currentHitRef, Option.none())
            }
          }),

        /**
         * Set the visibility of the highlight
         * @param visible - Whether the highlight should be visible
         */
        setVisible: (visible: boolean): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const highlightMeshOpt = yield* Ref.get(highlightMeshRef)
            if (Option.isSome(highlightMeshOpt)) {
              highlightMeshOpt.value.visible = visible
            }
          }),

        /**
         * Get the current target block coordinates
         * @returns The block coordinates or null if no block is targeted
         */
        getTargetBlock: (): Effect.Effect<BlockTarget | null, never> =>
          Ref.get(currentTargetRef).pipe(Effect.map(Option.getOrNull)),

        /**
         * Get the full raycast hit for the current target, including surface normal
         * Required for computing adjacent block position during placement
         * @returns The full RaycastHit or null if no block is targeted
         */
        getTargetHit: (): Effect.Effect<RaycastHit | null, never> =>
          Ref.get(currentHitRef).pipe(Effect.map(Option.getOrNull)),
      }
    }),
  }
) {}
export const BlockHighlightLive = BlockHighlightService.Default
