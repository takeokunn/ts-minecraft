/**
 * @fileoverview Three.js Object3D - Effect-TSラッパー
 * THREE.Object3Dの階層管理と操作の関数型ラッパー
 */

import { Effect } from 'effect'
import * as THREE from 'three'
import { SceneError } from '../errors'

/**
 * Object3Dに子を追加
 */
export const addChild = (parent: THREE.Object3D, child: THREE.Object3D): Effect.Effect<void, SceneError> =>
  Effect.try({
    try: () => parent.add(child),
    catch: (error) =>
      SceneError.make({
        operation: 'addChild',
        cause: error,
      }),
  })

/**
 * Object3Dから子を削除
 */
export const removeChild = (parent: THREE.Object3D, child: THREE.Object3D): Effect.Effect<void, SceneError> =>
  Effect.try({
    try: () => parent.remove(child),
    catch: (error) =>
      SceneError.make({
        operation: 'removeChild',
        cause: error,
      }),
  })

/**
 * Object3Dの全子を取得
 */
export const getChildren = (object: THREE.Object3D): Effect.Effect<readonly THREE.Object3D[], never> =>
  Effect.sync(() => [...object.children])

/**
 * Object3Dの位置を設定
 */
export const setPosition = (object: THREE.Object3D, x: number, y: number, z: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    object.position.set(x, y, z)
  })

/**
 * Object3Dの回転を設定（Euler角）
 */
export const setRotation = (object: THREE.Object3D, x: number, y: number, z: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    object.rotation.set(x, y, z)
  })

/**
 * Object3Dのスケールを設定
 */
export const setScale = (object: THREE.Object3D, x: number, y: number, z: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    object.scale.set(x, y, z)
  })

/**
 * Object3Dの可視性を設定
 */
export const setVisible = (object: THREE.Object3D, visible: boolean): Effect.Effect<void, never> =>
  Effect.sync(() => {
    object.visible = visible
  })

/**
 * Object3Dの名前を設定
 */
export const setName = (object: THREE.Object3D, name: string): Effect.Effect<void, never> =>
  Effect.sync(() => {
    object.name = name
  })

/**
 * Object3Dのワールド座標変換行列を更新
 */
export const updateMatrixWorld = (object: THREE.Object3D, force?: boolean): Effect.Effect<void, never> =>
  Effect.sync(() => {
    object.updateMatrixWorld(force)
  })

/**
 * Object3Dを親から削除
 */
export const removeFromParent = (object: THREE.Object3D): Effect.Effect<void, SceneError> =>
  Effect.try({
    try: () => object.removeFromParent(),
    catch: (error) =>
      SceneError.make({
        operation: 'removeFromParent',
        cause: error,
      }),
  })

/**
 * Object3Dとその子孫を複製
 */
export const cloneObject = (object: THREE.Object3D): Effect.Effect<THREE.Object3D, SceneError> =>
  Effect.try({
    try: () => object.clone(),
    catch: (error) =>
      SceneError.make({
        operation: 'clone',
        cause: error,
      }),
  })
