/**
 * @fileoverview Vector3 Schema - 共有カーネル
 * 3次元ベクトルのBrand型定義（統一Schema）
 */

import { Schema } from 'effect'

/**
 * Vector3 Schema定義（Brand型）
 * 3次元空間の位置・方向ベクトルを表現する共有カーネル型
 *
 * 用途:
 * - 位置座標（ワールド座標、ブロック座標等）
 * - 速度ベクトル（物理演算）
 * - 方向ベクトル（カメラ、視線等）
 * - オフセット・移動量
 *
 * 制約:
 * - 各成分は有限数（Infinity/NaN不可）
 *
 * Brand名:
 * - 'Vector3' - 汎用3次元ベクトル
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(
  Schema.brand('Vector3'),
  Schema.annotations({
    title: 'Vector3',
    description: '3D vector for positions, velocities, directions, and offsets',
    examples: [
      { x: 0, y: 0, z: 0 },
      { x: 10.5, y: 64, z: -15.2 },
      { x: 1, y: 0, z: 0 },
    ],
  })
)

export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>
