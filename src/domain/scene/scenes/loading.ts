import { Effect, Schema } from 'effect'
import { SceneState as Scenes } from '../types'
import {
  SceneBlueprint,
  SceneCleanupError,
  SceneContext,
  SceneController,
  SceneControllerError,
  SceneDefinition,
  SceneInitializationError,
  SceneLifecycleError,
  SceneUpdateError,
  createSceneController,
  makeSceneLayer,
  mapControllerFailure,
} from './base'

const decodeProgress = Schema.decode(Schema.Number.pipe(Schema.between(0, 1)))
const formatIssue = (issue: Schema.ParseError) => issue.message

const clampProgress = (value: number) =>
  decodeProgress(value).pipe(
    Effect.mapError((issue) => SceneControllerError.InvalidMutation({ reason: formatIssue(issue) }))
  )

export interface LoadingSceneController extends SceneController<ReturnType<typeof Scenes.Loading>> {
  readonly advance: (delta: number) => Effect.Effect<number, SceneControllerError>
  readonly setProgress: (value: number) => Effect.Effect<number, SceneControllerError>
}

export const createLoadingSceneController = (
  target: ReturnType<typeof Scenes.MainMenu> = Scenes.MainMenu()
): Effect.Effect<LoadingSceneController> =>
  createSceneController(Scenes.Loading({ target })).pipe(
    Effect.map((controller) => {
      const setProgress: LoadingSceneController['setProgress'] = (value) =>
        clampProgress(value).pipe(
          Effect.flatMap((progress) =>
            controller.update((scene) => ({
              ...scene,
              progress,
            }))
          ),
          Effect.map((scene) => scene.progress)
        )

      const advance: LoadingSceneController['advance'] = (delta) =>
        controller.current().pipe(
          Effect.flatMap((scene) => setProgress(scene.progress + delta))
        )

      return {
        ...controller,
        advance,
        setProgress,
      }
    })
  )

type LoadingState = ReturnType<typeof Scenes.Loading>

type LoadingSceneContext = SceneContext<LoadingState, LoadingSceneController>

interface LoadingMetadata {
  readonly loadingType: string
  readonly showTips: boolean
  readonly animationType: string
}

const metadata: Readonly<LoadingMetadata> = {
  loadingType: 'WorldGeneration',
  showTips: true,
  animationType: 'spinner',
}

const handleInitializationFailure = (reason: string): SceneInitializationError =>
  SceneInitializationError({ sceneType: 'Loading', message: reason })

const handleUpdateFailure = (reason: string): SceneUpdateError =>
  SceneUpdateError({ sceneType: 'Loading', reason })

const handleLifecycleFailure = (phase: SceneLifecycleError['phase']) => (reason: string): SceneLifecycleError =>
  SceneLifecycleError({ sceneType: 'Loading', phase, message: reason })

const handleCleanupFailure = (reason: string): SceneCleanupError =>
  SceneCleanupError({ sceneType: 'Loading', message: reason })

const LoadingSceneBlueprint: SceneBlueprint<LoadingState, LoadingSceneController> = {
  initial: Scenes.Loading({ target: Scenes.MainMenu() }),
  controller: createLoadingSceneController(Scenes.MainMenu()),
}

const mainUpdateStep = (context: LoadingSceneContext, delta: number) =>
  Effect.gen(function* () {
    const current = yield* context.controller.current()
    const nextProgress = Math.min(1, current.progress + delta)
    yield* mapControllerFailure(
      context.controller.setProgress(nextProgress),
      handleUpdateFailure
    )
    return nextProgress
  })

const mainInitializeStep = (context: LoadingSceneContext) =>
  mapControllerFailure(context.controller.setProgress(0), handleInitializationFailure)

const setComplete = (context: LoadingSceneContext) =>
  mapControllerFailure(context.controller.setProgress(1), handleLifecycleFailure('exit'))

const resetProgress = (context: LoadingSceneContext) =>
  mapControllerFailure(context.controller.setProgress(0), handleCleanupFailure)

const loadingDefinition: SceneDefinition<LoadingState, LoadingSceneController> = {
  id: 'loading-scene-001',
  type: 'Loading',
  metadata,
  blueprint: LoadingSceneBlueprint,
  onInitialize: (context) =>
    Effect.gen(function* () {
      yield* context.controller.reset()
      yield* mainInitializeStep(context)
      return undefined
    }),
  onUpdate: (context, frameTime) =>
    mainUpdateStep(context, Math.min(1, Number(frameTime) / 1000)).pipe(Effect.asVoid),
  onEnter: () => Effect.void,
  onExit: (context) => setComplete(context).pipe(Effect.asVoid),
  onCleanup: (context) => resetProgress(context).pipe(Effect.asVoid),
}

export const LoadingScene = makeSceneLayer(loadingDefinition)

export { LoadingSceneBlueprint }
export const LoadingDefinition = loadingDefinition
