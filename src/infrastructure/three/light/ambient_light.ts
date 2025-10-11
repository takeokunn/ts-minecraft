/**
 * @fileoverview Three.js AmbientLight - Effect-TSラッパー
 * THREE.AmbientLightの完全関数型ラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { LightError } from '../errors'

/**
 * AmbientLight初期化パラメータ
 */
export const AmbientLightParamsSchema = Schema.Struct({
  color: Schema.optional(Schema.Number.pipe(Schema.int())),
  intensity: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
})

export type AmbientLightParams = Schema.Schema.Type<typeof AmbientLightParamsSchema>

/**
 * AmbientLightを作成
 */
export const createAmbientLight = (params?: AmbientLightParams): Effect.Effect<THREE.AmbientLight, LightError> =>
  Effect.try({
    try: () => new THREE.AmbientLight(params?.color, params?.intensity),
    catch: (error) =>
      LightError.make({
        type: 'ambient',
        cause: error,
      }),
  })

/**
 * ライトの色を設定
 */
export const setColor = (light: THREE.AmbientLight, color: number | string | THREE.Color): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.color.set(color)
  })

/**
 * ライトの強度を設定
 */
export const setIntensity = (light: THREE.AmbientLight, intensity: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.intensity = intensity
  })

/**
 * ライトの可視性を設定
 */
export const setVisible = (light: THREE.AmbientLight, visible: boolean): Effect.Effect<void, never> =>
  Effect.sync(() => {
    light.visible = visible
  })
