import { Effect, Layer } from 'effect'
import * as THREE from 'three'
import { RaycastHit, RaycastingService } from '../../application/raycasting/raycasting-service'

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
export class BlockHighlight extends Effect.Service<BlockHighlight>()(
  '@minecraft/layer/BlockHighlight',
  {
    effect: Effect.gen(function* () {
      const raycastingService = yield* RaycastingService

      // Wireframe cube mesh for highlighting
      let highlightMesh: THREE.LineSegments | null = null
      // Current target block coordinates
      let currentTarget: { x: number; y: number; z: number } | null = null
      // Full raycast hit for current target (includes surface normal for placement)
      let currentHit: RaycastHit | null = null

      return {
        /**
         * Initialize the highlight mesh and add it to the scene
         * @param scene - The Three.js scene to add the highlight to
         */
        initialize: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.sync(() => {
            highlightMesh = createWireframeCube()
            highlightMesh.visible = false
            scene.add(highlightMesh)
          }),

        /**
         * Update highlight position based on camera raycast
         * @param camera - The camera to raycast from
         * @param scene - The scene containing block meshes
         */
        update: (camera: THREE.Camera, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (!highlightMesh) return

            const hit = yield* raycastingService.raycastFromCamera(camera, scene)

            if (hit) {
              // Position highlight at block coordinates (center of the block)
              highlightMesh.position.set(
                hit.blockX + 0.5,
                hit.blockY + 0.5,
                hit.blockZ + 0.5
              )
              highlightMesh.visible = true
              currentTarget = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
              currentHit = hit
            } else {
              highlightMesh.visible = false
              currentTarget = null
              currentHit = null
            }
          }),

        /**
         * Set the visibility of the highlight
         * @param visible - Whether the highlight should be visible
         */
        setVisible: (visible: boolean): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (highlightMesh) {
              highlightMesh.visible = visible
            }
          }),

        /**
         * Get the current target block coordinates
         * @returns The block coordinates or null if no block is targeted
         */
        getTargetBlock: (): Effect.Effect<{ x: number; y: number; z: number } | null, never> =>
          Effect.sync(() => currentTarget),

        /**
         * Get the full raycast hit for the current target, including surface normal
         * Required for computing adjacent block position during placement
         * @returns The full RaycastHit or null if no block is targeted
         */
        getTargetHit: (): Effect.Effect<RaycastHit | null, never> =>
          Effect.sync(() => currentHit),
      }
    }),
  }
) {}
export { BlockHighlight as BlockHighlightLive }
