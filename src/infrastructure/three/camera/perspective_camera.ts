/**
 * @fileoverview Three.js PerspectiveCamera - Effect-TSラッパー
 * THREE.PerspectiveCameraの完全関数型ラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { CameraError } from '../errors'

/**
 * PerspectiveCamera初期化パラメータ
 */
export const PerspectiveCameraParamsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(180)),
  aspect: Schema.Number.pipe(Schema.positive()),
  near: Schema.Number.pipe(Schema.positive()),
  far: Schema.Number.pipe(Schema.positive()),
})

export type PerspectiveCameraParams = Schema.Schema.Type<typeof PerspectiveCameraParamsSchema>

/**
 * PerspectiveCameraを作成
 */
export const createPerspectiveCamera = (
  params: PerspectiveCameraParams
): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  Effect.try({
    try: () => new THREE.PerspectiveCamera(params.fov, params.aspect, params.near, params.far),
    catch: (error) => new CameraError({ type: 'perspective', cause: error }),
  })

/**
 * カメラの投影行列を更新
 */
export const updateProjectionMatrix = (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.updateProjectionMatrix()
  })

/**
 * カメラの視野角を設定
 */
export const setFov = (camera: THREE.PerspectiveCamera, fov: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.fov = fov
  })

/**
 * カメラのアスペクト比を設定
 */
export const setAspect = (camera: THREE.PerspectiveCamera, aspect: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.aspect = aspect
  })

/**
 * カメラの近クリップ面を設定
 */
export const setNear = (camera: THREE.PerspectiveCamera, near: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.near = near
  })

/**
 * カメラの遠クリップ面を設定
 */
export const setFar = (camera: THREE.PerspectiveCamera, far: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.far = far
  })

/**
 * カメラをターゲットに向ける
 */
export const lookAt = (camera: THREE.PerspectiveCamera, x: number, y: number, z: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.lookAt(x, y, z)
  })

/**
 * カメラをVector3ターゲットに向ける
 */
export const lookAtVector = (camera: THREE.PerspectiveCamera, target: THREE.Vector3): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.lookAt(target)
  })
