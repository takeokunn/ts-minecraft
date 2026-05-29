import { Array as Arr, Effect, MutableRef, Ref } from 'effect'
import * as THREE from 'three'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { type WaterMaterial } from '../post-processing/water-material'

export type RefractionContext = {
  readonly waterMeshesRef: Ref.Ref<ReadonlyArray<THREE.Mesh>>
  readonly sceneVersionRef: Ref.Ref<number>
  readonly _savedWaterVisibility: MutableRef.MutableRef<Map<THREE.Mesh, boolean>>
  readonly _waterMeshCache: MutableRef.MutableRef<ReadonlyArray<THREE.Mesh>>
  readonly _lastRefractionState: MutableRef.MutableRef<{
    version: number
    x: number
    y: number
    z: number
    qx: number
    qy: number
    qz: number
    qw: number
    p0: number
    p5: number
    p10: number
    p14: number
  }>
  readonly refractionCamera: THREE.PerspectiveCamera
  readonly refractionRT: THREE.WebGLRenderTarget
  readonly waterMaterial: WaterMaterial
}

// FR-4.4: pre-allocated scratch for AABB projection — reused across frames to avoid GC pressure
// Sized for the 8 corners of an AABB; vpMatrix is the combined view-projection matrix.
const _vpMatrix = new THREE.Matrix4()
const _projCorner = new THREE.Vector4()

/**
 * FR-4.4: estimate the fraction of screen pixels covered by water meshes via
 * conservative AABB projection. Each mesh's chunk AABB (derived from the
 * `chunkCoord` + `chunkMaxY` userData populated by the meshing pipeline) is
 * projected to NDC; the bounding rect of the 8 projected corners gives an
 * upper bound on the mesh's screen footprint.
 *
 * Math:
 *   - viewport NDC area = 4 (width 2 * height 2)
 *   - clamped NDC bounding rect area / 4 = per-mesh ratio
 *   - sum without union dedupe → upper bound (safe for skip decisions)
 *
 * Returns 1.0 (no skip) whenever any corner is behind the near plane, since
 * partial-clip projection produces invalid NDC values; treating those frames
 * as "fully visible" prevents false-positive skips when water is right under
 * the camera.
 */
const estimateWaterScreenRatio = (
  waterMeshes: ReadonlyArray<THREE.Mesh>,
  camera: THREE.Camera,
): number => {
  // Combined view-projection: NDC = vpMatrix * worldPos / w
  _vpMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)

  let totalRatio = 0
  for (const mesh of waterMeshes) {
    if (!mesh.visible) continue
    const coord = (mesh.userData as { chunkCoord?: { x: number; z: number } }).chunkCoord
    /* c8 ignore next */
    if (coord == null) continue
    const chunkMaxY = (mesh.userData as { chunkMaxY?: number }).chunkMaxY
    const maxYBound = chunkMaxY === undefined
      ? CHUNK_HEIGHT
      : chunkMaxY < 0 ? 0 : chunkMaxY + 1

    const x0 = coord.x * CHUNK_SIZE
    const x1 = x0 + CHUNK_SIZE
    const z0 = coord.z * CHUNK_SIZE
    const z1 = z0 + CHUNK_SIZE
    const y0 = 0
    const y1 = maxYBound

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let behindCamera = false

    // 8 AABB corners: (x0|x1) × (y0|y1) × (z0|z1)
    for (let i = 0; i < 8; i += 1) {
      const cx = (i & 1) === 0 ? x0 : x1
      const cy = (i & 2) === 0 ? y0 : y1
      const cz = (i & 4) === 0 ? z0 : z1
      _projCorner.set(cx, cy, cz, 1)
      _projCorner.applyMatrix4(_vpMatrix)
      // applyMatrix4 on Vector4 returns clip-space (x, y, z, w); divide by w for NDC.
      // w <= 0 means the corner is at/behind the near plane → bail out conservatively.
      if (_projCorner.w <= 0) {
        behindCamera = true
        break
      }
      const invW = 1 / _projCorner.w
      const nx = _projCorner.x * invW
      const ny = _projCorner.y * invW
      if (nx < minX) minX = nx
      if (nx > maxX) maxX = nx
      if (ny < minY) minY = ny
      if (ny > maxY) maxY = ny
    }

    if (behindCamera) {
      // Conservative: treat as fully on-screen → never skip when any water mesh straddles near plane.
      return 1
    }

    // Clamp to viewport [-1, 1]^2; rect can be fully off-screen (negative width/height) → 0.
    const cMinX = minX < -1 ? -1 : minX
    const cMaxX = maxX > 1 ? 1 : maxX
    const cMinY = minY < -1 ? -1 : minY
    const cMaxY = maxY > 1 ? 1 : maxY
    const w = cMaxX - cMinX
    const h = cMaxY - cMinY
    if (w <= 0 || h <= 0) continue
    // Total NDC area is 4 (2 × 2); ratio = clipped rect area / 4.
    totalRatio += (w * h) * 0.25
    if (totalRatio >= 1) return 1
  }
  return totalRatio
}

const syncRefractionProjection = (
  refractionCamera: THREE.PerspectiveCamera,
  sourceCamera: THREE.Camera,
): void => {
  const perspectiveCamera = sourceCamera as THREE.PerspectiveCamera
  if (perspectiveCamera.isPerspectiveCamera !== true) {
    return
  }

  const changed =
    refractionCamera.fov !== perspectiveCamera.fov ||
    refractionCamera.aspect !== perspectiveCamera.aspect ||
    refractionCamera.near !== perspectiveCamera.near ||
    refractionCamera.far !== perspectiveCamera.far ||
    refractionCamera.zoom !== perspectiveCamera.zoom

  if (!changed) {
    return
  }

  refractionCamera.fov = perspectiveCamera.fov
  refractionCamera.aspect = perspectiveCamera.aspect
  refractionCamera.near = perspectiveCamera.near
  refractionCamera.far = perspectiveCamera.far
  refractionCamera.zoom = perspectiveCamera.zoom
  refractionCamera.updateProjectionMatrix()
}

/**
 * Renders scene without water into refractionRT. Must be called BEFORE the
 * main render each frame.
 *
 * FR-4.4: when `minScreenRatio > 0`, the pass is also skipped if the
 * conservative AABB-based screen-ratio estimate falls below the threshold.
 * Caller passes the preset-resolved value (low/medium=0.05, high/ultra=0.005);
 * 0 disables the screen-ratio gate entirely (legacy behavior).
 */
export const doRefractionPrePass = (
  ctx: RefractionContext,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  minScreenRatio: number = 0,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const { waterMeshesRef, sceneVersionRef, _savedWaterVisibility, _lastRefractionState, refractionCamera, refractionRT } = ctx
    const waterMeshes = yield* Ref.get(waterMeshesRef)
    if (waterMeshes.length === 0) return
    // Skip refraction render when no water meshes are visible (all frustum-culled)
    /* c8 ignore next */
    if (!Arr.some(waterMeshes, (m) => m.visible)) return

    // FR-4.4: skip when on-screen water footprint is below the configured threshold.
    // Reuses the same matrixWorldInverse as the main camera; we compute it once here
    // because the pre-pass runs BEFORE renderer.render() updates it for the main pass.
    if (minScreenRatio > 0) {
      yield* Effect.sync(() => camera.updateMatrixWorld())
      const screenRatio = estimateWaterScreenRatio(waterMeshes, camera)
      if (screenRatio < minScreenRatio) return
    }

    const currentSceneVersion = yield* Ref.get(sceneVersionRef)
    const projection = camera.projectionMatrix.elements
    const currentPose = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      qx: camera.quaternion.x,
      qy: camera.quaternion.y,
      qz: camera.quaternion.z,
      qw: camera.quaternion.w,
      p0: projection[0] ?? Number.NaN,
      p5: projection[5] ?? Number.NaN,
      p10: projection[10] ?? Number.NaN,
      p14: projection[14] ?? Number.NaN,
    }
    const lastRefractionState = MutableRef.get(_lastRefractionState)
    if (
      lastRefractionState.version === currentSceneVersion &&
      lastRefractionState.x === currentPose.x &&
      lastRefractionState.y === currentPose.y &&
      lastRefractionState.z === currentPose.z &&
      lastRefractionState.qx === currentPose.qx &&
      lastRefractionState.qy === currentPose.qy &&
      lastRefractionState.qz === currentPose.qz &&
      lastRefractionState.qw === currentPose.qw &&
      lastRefractionState.p0 === currentPose.p0 &&
      lastRefractionState.p5 === currentPose.p5 &&
      lastRefractionState.p10 === currentPose.p10 &&
      lastRefractionState.p14 === currentPose.p14
    ) {
      return
    }

    const savedWaterVisibility = MutableRef.get(_savedWaterVisibility)
    yield* Effect.sync(() => {
      savedWaterVisibility.clear()
      Arr.forEach(waterMeshes, (mesh) => {
        savedWaterVisibility.set(mesh, mesh.visible)
        mesh.visible = false
      })

      // Sync refraction camera with the main camera's pose and projection.
      syncRefractionProjection(refractionCamera, camera)
      refractionCamera.position.copy(camera.position)
      refractionCamera.quaternion.copy(camera.quaternion)
      refractionCamera.updateMatrixWorld()
    })

    const savedAutoUpdate = renderer.shadowMap.autoUpdate
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = false
    renderer.setRenderTarget(refractionRT)

    yield* Effect.ensuring(
      Effect.sync(() => {
        renderer.render(scene, refractionCamera)
      }),
      Effect.sync(() => {
        renderer.setRenderTarget(null)
        renderer.shadowMap.autoUpdate = savedAutoUpdate
        // Restore saved visibility state (preserves frustum culling result)
        for (const [mesh, wasVisible] of savedWaterVisibility) {
          mesh.visible = wasVisible
        }
      })
    )

    MutableRef.set(_lastRefractionState, { version: currentSceneVersion, ...currentPose })
  })

/** Updates per-frame water shader uniforms. */
export const updateWaterUniforms = (
  waterMaterial: WaterMaterial,
  time: number,
  cameraPosition: THREE.Vector3,
  sunIntensity: number,
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    const uniforms = waterMaterial.uniforms
    uniforms.uTime.value = time
    uniforms.uCameraPosition.value.copy(cameraPosition)
    uniforms.uSunIntensity.value = sunIntensity < 0 ? 0 : sunIntensity > 1 ? 1 : sunIntensity
  })

/** Marks the refraction texture as valid or invalid for the water shader. */
export const setRefractionValid = (
  waterMaterial: WaterMaterial,
  valid: boolean,
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    waterMaterial.uniforms.uRefractionValid.value = valid
  })

/** Called only on canvas resize, not per-frame. */
export const updateWaterResolution = (
  waterMaterial: WaterMaterial,
  width: number,
  height: number,
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    waterMaterial.uniforms.uResolution.value.set(width, height)
  })

/** Resizes the refraction render target. */
export const resizeRefractionRT = (
  refractionRT: THREE.WebGLRenderTarget,
  width: number,
  height: number,
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    refractionRT.setSize(width, height)
  })

/** Calls updateProjectionMatrix once per resize, not per frame. */
export const resizeRefractionCamera = (
  refractionCamera: THREE.PerspectiveCamera,
  aspect: number,
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    refractionCamera.aspect = aspect
    refractionCamera.updateProjectionMatrix()
  })

/**
 * Reference-stable: same array reference returned when the mesh set is
 * unchanged, so callers can short-circuit with ===.
 */
export const getWaterMeshes = (
  waterMeshesRef: Ref.Ref<ReadonlyArray<THREE.Mesh>>,
  _waterMeshCache: MutableRef.MutableRef<ReadonlyArray<THREE.Mesh>>,
): Effect.Effect<ReadonlyArray<THREE.Mesh>, never> =>
  Ref.get(waterMeshesRef).pipe(
    Effect.map((current) => {
      const cached = MutableRef.get(_waterMeshCache)
      if (
        current.length === cached.length &&
        Arr.every(current, (mesh, i) => mesh === cached[i])
      ) {
        return cached
      }
      MutableRef.set(_waterMeshCache, current)
      return current
    })
  )
