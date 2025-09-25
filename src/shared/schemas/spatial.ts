import { Schema } from '@effect/schema'

// 3D座標
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Vector3D = Schema.Schema.Type<typeof Vector3Schema>

// Mutable 3D座標（物理計算用）
export interface MutableVector3D {
  x: number
  y: number
  z: number
}

// 回転情報（ピッチ、ヨー、ロール）
export const RotationSchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-90, 90)), // 上下の視点角度
  yaw: Schema.Number.pipe(Schema.between(-180, 180)), // 左右の視点角度
  roll: Schema.Number, // 傾き（通常は0）
})
export type Rotation = Schema.Schema.Type<typeof RotationSchema>

// ブロック位置（整数座標）
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int(), Schema.between(0, 320)), // Minecraft world height
  z: Schema.Number.pipe(Schema.int()),
})
export type BlockPosition = Schema.Schema.Type<typeof BlockPosition>

// チャンク座標
export const ChunkCoordinate = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
})
export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

// バウンディングボックス
export const BoundingBox = Schema.Struct({
  min: Vector3Schema,
  max: Vector3Schema,
})
export type BoundingBox = Schema.Schema.Type<typeof BoundingBox>

// ベクトル演算ヘルパー
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
}
