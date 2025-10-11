/**
 * @fileoverview Three.js Scene - Effect-TSラッパー
 * THREE.Sceneの完全関数型ラッパー実装
 */

import { Effect } from 'effect'
import * as THREE from 'three'
import { SceneError } from '../errors'

/**
 * 新しいSceneを作成
 */
export const createScene = (): Effect.Effect<THREE.Scene, never> => Effect.sync(() => new THREE.Scene())

/**
 * Sceneに背景色を設定
 */
export const setBackground = (scene: THREE.Scene, color: THREE.Color | null): Effect.Effect<void, never> =>
  Effect.sync(() => {
    scene.background = color
  })

/**
 * Sceneに環境マップを設定
 */
export const setEnvironment = (scene: THREE.Scene, texture: THREE.Texture | null): Effect.Effect<void, never> =>
  Effect.sync(() => {
    scene.environment = texture
  })

/**
 * Sceneに霧を設定
 */
export const setFog = (scene: THREE.Scene, fog: THREE.Fog | THREE.FogExp2 | null): Effect.Effect<void, never> =>
  Effect.sync(() => {
    scene.fog = fog
  })

/**
 * Object3DをSceneに追加
 */
export const addToScene = (scene: THREE.Scene, object: THREE.Object3D): Effect.Effect<void, SceneError> =>
  Effect.try({
    try: () => scene.add(object),
    catch: (error) =>
      SceneError.make({
        operation: 'add',
        cause: error,
      }),
  })

/**
 * Object3DをSceneから削除
 */
export const removeFromScene = (scene: THREE.Scene, object: THREE.Object3D): Effect.Effect<void, SceneError> =>
  Effect.try({
    try: () => scene.remove(object),
    catch: (error) =>
      SceneError.make({
        operation: 'remove',
        cause: error,
      }),
  })

/**
 * Scene内の全オブジェクトをクリア
 */
export const clearScene = (scene: THREE.Scene): Effect.Effect<void, SceneError> =>
  Effect.try({
    try: () => scene.clear(),
    catch: (error) =>
      SceneError.make({
        operation: 'clear',
        cause: error,
      }),
  })

/**
 * Sceneから名前でオブジェクトを検索
 */
export const getObjectByName = (scene: THREE.Scene, name: string): Effect.Effect<THREE.Object3D | undefined, never> =>
  Effect.sync(() => scene.getObjectByName(name))

/**
 * Sceneの全子オブジェクトを取得
 */
export const getChildren = (scene: THREE.Scene): Effect.Effect<readonly THREE.Object3D[], never> =>
  Effect.sync(() => [...scene.children])
