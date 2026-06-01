import { Array as Arr, Effect, MutableRef, Ref } from 'effect'
import * as THREE from 'three'
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

import { estimateWaterScreenRatio } from './world-renderer-refraction-ratio'


const syncRefractionProjection = (
  refractionCamera: THREE.PerspectiveCamera,
  sourceCamera: THREE.Camera,
): void => {
  const perspectiveCamera = sourceCamera as THREE.PerspectiveCamera
  /* c8 ignore start -- defensive guard for non-perspective cameras; game always uses PerspectiveCamera */
  if (perspectiveCamera.isPerspectiveCamera !== true) {
    return
  }
  /* c8 ignore end */

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
 * 0 disables the screen-ratio gate entirely.
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
