/**
 * @fileoverview Three.js TextureLoader - Effect-TS Wrapper
 * TextureLoaderのEffect-TSラッパー実装（非同期読み込み）
 */

import { Duration, Effect } from 'effect'
import * as THREE from 'three'
import { TextureError } from '../errors'

/**
 * TextureLoader singleton instance
 */
const textureLoader = new THREE.TextureLoader()

/**
 * テクスチャ非同期読み込み
 * Effect.tryPromiseで非同期処理をEffect型にラップ
 * 10秒のタイムアウト付き（ネットワーク遅延考慮）
 */
export const loadTexture = (path: string): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.async<THREE.Texture, TextureError>((resume) => {
    textureLoader.load(
      path,
      (texture) => resume(Effect.succeed(texture)),
      undefined,
      (error) =>
        resume(
          Effect.fail(
            TextureError.make({
              operation: 'load',
              path,
              cause: error,
            })
          ).pipe(Effect.annotateLogs('texture.operation', 'load'), Effect.annotateLogs('texture.path', path))
        )
    )
  }).pipe(
    Effect.timeout(Duration.seconds(10)),
    Effect.catchTag('TimeoutException', () =>
      Effect.fail(
        TextureError.make({
          operation: 'load',
          path,
          cause: new Error(`Texture load timeout after 10 seconds: ${path}`),
        })
      )
    )
  )

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
