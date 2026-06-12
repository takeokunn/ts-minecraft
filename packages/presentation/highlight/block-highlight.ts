import { Effect, Option, Ref, Schema } from 'effect'
import * as THREE from 'three'
import { RaycastHit, RaycastingService } from '@ts-minecraft/rendering'

export const BlockTargetSchema = Schema.Struct({
  x: Schema.Int,
  y: Schema.Int,
  z: Schema.Int,
})
export type BlockTarget = Schema.Schema.Type<typeof BlockTargetSchema>

export const DEFAULT_HIGHLIGHT_COLOR = 0x000000

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

// ─── CameraPose ──────────────────────────────────────────────────────────────
// Lightweight position+orientation snapshot used to skip redundant raycasts.
// Intentionally narrower than CameraPoseSnapshot (no projection-matrix fields)
// since block-highlight only needs view-direction equality, not frustum equality.

type CameraPose = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly qx: number
  readonly qy: number
  readonly qz: number
  readonly qw: number
}

const INVALID_CAMERA_POSE: CameraPose = { x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN }

const captureCameraPose = (camera: THREE.Camera): CameraPose => ({
  x: camera.position.x,
  y: camera.position.y,
  z: camera.position.z,
  qx: camera.quaternion.x,
  qy: camera.quaternion.y,
  qz: camera.quaternion.z,
  qw: camera.quaternion.w,
})

const posesMatch = (a: CameraPose, b: CameraPose): boolean =>
  a.x === b.x && a.y === b.y && a.z === b.z &&
  a.qx === b.qx && a.qy === b.qy && a.qz === b.qz && a.qw === b.qw

// ─── HitState ────────────────────────────────────────────────────────────────
// target and hit always move together — merged into one Ref to enforce the invariant structurally

type HitState = {
  readonly target: Option.Option<BlockTarget>
  readonly hit: Option.Option<RaycastHit>
}
const EMPTY_HIT_STATE: HitState = { target: Option.none(), hit: Option.none() }

export class BlockHighlightService extends Effect.Service<BlockHighlightService>()(
  '@minecraft/presentation/BlockHighlight',
  {
    effect: Effect.gen(function* () {
      const raycastingService = yield* RaycastingService
      // Wireframe cube mesh for highlighting
      const highlightMeshRef = yield* Ref.make<Option.Option<THREE.LineSegments>>(Option.none())
      // target and hit always change together — one atomic Ref instead of two
      const hitStateRef = yield* Ref.make<HitState>(EMPTY_HIT_STATE)
      const overrideHitStateRef = yield* Ref.make<Option.Option<HitState>>(Option.none())
      // Last camera pose used for raycast; invalidated whenever the scene changes.
      const lastCameraPoseRef = yield* Ref.make<CameraPose>(INVALID_CAMERA_POSE)

      // Handles the QA-override path: positions the mesh at the forced target and
      // records the forced state. Separated from the raycast path so each branch
      // reads linearly without nesting.
      const applyForcedHighlight = (
        mesh: THREE.LineSegments,
        forced: HitState,
        currentPose: CameraPose,
      ): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            /* c8 ignore next */
            const target = Option.getOrNull(forced.target)
            if (target === null) {
              /* c8 ignore next */
              mesh.visible = false
            } else {
              mesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
              mesh.visible = true
            }
          })
          yield* Ref.set(hitStateRef, forced)
          yield* Ref.set(lastCameraPoseRef, currentPose)
        })

      // Handles the normal path: fires a raycast, positions the mesh at the hit
      // block (or hides it when no block is in range), and records the new state.
      const applyRaycastHighlight = (
        mesh: THREE.LineSegments,
        camera: THREE.Camera,
        scene: THREE.Scene,
        currentPose: CameraPose,
      ): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const hit = Option.getOrNull(yield* raycastingService.raycastFromCamera(camera, scene))
          if (hit !== null) {
            yield* Effect.sync(() => {
              // Position highlight at block coordinates (center of the block)
              mesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5)
              mesh.visible = true
            })
            // Atomic write: target and hit always set together
            yield* Ref.set(hitStateRef, {
              target: Option.some({ x: hit.blockX, y: hit.blockY, z: hit.blockZ }),
              hit: Option.some(hit),
            })
          } else {
            yield* Effect.sync(() => { mesh.visible = false })
            yield* Ref.set(hitStateRef, EMPTY_HIT_STATE)
          }
          yield* Ref.set(lastCameraPoseRef, currentPose)
        })

      return {
        initialize: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const mesh = createWireframeCube()
            yield* Effect.sync(() => { mesh.visible = false; scene.add(mesh) })
            yield* Ref.set(highlightMeshRef, Option.some(mesh))
          }),

        update: (camera: THREE.Camera, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const currentPose = captureCameraPose(camera)
            const lastPose = yield* Ref.get(lastCameraPoseRef)
            if (posesMatch(lastPose, currentPose)) return

            const mesh = Option.getOrNull(yield* Ref.get(highlightMeshRef))
            if (mesh === null) return

            const overrideState = Option.getOrNull(yield* Ref.get(overrideHitStateRef))
            if (overrideState !== null) {
              yield* applyForcedHighlight(mesh, overrideState, currentPose)
            } else {
              yield* applyRaycastHighlight(mesh, camera, scene, currentPose)
            }
          }),

        // Invalidated whenever scene changes so next update re-runs the raycast.
        invalidateCache: (): Effect.Effect<void, never> =>
          Ref.set(lastCameraPoseRef, INVALID_CAMERA_POSE),

        setVisible: (visible: boolean): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const opt = yield* Ref.get(highlightMeshRef)
            const m = Option.getOrNull(opt)
            if (m !== null) yield* Effect.sync(() => { m.visible = visible })
          }),

        getTargetBlock: (): Effect.Effect<Option.Option<BlockTarget>, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(hitStateRef)
            return s.target
          }),

        // Full hit required for computing adjacent block position during placement.
        getTargetHit: (): Effect.Effect<Option.Option<RaycastHit>, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(hitStateRef)
            return s.hit
          }),

        setTargetForQA: (target: BlockTarget, hit: RaycastHit): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshForQA = Option.getOrNull(yield* Ref.get(highlightMeshRef))
            if (meshForQA !== null) {
              yield* Effect.sync(() => {
                meshForQA.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
                meshForQA.visible = true
              })
            }
            yield* Ref.set(hitStateRef, {
              target: Option.some(target),
              hit: Option.some(hit),
            })
            yield* Ref.set(overrideHitStateRef, Option.some({
              target: Option.some(target),
              hit: Option.some(hit),
            }))
          }),

        clearTargetForQA: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshForClear = Option.getOrNull(yield* Ref.get(highlightMeshRef))
            if (meshForClear !== null) yield* Effect.sync(() => { meshForClear.visible = false })
            yield* Ref.set(overrideHitStateRef, Option.none())
            yield* Ref.set(hitStateRef, EMPTY_HIT_STATE)
          }),
      }
    }),
  }
) {}
export const BlockHighlightLive = BlockHighlightService.Default
