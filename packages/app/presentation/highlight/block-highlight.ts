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

// target and hit always move together — merged into one Ref to enforce the invariant structurally
type HitState = {
  readonly target: Option.Option<BlockTarget>
  readonly hit: Option.Option<RaycastHit>
}
const EMPTY_HIT_STATE: HitState = { target: Option.none(), hit: Option.none() }

export class BlockHighlightService extends Effect.Service<BlockHighlightService>()(
  '@minecraft/presentation/BlockHighlight',
  {
    effect: Effect.all([
      RaycastingService,
      // Wireframe cube mesh for highlighting
      Ref.make<Option.Option<THREE.LineSegments>>(Option.none()),
      // target and hit always change together — one atomic Ref instead of two
      Ref.make<HitState>(EMPTY_HIT_STATE),
      Ref.make<Option.Option<HitState>>(Option.none()),
      // Last camera pose used for raycast; invalidated whenever the scene changes.
      Ref.make({ x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN }),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([raycastingService, highlightMeshRef, hitStateRef, overrideHitStateRef, lastCameraPoseRef]) => ({
        initialize: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const mesh = createWireframeCube()
            yield* Effect.sync(() => { mesh.visible = false; scene.add(mesh) })
            yield* Ref.set(highlightMeshRef, Option.some(mesh))
          }),

        update: (camera: THREE.Camera, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const currentPose = {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z,
              qx: camera.quaternion.x,
              qy: camera.quaternion.y,
              qz: camera.quaternion.z,
              qw: camera.quaternion.w,
            }

            const lastPose = yield* Ref.get(lastCameraPoseRef)
            if (
              lastPose.x === currentPose.x &&
              lastPose.y === currentPose.y &&
              lastPose.z === currentPose.z &&
              lastPose.qx === currentPose.qx &&
              lastPose.qy === currentPose.qy &&
              lastPose.qz === currentPose.qz &&
              lastPose.qw === currentPose.qw
            ) {
              return
            }

            yield* Option.match(yield* Ref.get(highlightMeshRef), {
              onNone: () => Effect.void,
              onSome: (highlightMesh) => Effect.gen(function* () {
                const overrideState = yield* Ref.get(overrideHitStateRef)
                yield* Option.match(overrideState, {
                  onSome: (forced) => Effect.gen(function* () {
                    yield* Option.match(forced.target, {
                      /* c8 ignore next */
                      onNone: () => Effect.sync(() => { highlightMesh.visible = false }),
                      onSome: (target) =>
                        Effect.sync(() => {
                          highlightMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
                          highlightMesh.visible = true
                        }),
                    })
                    yield* Ref.set(hitStateRef, forced)
                    yield* Ref.set(lastCameraPoseRef, currentPose)
                  }),
                  onNone: () => Effect.gen(function* () {
                    const hitOption = yield* raycastingService.raycastFromCamera(camera, scene)
                    yield* Option.match(hitOption, {
                      onSome: (hit) => Effect.gen(function* () {
                        // Position highlight at block coordinates (center of the block)
                        yield* Effect.sync(() => {
                          highlightMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5)
                          highlightMesh.visible = true
                        })
                        // Atomic write: target and hit always set together
                        yield* Ref.set(hitStateRef, {
                          target: Option.some({ x: hit.blockX, y: hit.blockY, z: hit.blockZ }),
                          hit: Option.some(hit),
                        })
                      }),
                      onNone: () => Effect.gen(function* () {
                        yield* Effect.sync(() => { highlightMesh.visible = false })
                        yield* Ref.set(hitStateRef, EMPTY_HIT_STATE)
                      }),
                    })
                    yield* Ref.set(lastCameraPoseRef, currentPose)
                  }),
                })
              }),
            })
          }),

        // Invalidated whenever scene changes so next update re-runs the raycast.
        invalidateCache: (): Effect.Effect<void, never> =>
          Ref.set(lastCameraPoseRef, { x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN }),

        setVisible: (visible: boolean): Effect.Effect<void, never> =>
          Ref.get(highlightMeshRef).pipe(
            Effect.flatMap((opt) => Effect.sync(() => { Option.map(opt, (m) => { m.visible = visible }) }))
          ),

        getTargetBlock: (): Effect.Effect<Option.Option<BlockTarget>, never> =>
          Ref.get(hitStateRef).pipe(Effect.map((s) => s.target)),

        // Full hit required for computing adjacent block position during placement.
        getTargetHit: (): Effect.Effect<Option.Option<RaycastHit>, never> =>
          Ref.get(hitStateRef).pipe(Effect.map((s) => s.hit)),

        setTargetForQA: (target: BlockTarget, hit: RaycastHit): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Option.match(yield* Ref.get(highlightMeshRef), {
              onNone: () => Effect.void,
              onSome: (highlightMesh) =>
                Effect.sync(() => {
                  highlightMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
                  highlightMesh.visible = true
                }),
            })
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
            yield* Option.match(yield* Ref.get(highlightMeshRef), {
              onNone: () => Effect.void,
              onSome: (highlightMesh) => Effect.sync(() => { highlightMesh.visible = false }),
            })
            yield* Ref.set(overrideHitStateRef, Option.none())
            yield* Ref.set(hitStateRef, EMPTY_HIT_STATE)
          }),
      })))
  }
) {}
export const BlockHighlightLive = BlockHighlightService.Default
