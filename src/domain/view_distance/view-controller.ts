import { Clock, Effect } from 'effect'
import { pipe } from 'effect/Function'
import * as Schema from '@effect/schema/Schema'
import {
  InvalidConfigurationError,
  LODBatchEvaluatedEvent,
  ManagedObject,
  ObjectsCulledEvent,
  ViewControlConfig,
  ViewControlResult,
  ViewControlResultSchema,
  ViewControlContext,
  ViewDistanceError,
  ViewDistanceEvent,
  deriveCullableFromManaged,
  toEpochMillis,
} from './types.js'
import { summarizeFrustum, frustumComputedEvent } from './frustum.js'
import { createViewDistanceToolkit, ViewDistanceToolkit } from './frustum-factory.js'

export interface ViewController {
  readonly updateViewSystem: (
    context: ViewControlContext,
    objects: readonly ManagedObject[]
  ) => Effect.Effect<
    {
      readonly result: ViewControlResult
      readonly events: readonly ViewDistanceEvent[]
    },
    ViewDistanceError
  >
  readonly applyNewSettings: (
    config: ViewControlConfig
  ) => Effect.Effect<ViewControlConfig, ViewDistanceError>
}

const makeController = (toolkit: ViewDistanceToolkit): ViewController => ({
  updateViewSystem: (context, objects) =>
    Effect.gen(function* () {
      const config = yield* toolkit.settingsRepository.load()
      const frustum = yield* toolkit.computeFrustum(context.camera, config.maxViewDistance)
      const lodContext = yield* toolkit.buildLODContext(context, objects)
      const lodDecisions = yield* toolkit.lodSelector.selectBatch(objects, lodContext)
      const now = yield* Clock.currentTimeMillis
      const timestamp = yield* toEpochMillis(now)
      const cullableObjects = yield* Effect.forEach(objects, (object) =>
        deriveCullableFromManaged(object, timestamp)
      )
      const cullingDecisions = yield* toolkit.cullingStrategy.cull(cullableObjects, frustum)
      const summary = yield* summarizeFrustum(frustum)

      const appliedOptimizations = ['frustum-updated', 'lod-evaluated', 'culling-performed']

      const result = yield* Effect.sync(() =>
        Schema.decodeUnknownSync(ViewControlResultSchema)({
          frustum: summary,
          lodDecisions,
          cullingDecisions,
          appliedOptimizations,
        })
      )

      const frustumEvent = yield* frustumComputedEvent(frustum)
      const lodEvent = LODBatchEvaluatedEvent({ decisions: lodDecisions })
      const cullingEvent = ObjectsCulledEvent({ decisions: cullingDecisions })

      return { result, events: [frustumEvent, lodEvent, cullingEvent] }
    }),
  applyNewSettings: (config) => toolkit.settingsRepository.save(config),
})

export const createViewController = (
  initialConfig: ViewControlConfig
): Effect.Effect<ViewController, ViewDistanceError> =>
  pipe(createViewDistanceToolkit(initialConfig), Effect.map(makeController))
