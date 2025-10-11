/**
 * @fileoverview Three.js TextureLoader - Effect-TS Wrapper
 * TextureLoaderのEffect-TSラッパー実装（非同期読み込み）
 */

import { Effect } from 'effect'
import * as THREE from 'three'
import { TextureError } from '../errors'

/**
 * TextureLoader singleton instance
 */
const textureLoader = new THREE.TextureLoader()

/**
 * テクスチャ非同期読み込み
 * Effect.tryPromiseで非同期処理をEffect型にラップ
 */
export const loadTexture = (path: string): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<THREE.Texture>((resolve, reject) => {
        textureLoader.load(
          path,
          (texture) => resolve(texture),
          undefined, // onProgress
          (error) => reject(error)
        )
      }),
    catch: (error) => new TextureError({ operation: 'load', path, cause: error }),
  })

/**
 * Effect.Scopeによるリソース管理付きテクスチャ読み込み
 */
export const withLoadedTexture = <A, E>(
  path: string,
  f: (texture: THREE.Texture) => Effect.Effect<A, E>
): Effect.Effect<A, E | TextureError> =>
  Effect.acquireUseRelease(loadTexture(path), f, (texture) => Effect.sync(() => texture.dispose()))

/**
 * 複数テクスチャの並列読み込み
 */
export const loadTextureAll = (paths: readonly string[]): Effect.Effect<readonly THREE.Texture[], TextureError> =>
  Effect.all(paths.map(loadTexture), { concurrency: 4 })
