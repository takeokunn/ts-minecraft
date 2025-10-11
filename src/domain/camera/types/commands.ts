import { Schema } from 'effect'

import { CameraModeSchema } from './constants'
import { CameraIdSchema } from './events'
import { CameraVector3Schema } from './camera_view'

/**
 * カメラコマンド共通メタデータ
 */
export const CameraCommandMetadataSchema = Schema.Struct({
  commandId: Schema.String.pipe(Schema.uuid(), Schema.annotations({ description: 'コマンドID (UUID)' })),
  issuedAt: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: '発行タイムスタンプ (epoch millis)' })
  ),
  actorId: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'コマンド発行者' })
  ),
})

/**
 * CameraCommand 共通フィールド
 */
export const CameraCommandBaseSchema = Schema.Struct({
  ...CameraCommandMetadataSchema.fields,
  cameraId: CameraIdSchema,
})

/**
 * カメラ位置更新コマンド
 */
export const UpdateCameraPositionCommandSchema = Schema.Struct({
  ...CameraCommandBaseSchema.fields,
  _tag: Schema.Literal('UpdateCameraPosition'),
  position: CameraVector3Schema,
})

export type UpdateCameraPositionCommand = Schema.Schema.Type<typeof UpdateCameraPositionCommandSchema>

/**
 * カメラ回転更新コマンド (度単位)
 */
export const UpdateCameraRotationCommandSchema = Schema.Struct({
  ...CameraCommandBaseSchema.fields,
  _tag: Schema.Literal('UpdateCameraRotation'),
  rotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
    roll: Schema.optional(Schema.Number),
  }),
})

export type UpdateCameraRotationCommand = Schema.Schema.Type<typeof UpdateCameraRotationCommandSchema>

/**
 * カメラモード切替コマンド
 */
export const SwitchCameraModeCommandSchema = Schema.Struct({
  ...CameraCommandBaseSchema.fields,
  _tag: Schema.Literal('SwitchCameraMode'),
  mode: CameraModeSchema,
})

export type SwitchCameraModeCommand = Schema.Schema.Type<typeof SwitchCameraModeCommandSchema>

/**
 * カメラ設定更新コマンド (FOV/感度など)
 */
export const UpdateCameraSettingsCommandSchema = Schema.Struct({
  ...CameraCommandBaseSchema.fields,
  _tag: Schema.Literal('UpdateCameraSettings'),
  fov: Schema.optional(Schema.Number),
  sensitivity: Schema.optional(Schema.Number),
  smoothing: Schema.optional(Schema.Number),
  aspectRatio: Schema.optional(Schema.Number),
})

export type UpdateCameraSettingsCommand = Schema.Schema.Type<typeof UpdateCameraSettingsCommandSchema>

/**
 * カメラコマンドUnion
 */
export const CameraCommandSchema = Schema.Union(
  UpdateCameraPositionCommandSchema,
  UpdateCameraRotationCommandSchema,
  SwitchCameraModeCommandSchema,
  UpdateCameraSettingsCommandSchema
)

export type CameraCommand = Schema.Schema.Type<typeof CameraCommandSchema>

export const validateCameraCommand = Schema.decodeUnknown(CameraCommandSchema)
export const isCameraCommand = Schema.is(CameraCommandSchema)
