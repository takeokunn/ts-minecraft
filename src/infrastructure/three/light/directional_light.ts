/**
 * @fileoverview Three.js DirectionalLight - Effect-TSラッパー
 * THREE.DirectionalLightの完全関数型ラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { LightError } from '../errors'

/**
 * DirectionalLight初期化パラメータ
 */
export const DirectionalLightParamsSchema = Schema.Struct({
  color: Schema.optional(Schema.Number.pipe(Schema.int())),
  intensity: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
})

export type DirectionalLightParams = Schema.Schema.Type<typeof DirectionalLightParamsSchema>

/**
 * DirectionalLightを作成
 */
export const createDirectionalLight = (
  params?: DirectionalLightParams
): Effect.Effect<THREE.DirectionalLight, LightError> =>
  Effect.try({
    try: () => new THREE.DirectionalLight(params?.color, params?.intensity),
    catch: (error) => new LightError({ type: 'directional', cause: error }),
  })

/**
 * ライトの色を設定
 */
export const setColor = (
  light: THREE.DirectionalLight,
  color: number | string | THREE.Color
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.color.set(color)
  })

/**
 * ライトの強度を設定
 */
export const setIntensity = (light: THREE.DirectionalLight, intensity: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.intensity = intensity
  })

/**
 * ライトの位置を設定
 */
export const setPosition = (
  light: THREE.DirectionalLight,
  x: number,
  y: number,
  z: number
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.position.set(x, y, z)
  })

/**
 * ライトのターゲット位置を設定
 */
export const setTargetPosition = (
  light: THREE.DirectionalLight,
  x: number,
  y: number,
  z: number
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.target.position.set(x, y, z)
  })

/**
 * ライトの影を有効化
 */
export const enableShadow = (light: THREE.DirectionalLight): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.castShadow = true
  })

/**
 * ライトの影を無効化
 */
export const disableShadow = (light: THREE.DirectionalLight): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.castShadow = false
  })

/**
 * シャドウマップのサイズを設定
 */
export const setShadowMapSize = (
  light: THREE.DirectionalLight,
  width: number,
  height: number
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.shadow.mapSize.width = width
    light.shadow.mapSize.height = height
  })

/**
 * ライトの可視性を設定
 */
export const setVisible = (light: THREE.DirectionalLight, visible: boolean): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.visible = visible
  })
