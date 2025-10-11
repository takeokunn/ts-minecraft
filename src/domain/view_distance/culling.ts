import * as Schema from '@effect/schema/Schema'
import { Effect, Match } from 'effect'
import { pipe } from 'effect/Function'
import {
  CullableObject,
  CullingDecision,
  CullingDecisionSchema,
  ViewDistanceError,
  ViewFrustum,
  isWithinFrustum,
} from './index'

export interface CullingStrategy {
  readonly cull: (
    objects: readonly CullableObject[],
    frustum: ViewFrustum
  ) => Effect.Effect<readonly CullingDecision[], ViewDistanceError>
}

const toDecision = (object: CullableObject, visible: boolean): Effect.Effect<CullingDecision, ViewDistanceError> =>
  Effect.sync(() =>
    ({
      objectId: object.id,
      visible,
      reason: pipe(
        visible,
        Match.value,
        Match.when(true, () => 'visible'),
        Match.orElse(() => 'outside-frustum')
      ),
    } as CullingDecision)
  )

export const createCullingStrategy = (): CullingStrategy => ({
  cull: (objects, frustum) =>
    Effect.forEach(objects, (object) => toDecision(object, isWithinFrustum(frustum, object.position)), {
      concurrency: 4,
    }),
})
