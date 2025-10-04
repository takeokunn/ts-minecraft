import { Effect } from 'effect'
import {
  ViewControlConfig,
  ViewDistance,
  ViewDistanceError,
  ViewControlContext,
} from './types.js'
import { createViewFrustum, ViewFrustum } from './frustum.js'
import { createLODSelector, LODSelectionContext, LODSelector } from './lod.js'
import { createCullingStrategy, CullingStrategy } from './culling.js'
import { createViewSettingsRepository, ViewSettingsRepository } from './view_settings_repository.js'
import type { CameraState, ManagedObject } from './types.js'

export interface ViewDistanceToolkit {
  readonly computeFrustum: (
    camera: CameraState,
    viewDistance: ViewDistance
  ) => Effect.Effect<ViewFrustum, ViewDistanceError>
  readonly lodSelector: LODSelector
  readonly cullingStrategy: CullingStrategy
  readonly settingsRepository: ViewSettingsRepository
  readonly buildLODContext: (
    context: ViewControlContext,
    objects: readonly ManagedObject[]
  ) => Effect.Effect<LODSelectionContext, ViewDistanceError>
}

export const createViewDistanceToolkit = (
  initialConfig: ViewControlConfig
): Effect.Effect<ViewDistanceToolkit, ViewDistanceError> =>
  Effect.gen(function* () {
    const settingsRepository = yield* createViewSettingsRepository(initialConfig)
    const lodSelector = createLODSelector()
    const cullingStrategy = createCullingStrategy()

    const computeFrustum = (camera: CameraState, viewDistance: ViewDistance) =>
      createViewFrustum(camera, viewDistance)

    return {
      computeFrustum,
      lodSelector,
      cullingStrategy,
      settingsRepository,
      buildLODContext: (context, _objects) =>
        settingsRepository.load().pipe(
          Effect.map((config) => ({
            cameraPosition: context.camera.position,
            performance: context.performance,
            maxViewDistance: config.maxViewDistance,
          }))
        ),
    }
  })
