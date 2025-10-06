import * as Schema from '@effect/schema/Schema'
import { Effect, Match } from 'effect'
import { pipe } from 'effect/Function'
import {
  InvalidConfigurationError,
  LODDecision,
  LODDecisionSchema,
  LODLevel,
  LODLevelSchema,
  ManagedObject,
  PerformanceMetrics,
  Vector3,
  ViewDistance,
  ViewDistanceError,
} from './index'

export interface LODSelectionContext {
  readonly cameraPosition: Vector3
  readonly performance: PerformanceMetrics
  readonly maxViewDistance: ViewDistance
}

export interface LODSelector {
  readonly selectForObject: (
    object: ManagedObject,
    context: LODSelectionContext
  ) => Effect.Effect<LODDecision, ViewDistanceError>
  readonly selectBatch: (
    objects: readonly ManagedObject[],
    context: LODSelectionContext
  ) => Effect.Effect<readonly LODDecision[], ViewDistanceError>
}

const decodeLODLevel = (value: number) =>
  pipe(
    Schema.decodeUnknown(LODLevelSchema)(value),
    Effect.mapError(() => InvalidConfigurationError({ issues: [`invalid LOD level calculated: ${value}`] }))
  )

const decodeLODDecision = (decision: {
  readonly objectId: string
  readonly level: LODLevel
  readonly confidence: number
}) => Effect.sync(() => Schema.decodeUnknownSync(LODDecisionSchema)(decision))

const squaredDistance = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

const computeBaseLevel = (
  distance: number,
  maxViewDistance: ViewDistance
): Effect.Effect<LODLevel, ViewDistanceError> => {
  const normalized = distance / Math.max(1, Number(maxViewDistance))
  const clamped = Math.min(4, Math.max(0, Math.floor(normalized * 5)))
  return decodeLODLevel(clamped)
}

const adjustForPerformance = (
  baseLevel: LODLevel,
  performance: PerformanceMetrics
): Effect.Effect<LODLevel, ViewDistanceError> => {
  const adjustment = pipe(
    performance.frameRate,
    Match.value,
    Match.when(
      (rate) => rate < 30,
      () => 1
    ),
    Match.when(
      (rate) => rate > 90,
      () => -1
    ),
    Match.orElse(() => 0)
  )

  return decodeLODLevel(Math.min(4, Math.max(0, Number(baseLevel) + adjustment)))
}

const computeConfidence = (distance: number, maxViewDistance: ViewDistance): number => {
  const normalized = distance / Math.max(1, Number(maxViewDistance))
  return Math.max(0, Math.min(1, 1 - normalized))
}

const selectDecision = (
  object: ManagedObject,
  context: LODSelectionContext
): Effect.Effect<LODDecision, ViewDistanceError> =>
  Effect.gen(function* () {
    const distance = Math.sqrt(squaredDistance(object.position, context.cameraPosition))
    const baseLevel = yield* computeBaseLevel(distance, context.maxViewDistance)
    const adjustedLevel = yield* adjustForPerformance(baseLevel, context.performance)
    const confidence = computeConfidence(distance, context.maxViewDistance)

    return yield* decodeLODDecision({
      objectId: object.id,
      level: adjustedLevel,
      confidence,
    })
  })

export const createLODSelector = (): LODSelector => ({
  selectForObject: selectDecision,
  selectBatch: (objects, context) =>
    Effect.forEach(objects, (object) => selectDecision(object, context), {
      concurrency: 'unbounded',
    }),
})

export const LODInternals = {
  computeBaseLevel,
  adjustForPerformance,
  computeConfidence,
}
