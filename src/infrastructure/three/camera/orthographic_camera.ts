/**
 * @fileoverview Three.js OrthographicCamera - Effect-TSラッパー
 * THREE.OrthographicCameraの完全関数型ラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { CameraError } from '../errors'

/**
 * OrthographicCamera初期化パラメータ
 */
export const OrthographicCameraParamsSchema = Schema.Struct({
  left: Schema.Number,
  right: Schema.Number,
  top: Schema.Number,
  bottom: Schema.Number,
  near: Schema.optional(Schema.Number.pipe(Schema.positive())),
  far: Schema.optional(Schema.Number.pipe(Schema.positive())),
})

export type OrthographicCameraParams = Schema.Schema.Type<typeof OrthographicCameraParamsSchema>

/**
 * OrthographicCameraを作成
 */
export const createOrthographicCamera = (
  params: OrthographicCameraParams
): Effect.Effect<THREE.OrthographicCamera, CameraError> =>
  Effect.try({
    try: () =>
      new THREE.OrthographicCamera(
        params.left,
        params.right,
        params.top,
        params.bottom,
        params.near ?? 0.1,
        params.far ?? 2000
      ),
    catch: (error) =>
      CameraError.make({
        type: 'orthographic',
        cause: error,
      }),
  })

/**
 * カメラの投影行列を更新
 */
export const updateProjectionMatrix = (camera: THREE.OrthographicCamera): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.updateProjectionMatrix()
  })

/**
 * カメラの左境界を設定
 */
export const setLeft = (camera: THREE.OrthographicCamera, left: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.left = left
  })

/**
 * カメラの右境界を設定
 */
export const setRight = (camera: THREE.OrthographicCamera, right: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.right = right
  })

/**
 * カメラの上境界を設定
 */
export const setTop = (camera: THREE.OrthographicCamera, top: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.top = top
  })

/**
 * カメラの下境界を設定
 */
export const setBottom = (camera: THREE.OrthographicCamera, bottom: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.bottom = bottom
  })

/**
 * カメラの近クリップ面を設定
 */
export const setNear = (camera: THREE.OrthographicCamera, near: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.near = near
  })

/**
 * カメラの遠クリップ面を設定
 */
export const setFar = (camera: THREE.OrthographicCamera, far: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.far = far
  })

/**
 * カメラをターゲットに向ける
 */
export const lookAt = (camera: THREE.OrthographicCamera, x: number, y: number, z: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.lookAt(x, y, z)
  })

/**
 * カメラをVector3ターゲットに向ける
 */
export const lookAtVector = (camera: THREE.OrthographicCamera, target: THREE.Vector3): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.lookAt(target)
  })

/**
 * カメラのズームを設定
 */
export const setZoom = (camera: THREE.OrthographicCamera, zoom: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.zoom = zoom
  })
