import { Effect, Schema } from 'effect'
import { SceneProgressSchema, SceneState as Scenes } from '../types'
import { SceneBlueprint, SceneController, SceneControllerError, createSceneController, makeBlueprint } from './base'

const decodeProgress = Schema.decode(SceneProgressSchema)
const formatIssue = (issue: Schema.ParseError) => Schema.formatIssueSync(issue)

const clampProgress = (value: number) =>
  Effect.gen(function* () {
    if (!Number.isFinite(value)) {
      return yield* Effect.fail(
        SceneControllerError.InvalidMutation({ reason: '進捗には有限値が必要です' })
      )
    }

    const normalized = Math.max(0, Math.min(1, value))

    return yield* decodeProgress(normalized).pipe(
      Effect.mapError((issue) =>
        SceneControllerError.InvalidMutation({ reason: formatIssue(issue) })
      )
    )
  })

export interface LoadingSceneController extends SceneController<ReturnType<typeof Scenes.Loading>> {
  readonly advance: (delta: number) => Effect.Effect<number, SceneControllerError>
  readonly setProgress: (value: number) => Effect.Effect<number, SceneControllerError>
}

export const createLoadingSceneController = (
  target = Scenes.MainMenu()
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
        controller
          .current()
          .pipe(
            Effect.flatMap((scene) => setProgress(scene.progress + delta))
          )

      return {
        ...controller,
        advance,
        setProgress,
      }
    })
  )

export const LoadingSceneBlueprint: SceneBlueprint<ReturnType<typeof Scenes.Loading>> = makeBlueprint(
  Scenes.Loading({ target: Scenes.MainMenu() })
)
