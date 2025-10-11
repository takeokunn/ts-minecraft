/**
 * @fileoverview Three.js Texture - Effect-TS Wrapper
 * TextureのEffect-TSラッパー実装
 */

import { Effect } from 'effect'
import * as THREE from 'three'
import { TextureError } from '../errors'

/**
 * Textureをデータから生成
 */
export const createTexture = (
  data: HTMLImageElement | HTMLCanvasElement | ImageData
): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.try({
    try: () => new THREE.Texture(data),
    catch: (error) =>
      TextureError.make({
        operation: 'create',
        cause: error,
      }),
  })

/**
 * Texture手動dispose
 */
export const disposeTexture = (texture: THREE.Texture): Effect.Effect<void, never> =>
  Effect.sync(() => texture.dispose())

/**
 * Effect.Scopeによるリソース管理付きTexture生成
 */
export const withTexture = <A, E>(
  data: HTMLImageElement | HTMLCanvasElement | ImageData,
  f: (texture: THREE.Texture) => Effect.Effect<A, E>
): Effect.Effect<A, E | TextureError> =>
  Effect.acquireUseRelease(createTexture(data), f, (texture) => Effect.sync(() => texture.dispose()))

/**
 * Textureの更新通知
 */
export const updateTexture = (texture: THREE.Texture): Effect.Effect<void, never> =>
  Effect.sync(() => {
    texture.needsUpdate = true
  })
