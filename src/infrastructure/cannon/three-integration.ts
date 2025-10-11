import * as CANNON from 'cannon-es'
import { Effect } from 'effect'
import * as THREE from 'three'
import {
  cannonQuatToThreeQuatUnsafe,
  cannonVec3ToThreeVec3Unsafe,
  threeQuatToCannonQuatUnsafe,
  threeVec3ToCannonVec3Unsafe,
} from './schemas/adapters'

/**
 * Three.js Integration - Cannon.jsとThree.jsの連携ヘルパー
 *
 * Phase 1.4: 物理エンジンとレンダリングの同期
 */

/**
 * Cannon.jsのBodyからThree.jsのMeshへ座標・回転を同期
 *
 * @param body - 物理Body
 * @param mesh - Three.js Mesh
 * @returns Effect型でラップされたvoid
 */
export const syncBodyToMesh = (body: CANNON.Body, mesh: THREE.Mesh): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // 位置を同期（ゼロコスト型変換）
    mesh.position.copy(cannonVec3ToThreeVec3Unsafe(body.position))

    // 回転（Quaternion）を同期（ゼロコスト型変換）
    mesh.quaternion.copy(cannonQuatToThreeQuatUnsafe(body.quaternion))
  })

/**
 * Three.jsのMeshからCannon.jsのBodyへ座標・回転を同期
 *
 * @param mesh - Three.js Mesh
 * @param body - 物理Body
 * @returns Effect型でラップされたvoid
 */
export const syncMeshToBody = (mesh: THREE.Mesh, body: CANNON.Body): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // 位置を同期（ゼロコスト型変換）
    body.position.copy(threeVec3ToCannonVec3Unsafe(mesh.position))

    // 回転（Quaternion）を同期（ゼロコスト型変換）
    body.quaternion.copy(threeQuatToCannonQuatUnsafe(mesh.quaternion))
  })

/**
 * 複数のBody-Meshペアを一括同期
 *
 * @param pairs - Body-Meshペアの配列
 * @returns Effect型でラップされたvoid
 */
export const syncBodies = (pairs: Array<{ body: CANNON.Body; mesh: THREE.Mesh }>): Effect.Effect<void, never> =>
  pipe(
    pairs,
    Effect.forEach((pair) => syncBodyToMesh(pair.body, pair.mesh), { concurrency: 'unbounded', discard: true })
  )

/**
 * Three.js Vector3をCannon.js Vec3に変換
 *
 * @param vec - Three.js Vector3
 * @returns CANNON.Vec3
 */
export const threeToCannonVec3 = (vec: THREE.Vector3): CANNON.Vec3 => new CANNON.Vec3(vec.x, vec.y, vec.z)

/**
 * Cannon.js Vec3をThree.js Vector3に変換
 *
 * @param vec - CANNON.Vec3
 * @returns THREE.Vector3
 */
export const cannonToThreeVec3 = (vec: CANNON.Vec3): THREE.Vector3 => new THREE.Vector3(vec.x, vec.y, vec.z)

/**
 * Three.js QuaternionをCannon.js Quaternionに変換
 *
 * @param quat - Three.js Quaternion
 * @returns CANNON.Quaternion
 */
export const threeToCannonQuat = (quat: THREE.Quaternion): CANNON.Quaternion =>
  new CANNON.Quaternion(quat.x, quat.y, quat.z, quat.w)

/**
 * Cannon.js QuaternionをThree.js Quaternionに変換
 *
 * @param quat - CANNON.Quaternion
 * @returns THREE.Quaternion
 */
export const cannonToThreeQuat = (quat: CANNON.Quaternion): THREE.Quaternion =>
  new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w)
