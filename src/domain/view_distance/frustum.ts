import { Clock, Effect, Match, Random } from 'effect'
import { pipe } from 'effect/Function'
import * as Schema from '@effect/schema/Schema'
import {
  CameraDistance,
  CameraDistanceSchema,
  CameraState,
  EpochMillis,
  FrustumComputedEvent,
  FrustumSummary,
  FrustumSummarySchema,
  InvalidConfigurationError,
  ViewDistance,
  ViewDistanceError,
  toEpochMillis,
} from './types.js'

export interface ViewFrustum {
  readonly id: string
  readonly camera: CameraState
  readonly nearDistance: CameraDistance
  readonly farDistance: CameraDistance
  readonly radiusSquared: number
  readonly timestamp: EpochMillis
}

const decodeCameraDistance = (value: number) =>
  Schema.decodeUnknown(CameraDistanceSchema)(Math.max(0, value))

const selectProjectionFar = (camera: CameraState): number =>
  pipe(
    camera.projection,
    Match.value,
    Match.when((projection) => projection.type === 'perspective', (projection) => projection.far),
    Match.when((projection) => projection.type === 'orthographic', (projection) => projection.far),
    Match.exhaustive
  )

const selectProjectionNear = (camera: CameraState): number =>
  pipe(
    camera.projection,
    Match.value,
    Match.when((projection) => projection.type === 'perspective', (projection) => projection.near),
    Match.when((projection) => projection.type === 'orthographic', (projection) => projection.near),
    Match.exhaustive
  )

export const createViewFrustum = (
  camera: CameraState,
  viewDistance: ViewDistance
): Effect.Effect<ViewFrustum, ViewDistanceError> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const timestamp = yield* toEpochMillis(now)

    const projectionFar = selectProjectionFar(camera)
    const projectionNear = selectProjectionNear(camera)

    const farDistance = yield* decodeCameraDistance(
      Math.min(Number(viewDistance), projectionFar)
    )

    const nearDistance = yield* decodeCameraDistance(projectionNear)

    const validated = yield* pipe(
      Effect.succeed({ nearDistance, farDistance }),
      Effect.flatMap((distances) =>
        distances.farDistance >= distances.nearDistance
          ? Effect.succeed(distances)
          : Effect.fail(
              InvalidConfigurationError({
                issues: [
                  `far distance must be greater than or equal to near distance: near=${distances.nearDistance} far=${distances.farDistance}`,
                ],
              })
            )
      )
    )

    const identifier = yield* pipe(
      Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER),
      Effect.map((value) => `frustum:${timestamp}:${value.toString(16)}`)
    )

    return {
      id: identifier,
      camera,
      nearDistance: validated.nearDistance,
      farDistance: validated.farDistance,
      radiusSquared: Number(validated.farDistance) * Number(validated.farDistance),
      timestamp,
    }
  })

export const updateViewFrustum = (
  current: ViewFrustum,
  camera: CameraState,
  viewDistance: ViewDistance
): Effect.Effect<ViewFrustum, ViewDistanceError> =>
  pipe(
    createViewFrustum(camera, viewDistance),
    Effect.map((updated) => ({ ...updated, id: current.id }))
  )

export const summarizeFrustum = (
  frustum: ViewFrustum
): Effect.Effect<FrustumSummary, never> =>
  Effect.sync(() =>
    Schema.decodeUnknownSync(FrustumSummarySchema)({
      id: frustum.id,
      nearDistance: frustum.nearDistance,
      farDistance: frustum.farDistance,
      timestamp: frustum.timestamp,
    })
  )

export const frustumComputedEvent = (
  frustum: ViewFrustum
): Effect.Effect<ReturnType<typeof FrustumComputedEvent>, ViewDistanceError> =>
  pipe(
    summarizeFrustum(frustum),
    Effect.map((summary) => FrustumComputedEvent({ summary }))
  )

export const isWithinFrustum = (
  frustum: ViewFrustum,
  position: { readonly x: number; readonly y: number; readonly z: number }
): boolean => {
  const dx = position.x - frustum.camera.position.x
  const dy = position.y - frustum.camera.position.y
  const dz = position.z - frustum.camera.position.z
  const distanceSquared = dx * dx + dy * dy + dz * dz
  return distanceSquared <= frustum.radiusSquared
}
