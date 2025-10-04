import { Effect, Layer, Ref } from 'effect'
import { SceneService } from './service'
import { ActiveScene, SceneState } from './types'

const createSceneServiceTestImpl = (initial: SceneState): Effect.Effect<SceneService> =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<SceneState>(initial)

    const transitionTo: SceneService['transitionTo'] = (scene) => Ref.set(stateRef, scene).pipe(Effect.as(scene))

    const saveSnapshot: SceneService['saveSnapshot'] = () => Effect.void
    const restoreFrom: SceneService['restoreFrom'] = () => Ref.get(stateRef)
    const registerFailure: SceneService['registerFailure'] = () => Ref.get(stateRef)
    const preload: SceneService['preload'] = () => Effect.void

    return SceneService.of({
      transitionTo,
      current: () => Ref.get(stateRef),
      saveSnapshot,
      restoreFrom,
      registerFailure,
      preload,
    })
  })

export const makeSceneServiceTestLayer = (initial: SceneState): Layer.Layer<SceneService> =>
  Layer.scoped(SceneService, createSceneServiceTestImpl(initial))

export const makeSceneServiceTestLayerFromActive = (initial: ActiveScene): Layer.Layer<SceneService> =>
  makeSceneServiceTestLayer(initial)
