/**
 * @fileoverview Three.js PointLight - Effect-TSラッパー
 * THREE.PointLightの完全関数型ラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { LightError } from '../errors'

/**
 * PointLight初期化パラメータ
 */
export const PointLightParamsSchema = Schema.Struct({
  color: Schema.optional(Schema.Number.pipe(Schema.int())),
  intensity: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  distance: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  decay: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
})

export type PointLightParams = Schema.Schema.Type<typeof PointLightParamsSchema>

/**
 * PointLightを作成
 */
export const createPointLight = (params?: PointLightParams): Effect.Effect<THREE.PointLight, LightError> =>
  Effect.try({
    try: () => new THREE.PointLight(params?.color, params?.intensity, params?.distance, params?.decay),
    catch: (error) =>
      LightError.make({
        type: 'point',
        cause: error,
      }),
  })

/**
 * ライトの色を設定
 */
export const setColor = (light: THREE.PointLight, color: number | string | THREE.Color): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.color.set(color)
  })

/**
 * ライトの強度を設定
 */
export const setIntensity = (light: THREE.PointLight, intensity: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.intensity = intensity
  })

/**
 * ライトの位置を設定
 */
export const setPosition = (light: THREE.PointLight, x: number, y: number, z: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.position.set(x, y, z)
  })

/**
 * ライトの距離を設定（0で無限）
 */
export const setDistance = (light: THREE.PointLight, distance: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.distance = distance
  })

/**
 * ライトの減衰率を設定
 */
export const setDecay = (light: THREE.PointLight, decay: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.decay = decay
  })

/**
 * ライトの影を有効化
 */
export const enableShadow = (light: THREE.PointLight): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.castShadow = true
  })

/**
 * ライトの影を無効化
 */
export const disableShadow = (light: THREE.PointLight): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.castShadow = false
  })

/**
 * シャドウマップのサイズを設定
 */
export const setShadowMapSize = (light: THREE.PointLight, width: number, height: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.shadow.mapSize.width = width
    light.shadow.mapSize.height = height
  })

/**
 * ライトの可視性を設定
 */
export const setVisible = (light: THREE.PointLight, visible: boolean): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.visible = visible
  })
