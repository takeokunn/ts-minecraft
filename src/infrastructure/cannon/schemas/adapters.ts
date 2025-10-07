/**
 * @fileoverview CANNON.js Schema Adapters
 *
 * CANNON.jsとTHREE.jsの型変換用アダプター。
 * Vec3/Quaternion等の構造的に同一だが型が異なるオブジェクトの変換を提供。
 */

import { unsafeCoerce } from 'effect/Function'
import * as CANNON from 'cannon-es'
import * as THREE from 'three'

/**
 * CANNON.Vec3 → THREE.Vector3 型変換（ゼロコスト）
 *
 * CANNON.Vec3とTHREE.Vector3は構造的に同一（x, y, zプロパティ）。
 * メモリレイアウトも同じため、安全に型変換可能。
 *
 * 注意: 新しいオブジェクトを作成せず、型のみを変換する。
 * データのコピーが必要な場合は、threeToCannonVec3等の変換関数を使用。
 *
 * パフォーマンス: 実行時コストなし
 */
export const cannonVec3ToThreeVec3Unsafe = (vec: CANNON.Vec3): THREE.Vector3 => unsafeCoerce(vec)

/**
 * THREE.Vector3 → CANNON.Vec3 型変換（ゼロコスト）
 *
 * パフォーマンス: 実行時コストなし
 */
export const threeVec3ToCannonVec3Unsafe = (vec: THREE.Vector3): CANNON.Vec3 => unsafeCoerce(vec)

/**
 * CANNON.Quaternion → THREE.Quaternion 型変換（ゼロコスト）
 *
 * CANNON.QuaternionとTHREE.Quaternionは構造的に同一（x, y, z, wプロパティ）。
 *
 * パフォーマンス: 実行時コストなし
 */
export const cannonQuatToThreeQuatUnsafe = (quat: CANNON.Quaternion): THREE.Quaternion => unsafeCoerce(quat)

/**
 * THREE.Quaternion → CANNON.Quaternion 型変換（ゼロコスト）
 *
 * パフォーマンス: 実行時コストなし
 */
export const threeQuatToCannonQuatUnsafe = (quat: THREE.Quaternion): CANNON.Quaternion => unsafeCoerce(quat)

/**
 * 型安全性に関する注記:
 *
 * これらの関数は unsafeCoerce を使用しているが、以下の理由で安全:
 *
 * 1. CANNON.Vec3とTHREE.Vector3は同一の構造 { x: number, y: number, z: number }
 * 2. CANNON.QuaternionとTHREE.Quaternionは同一の構造 { x, y, z, w: number }
 * 3. メソッドの互換性は保証されないが、プロパティアクセスのみで使用
 * 4. パフォーマンスクリティカルな物理演算ループで使用されるため、
 *    新しいオブジェクト生成のコストを避ける必要がある
 *
 * メソッド呼び出しが必要な場合は、新しいオブジェクトを生成する
 * 変換関数（three-integration.ts内）を使用すること。
 */
