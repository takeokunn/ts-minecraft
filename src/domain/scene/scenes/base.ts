import { Data, Effect, Ref, Schema } from 'effect'
import {
  ActiveScene,
  ActiveSceneSchema,
  SceneState,
} from '../types'

export type SceneControllerError = Data.TaggedEnum<{
  InvalidMutation: { readonly reason: string }
}>

export const SceneControllerError = Data.taggedEnum<SceneControllerError>()

export interface SceneController<A extends ActiveScene> {
  readonly current: () => Effect.Effect<A>
  readonly update: (
    updater: (scene: A) => A
  ) => Effect.Effect<A, SceneControllerError>
  readonly replace: (scene: A) => Effect.Effect<A, SceneControllerError>
  readonly reset: () => Effect.Effect<A>
}

const decodeActive = Schema.decode(ActiveSceneSchema)

const formatIssue = (issue: Schema.ParseError): string =>
  Schema.formatIssueSync(issue)

const validate = <A extends ActiveScene>(scene: A): Effect.Effect<A, SceneControllerError> =>
  decodeActive(scene).pipe(
    Effect.map(() => scene),
    Effect.mapError((issue) =>
      SceneControllerError.InvalidMutation({ reason: formatIssue(issue) })
    )
  )

export const createSceneController = <A extends ActiveScene>(
  initial: A
): Effect.Effect<SceneController<A>> =>
  Effect.gen(function* () {
    const validatedInitial = yield* validate(initial)
    const stateRef = yield* Ref.make(validatedInitial)
    const initialRef = yield* Ref.make(validatedInitial)

    const setState = (scene: A) =>
      validate(scene).pipe(Effect.tap((value) => Ref.set(stateRef, value)))

    return {
      current: () => Ref.get(stateRef),
      update: (updater) =>
        Ref.get(stateRef).pipe(
          Effect.map(updater),
          Effect.flatMap(setState)
        ),
      replace: (scene) => setState(scene),
      reset: () =>
        Ref.get(initialRef).pipe(
          Effect.tap((value) => Ref.set(stateRef, value))
        ),
    }
  })

export type SceneBlueprint<A extends ActiveScene> = {
  readonly initial: A
  readonly controller: Effect.Effect<SceneController<A>>
}

export const makeBlueprint = <A extends ActiveScene>(
  initial: A
): SceneBlueprint<A> => ({
  initial,
  controller: createSceneController(initial),
})

export const isActiveScene = (scene: SceneState): scene is ActiveScene =>
  Schema.decodeEither(ActiveSceneSchema)(scene)._tag === 'Right'
