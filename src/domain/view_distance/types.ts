import { Data, Effect } from 'effect'
import { pipe } from 'effect/Function'
import * as Schema from '@effect/schema/Schema'
import * as TreeFormatter from '@effect/schema/TreeFormatter'

const finiteNumber = Schema.Number.pipe(Schema.finite())

export const CameraDistanceSchema = finiteNumber.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('CameraDistance')
)
export type CameraDistance = Schema.Schema.Type<typeof CameraDistanceSchema>

export const ViewDistanceSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(64),
  Schema.brand('ViewDistance')
)
export type ViewDistance = Schema.Schema.Type<typeof ViewDistanceSchema>

export const FrameRateSchema = finiteNumber.pipe(
  Schema.greaterThan(0),
  Schema.lessThanOrEqualTo(480),
  Schema.brand('FrameRate')
)
export type FrameRate = Schema.Schema.Type<typeof FrameRateSchema>

export const RenderPrioritySchema = finiteNumber.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('RenderPriority')
)
export type RenderPriority = Schema.Schema.Type<typeof RenderPrioritySchema>

export const LODLevelSchema = Schema.Literal(0, 1, 2, 3, 4).pipe(
  Schema.brand('LODLevel')
)
export type LODLevel = Schema.Schema.Type<typeof LODLevelSchema>

const vectorComponentSchema = finiteNumber

export const Vector3Schema = Schema.Struct({
  x: vectorComponentSchema,
  y: vectorComponentSchema,
  z: vectorComponentSchema,
}).pipe(Schema.brand('Vector3'))
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

export const CameraRotationSchema = Schema.Struct({
  pitch: finiteNumber,
  yaw: finiteNumber,
  roll: finiteNumber,
}).pipe(Schema.brand('CameraRotation'))
export type CameraRotation = Schema.Schema.Type<typeof CameraRotationSchema>

export const ProjectionSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('perspective'),
    fov: finiteNumber,
    aspect: finiteNumber,
    near: finiteNumber.pipe(Schema.greaterThan(0)),
    far: finiteNumber.pipe(Schema.greaterThan(0)),
  }),
  Schema.Struct({
    type: Schema.Literal('orthographic'),
    width: finiteNumber.pipe(Schema.greaterThan(0)),
    height: finiteNumber.pipe(Schema.greaterThan(0)),
    near: finiteNumber.pipe(Schema.greaterThan(0)),
    far: finiteNumber.pipe(Schema.greaterThan(0)),
  })
).pipe(Schema.brand('Projection'))
export type Projection = Schema.Schema.Type<typeof ProjectionSchema>

export const CameraStateSchema = Schema.Struct({
  position: Vector3Schema,
  rotation: CameraRotationSchema,
  projection: ProjectionSchema,
}).pipe(Schema.brand('CameraState'))
export type CameraState = Schema.Schema.Type<typeof CameraStateSchema>

export const EpochMillisSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('EpochMillis')
)
export type EpochMillis = Schema.Schema.Type<typeof EpochMillisSchema>

export const ManagedObjectSchema = Schema.Struct({
  id: Schema.String,
  position: Vector3Schema,
  boundingRadius: CameraDistanceSchema,
  priority: RenderPrioritySchema,
  lodLevel: LODLevelSchema,
  lastUpdatedAt: EpochMillisSchema,
}).pipe(Schema.brand('ManagedObject'))
export type ManagedObject = Schema.Schema.Type<typeof ManagedObjectSchema>

export const CullableObjectSchema = Schema.Struct({
  id: Schema.String,
  position: Vector3Schema,
  boundingRadius: CameraDistanceSchema,
  priority: RenderPrioritySchema,
  lastVisibleAt: EpochMillisSchema,
}).pipe(Schema.brand('CullableObject'))
export type CullableObject = Schema.Schema.Type<typeof CullableObjectSchema>

export const PerformanceMetricsSchema = Schema.Struct({
  frameRate: FrameRateSchema,
  memoryUsage: finiteNumber.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
  triangleCount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
}).pipe(Schema.brand('PerformanceMetrics'))
export type PerformanceMetrics = Schema.Schema.Type<typeof PerformanceMetricsSchema>

export const ViewControlConfigSchema = Schema.Struct({
  minViewDistance: ViewDistanceSchema,
  maxViewDistance: ViewDistanceSchema,
  updateIntervalMillis: Schema.Number.pipe(Schema.greaterThan(0)),
  hysteresis: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
  adaptiveQuality: Schema.Boolean,
}).pipe(Schema.brand('ViewControlConfig'))
export type ViewControlConfig = Schema.Schema.Type<typeof ViewControlConfigSchema>

export const ViewControlContextSchema = Schema.Struct({
  camera: CameraStateSchema,
  performance: PerformanceMetricsSchema,
  sceneComplexity: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
}).pipe(Schema.brand('ViewControlContext'))
export type ViewControlContext = Schema.Schema.Type<typeof ViewControlContextSchema>

export const FrustumSummarySchema = Schema.Struct({
  id: Schema.String,
  farDistance: CameraDistanceSchema,
  nearDistance: CameraDistanceSchema,
  timestamp: EpochMillisSchema,
}).pipe(Schema.brand('FrustumSummary'))
export type FrustumSummary = Schema.Schema.Type<typeof FrustumSummarySchema>

export const LODDecisionSchema = Schema.Struct({
  objectId: Schema.String,
  level: LODLevelSchema,
  confidence: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
}).pipe(Schema.brand('LODDecision'))
export type LODDecision = Schema.Schema.Type<typeof LODDecisionSchema>

export const CullingDecisionSchema = Schema.Struct({
  objectId: Schema.String,
  visible: Schema.Boolean,
  reason: Schema.String,
}).pipe(Schema.brand('CullingDecision'))
export type CullingDecision = Schema.Schema.Type<typeof CullingDecisionSchema>

export const ViewControlResultSchema = Schema.Struct({
  frustum: FrustumSummarySchema,
  lodDecisions: Schema.Array(LODDecisionSchema),
  cullingDecisions: Schema.Array(CullingDecisionSchema),
  appliedOptimizations: Schema.Array(Schema.String),
}).pipe(Schema.brand('ViewControlResult'))
export type ViewControlResult = Schema.Schema.Type<typeof ViewControlResultSchema>

export const InvalidDistanceError = Data.tagged<{
  readonly input: number
  readonly minimum: number
  readonly maximum: number
}>('InvalidDistanceError')

export const InvalidConfigurationError = Data.tagged<{
  readonly issues: readonly string[]
}>('InvalidConfigurationError')

export const CalculationFailedError = Data.tagged<{
  readonly reason: string
}>('CalculationFailedError')

export type ViewDistanceError =
  | ReturnType<typeof InvalidDistanceError>
  | ReturnType<typeof InvalidConfigurationError>
  | ReturnType<typeof CalculationFailedError>

export const FrustumComputedEvent = Data.tagged<{
  readonly summary: FrustumSummary
}>('FrustumComputedEvent')

export const LODBatchEvaluatedEvent = Data.tagged<{
  readonly decisions: readonly LODDecision[]
}>('LODBatchEvaluatedEvent')

export const ObjectsCulledEvent = Data.tagged<{
  readonly decisions: readonly CullingDecision[]
}>('ObjectsCulledEvent')

export type ViewDistanceEvent =
  | ReturnType<typeof FrustumComputedEvent>
  | ReturnType<typeof LODBatchEvaluatedEvent>
  | ReturnType<typeof ObjectsCulledEvent>

type ParseErrorInput = Parameters<typeof TreeFormatter.formatErrorSync>[0]

const formatIssues = (error: ParseErrorInput): readonly string[] =>
  TreeFormatter.formatErrorSync(error).split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

export const decodeCameraState = (input: unknown): Effect.Effect<CameraState, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(CameraStateSchema)(input),
    Effect.mapError((error) => InvalidConfigurationError({ issues: formatIssues(error) }))
  )

export const decodeViewControlConfig = (
  input: unknown
): Effect.Effect<ViewControlConfig, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(ViewControlConfigSchema)(input),
    Effect.flatMap((config) =>
      config.minViewDistance > config.maxViewDistance
        ? Effect.fail(
            InvalidConfigurationError({
              issues: ['minViewDistance must be less than or equal to maxViewDistance'],
            })
          )
        : Effect.succeed(config)
    ),
    Effect.mapError((error) =>
      typeof error === 'object' && error !== null && 'issues' in error
        ? (error as ReturnType<typeof InvalidConfigurationError>)
        : InvalidConfigurationError({ issues: formatIssues(error as ParseErrorInput) })
    )
  )

export const decodeManagedObject = (
  input: unknown
): Effect.Effect<ManagedObject, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(ManagedObjectSchema)(input),
    Effect.mapError((error) => InvalidConfigurationError({ issues: formatIssues(error) }))
  )

export const decodeCullableObject = (
  input: unknown
): Effect.Effect<CullableObject, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(CullableObjectSchema)(input),
    Effect.mapError((error) => InvalidConfigurationError({ issues: formatIssues(error) }))
  )

export const decodePerformanceMetrics = (
  input: unknown
): Effect.Effect<PerformanceMetrics, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(PerformanceMetricsSchema)(input),
    Effect.mapError((error) => InvalidConfigurationError({ issues: formatIssues(error) }))
  )

export const toViewDistance = (
  value: number
): Effect.Effect<ViewDistance, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(ViewDistanceSchema)(value),
    Effect.mapError(() => InvalidDistanceError({ input: value, minimum: 1, maximum: 64 }))
  )

export const toRenderPriority = (
  value: number
): Effect.Effect<RenderPriority, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(RenderPrioritySchema)(Math.min(1, Math.max(0, value))),
    Effect.mapError(() =>
      InvalidConfigurationError({ issues: [`priority must be between 0 and 1: received ${value}`] })
    )
  )

export const toEpochMillis = (
  value: number
): Effect.Effect<EpochMillis, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(EpochMillisSchema)(Math.round(value)),
    Effect.mapError(() =>
      CalculationFailedError({ reason: `invalid epoch milliseconds value received: ${value}` })
    )
  )

export const clampViewDistance = (
  value: number,
  min: ViewDistance,
  max: ViewDistance
): Effect.Effect<ViewDistance, ViewDistanceError> =>
  toViewDistance(Math.min(Math.max(value, min), max))

export const adjustRenderPriority = (
  priority: RenderPriority,
  delta: number
): Effect.Effect<RenderPriority, ViewDistanceError> =>
  toRenderPriority(Number(priority) + delta)

export const deriveCullableFromManaged = (
  object: ManagedObject,
  timestamp: EpochMillis
): Effect.Effect<CullableObject, never> =>
  Effect.succeed({
    id: object.id,
    position: object.position,
    boundingRadius: object.boundingRadius,
    priority: object.priority,
    lastVisibleAt: timestamp,
  } satisfies CullableObject)

export const emptyViewControlResult: ViewControlResult = {
  frustum: {
    id: 'frustum:empty',
    farDistance: Schema.decodeUnknownSync(CameraDistanceSchema)(0),
    nearDistance: Schema.decodeUnknownSync(CameraDistanceSchema)(0),
    timestamp: Schema.decodeUnknownSync(EpochMillisSchema)(0),
  },
  lodDecisions: [],
  cullingDecisions: [],
  appliedOptimizations: [],
}

export const createManagedObject = Schema.decodeUnknownSync(ManagedObjectSchema)
export const createCullableObject = Schema.decodeUnknownSync(CullableObjectSchema)
export const createCameraState = Schema.decodeUnknownSync(CameraStateSchema)
export const createViewControlConfig = Schema.decodeUnknownSync(ViewControlConfigSchema)
export const createPerformanceMetrics = Schema.decodeUnknownSync(PerformanceMetricsSchema)
