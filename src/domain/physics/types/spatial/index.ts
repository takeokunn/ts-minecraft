/**
 * Physics空間関連の型定義 - core.tsとの統合版
 *
 * @module domain/physics/types/spatial
 * @deprecated このファイルの型はcore.tsに統合されました。新しいVector3、Quaternion、Matrix4型を使用してください
 */

import { Brand, Schema } from 'effect'

// core.tsからの再エクスポート用の型定義
// 既存コードとの互換性のため一時的に維持

/**
 * 3D座標を表すスキーマ（レガシー互換性のため）
 * @deprecated core.tsのVector3Schemaを使用してください
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.brand('Vector3'))

export type Vector3D = Schema.Schema.Type<typeof Vector3Schema> & Brand.Brand<'Vector3'>

/**
 * Mutable 3D座標（物理計算用）
 * @deprecated core.tsのVector3を直接使用することを推奨
 */
export interface MutableVector3D {
  x: number
  y: number
  z: number
}

/**
 * 回転情報（ピッチ、ヨー、ロール）
 * @deprecated core.tsのQuaternionSchemaまたは新しい回転表現を使用してください
 */
export const RotationSchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-90, 90)), // 上下の視点角度
  yaw: Schema.Number.pipe(Schema.between(-180, 180)), // 左右の視点角度
  roll: Schema.Number, // 傾き（通常は0）
})
export type Rotation = Schema.Schema.Type<typeof RotationSchema>

/**
 * バウンディングボックス
 * @deprecated core.tsのAABBSchemaを使用してください
 */
export const BoundingBoxSchema = Schema.Struct({
  min: Vector3Schema,
  max: Vector3Schema,
})
export type BoundingBox = Schema.Schema.Type<typeof BoundingBoxSchema>

/**
 * ベクトル演算ユーティリティ
 */
export const VectorMath = {
  add: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),

  subtract: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),

  multiply: (v: Vector3D, scalar: number): Vector3D => ({
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  }),

  magnitude: (v: Vector3D): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),

  normalize: (v: Vector3D): Vector3D => {
    const mag = VectorMath.magnitude(v)
    if (mag === 0) return { x: 0, y: 0, z: 0 }
    return VectorMath.multiply(v, 1 / mag)
  },

  distance: (a: Vector3D, b: Vector3D): number => VectorMath.magnitude(VectorMath.subtract(b, a)),

  dot: (a: Vector3D, b: Vector3D): number => a.x * b.x + a.y * b.y + a.z * b.z,

  cross: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),

  lerp: (a: Vector3D, b: Vector3D, t: number): Vector3D => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }),

  zero: (): Vector3D => ({ x: 0, y: 0, z: 0 }),

  unitX: (): Vector3D => ({ x: 1, y: 0, z: 0 }),

  unitY: (): Vector3D => ({ x: 0, y: 1, z: 0 }),

  unitZ: (): Vector3D => ({ x: 0, y: 0, z: 1 }),
}

/**
 * Physics空間関連のBrandedTypesヘルパー
 * @deprecated core.tsのファクトリー関数（createVector3、createQuaternion等）を使用してください
 */
export const PhysicsSpatialBrandedTypes = {
  // Schema定義
  Vector3D: Vector3Schema,
  Rotation: RotationSchema,
  BoundingBox: BoundingBoxSchema,

  // 作成ヘルパー関数
  createVector3D: (x: number, y: number, z: number): Vector3D => Schema.decodeSync(Vector3Schema)({ x, y, z }),

  createRotation: (pitch: number, yaw: number, roll = 0): Rotation =>
    Schema.decodeSync(RotationSchema)({ pitch, yaw, roll }),

  createBoundingBox: (min: Vector3D, max: Vector3D): BoundingBox => Schema.decodeSync(BoundingBoxSchema)({ min, max }),
}

// ===== core.tsからの型の再エクスポート =====

// 新しいコードではこれらを使用してください
export {
  createMatrix4,
  createQuaternion,
  createVector3,
  Matrix4Schema,
  Vector3Schema as NewVector3Schema,
  QuaternionSchema,
} from '..'
export type { Matrix4, Quaternion, Vector3 } from '..'
