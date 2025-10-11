import { Schema } from 'effect'

/**
 * カメラ投影パラメータ
 */
export const CameraProjectionSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  aspect: Schema.Number.pipe(Schema.greaterThan(0)),
  near: Schema.Number.pipe(Schema.greaterThan(0)),
  far: Schema.Number.pipe(Schema.greaterThan(0)),
})

export type CameraProjection = Schema.Schema.Type<typeof CameraProjectionSchema>

/**
 * ベクトル・四元数の標準Schema
 */
export const CameraVector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

export type CameraVector3 = Schema.Schema.Type<typeof CameraVector3Schema>

export const CameraQuaternionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  w: Schema.Number,
})

export type CameraQuaternion = Schema.Schema.Type<typeof CameraQuaternionSchema>

/**
 * カメラ回転（四元数 + オイラー）
 */
export const CameraOrientationSchema = Schema.Struct({
  rotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
    roll: Schema.Number,
  }),
  quaternion: CameraQuaternionSchema,
})

export type CameraOrientation = Schema.Schema.Type<typeof CameraOrientationSchema>

/**
 * カメラ変換情報
 */
export const CameraTransformSchema = Schema.Struct({
  position: CameraVector3Schema,
  orientation: CameraOrientationSchema,
  target: CameraVector3Schema,
})

export type CameraTransform = Schema.Schema.Type<typeof CameraTransformSchema>

/**
 * カメラスナップショット
 */
export const CameraSnapshotSchema = Schema.Struct({
  projection: CameraProjectionSchema,
  transform: CameraTransformSchema,
})

export type CameraSnapshot = Schema.Schema.Type<typeof CameraSnapshotSchema>
