import { Schema } from 'effect'

import { CameraIdSchema } from './events'

/**
 * クエリ共通メタデータ
 */
export const CameraQueryMetadataSchema = Schema.Struct({
  queryId: Schema.String.pipe(Schema.uuid(), Schema.annotations({ description: 'クエリID (UUID)' })),
  requestedAt: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: 'リクエストタイムスタンプ (epoch millis)' })
  ),
  requesterId: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'リクエスト発行者' })
  ),
})

/**
 * カメラスナップショット取得クエリ
 */
export const GetCameraSnapshotQuerySchema = Schema.Struct({
  ...CameraQueryMetadataSchema.fields,
  _tag: Schema.Literal('GetCameraSnapshot'),
  cameraId: CameraIdSchema,
})

export type GetCameraSnapshotQuery = Schema.Schema.Type<typeof GetCameraSnapshotQuerySchema>

/**
 * カメラ状態取得クエリ
 */
export const GetCameraStateQuerySchema = Schema.Struct({
  ...CameraQueryMetadataSchema.fields,
  _tag: Schema.Literal('GetCameraState'),
  cameraId: CameraIdSchema,
})

export type GetCameraStateQuery = Schema.Schema.Type<typeof GetCameraStateQuerySchema>

/**
 * アクティブカメラ一覧取得クエリ
 */
export const ListActiveCamerasQuerySchema = Schema.Struct({
  ...CameraQueryMetadataSchema.fields,
  _tag: Schema.Literal('ListActiveCameras'),
})

export type ListActiveCamerasQuery = Schema.Schema.Type<typeof ListActiveCamerasQuerySchema>

/**
 * カメラクエリUnion
 */
export const CameraQuerySchema = Schema.Union(
  GetCameraSnapshotQuerySchema,
  GetCameraStateQuerySchema,
  ListActiveCamerasQuerySchema
)

export type CameraQuery = Schema.Schema.Type<typeof CameraQuerySchema>

export const validateCameraQuery = Schema.decodeUnknown(CameraQuerySchema)
export const isCameraQuery = Schema.is(CameraQuerySchema)
