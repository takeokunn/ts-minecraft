import { Match, Schema } from 'effect'

const defaultProjection = {
  fov: 75,
  aspect: 16 / 9,
  near: 0.1,
  far: 1000,
} as const

const defaultTransform = {
  position: { x: 0, y: 0, z: 0 },
  target: { x: 0, y: 0, z: -1 },
  orientation: {
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
} as const

/**
 * カメラ投影パラメータ
 */
export const CameraProjectionSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  aspect: Schema.Number.pipe(Schema.greaterThan(0)),
  near: Schema.Number.pipe(Schema.greaterThan(0)),
  far: Schema.Number.pipe(Schema.greaterThan(0)),
}).pipe(Schema.brand('CameraProjection'))

export type CameraProjection = Schema.Schema.Type<typeof CameraProjectionSchema>
export type CameraProjectionBrand = Schema.Schema.Brand<typeof CameraProjectionSchema>

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
}).pipe(Schema.brand('CameraTransform'))

export type CameraTransform = Schema.Schema.Type<typeof CameraTransformSchema>
export type CameraTransformBrand = Schema.Schema.Brand<typeof CameraTransformSchema>

/**
 * カメラスナップショット
 */
export const CameraSnapshotSchema = Schema.Struct({
  projection: CameraProjectionSchema,
  transform: CameraTransformSchema,
})

export type CameraSnapshot = Schema.Schema.Type<typeof CameraSnapshotSchema>

type CameraProjectionInput = Partial<{
  readonly fov: number
  readonly aspect: number
  readonly near: number
  readonly far: number
}>

type CameraVector3Input = Partial<{
  readonly x: number
  readonly y: number
  readonly z: number
}>

type CameraQuaternionInput = Partial<{
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}>

type CameraRotationInput = Partial<{
  readonly pitch: number
  readonly yaw: number
  readonly roll: number
}>

type CameraOrientationInput = Partial<{
  readonly rotation: CameraRotationInput
  readonly quaternion: CameraQuaternionInput
}>

type CameraTransformInput = Partial<{
  readonly position: CameraVector3Input
  readonly target: CameraVector3Input
  readonly orientation: CameraOrientationInput
}>

export interface CameraSnapshotInput {
  readonly projection?: CameraProjectionInput
  readonly transform?: CameraTransformInput
}

const decodeSync = <S extends Schema.Schema<any>>(
  schema: S,
  value: unknown
): Schema.Schema.Type<S> => {
  return Match.value(Schema.decodeUnknownEither(schema)(value))
    .pipe(
      Match.tag('Left', (result) => {
        throw result.left
      }),
      Match.tag('Right', (result) => result.right),
      Match.exhaustive
    )
}

const mergeVector = (
  defaults: typeof defaultTransform.position,
  overrides?: CameraVector3Input
) => ({
  x: overrides?.x ?? defaults.x,
  y: overrides?.y ?? defaults.y,
  z: overrides?.z ?? defaults.z,
})

const mergeQuaternion = (
  overrides?: CameraQuaternionInput
) => ({
  x: overrides?.x ?? defaultTransform.orientation.quaternion.x,
  y: overrides?.y ?? defaultTransform.orientation.quaternion.y,
  z: overrides?.z ?? defaultTransform.orientation.quaternion.z,
  w: overrides?.w ?? defaultTransform.orientation.quaternion.w,
})

const mergeRotation = (
  overrides?: CameraRotationInput
) => ({
  pitch: overrides?.pitch ?? defaultTransform.orientation.rotation.pitch,
  yaw: overrides?.yaw ?? defaultTransform.orientation.rotation.yaw,
  roll: overrides?.roll ?? defaultTransform.orientation.rotation.roll,
})

const buildProjection = (input?: CameraProjectionInput): CameraProjection =>
  decodeSync(CameraProjectionSchema, {
    fov: input?.fov ?? defaultProjection.fov,
    aspect: input?.aspect ?? defaultProjection.aspect,
    near: input?.near ?? defaultProjection.near,
    far: input?.far ?? defaultProjection.far,
  })

const buildTransform = (input?: CameraTransformInput): CameraTransform =>
  decodeSync(CameraTransformSchema, {
    position: mergeVector(defaultTransform.position, input?.position),
    target: mergeVector(defaultTransform.target, input?.target),
    orientation: {
      rotation: mergeRotation(input?.orientation?.rotation),
      quaternion: mergeQuaternion(input?.orientation?.quaternion),
    },
  })

/**
 * CameraSnapshotを同期的に構築するヘルパー
 */
export const makeCameraSync = (input: CameraSnapshotInput = {}): CameraSnapshot =>
  decodeSync(CameraSnapshotSchema, {
    projection: buildProjection(input.projection),
    transform: buildTransform(input.transform),
  })
