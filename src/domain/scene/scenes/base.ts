import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Data, Effect, Match, Ref, Schema } from 'effect'
import {
  ActiveScene,
  SceneId,
  SceneIdSchema,
  SceneKind,
  SceneState,
  SceneStateSchema,
} from '../types'

export type SceneControllerError = Data.TaggedEnum<{
  InvalidMutation: { readonly reason: string }
}>

export const SceneControllerError = Data.taggedEnum<SceneControllerError>()

export interface SceneController<A extends SceneState> {
  readonly current: () => Effect.Effect<A>
  readonly update: (updater: (scene: A) => A) => Effect.Effect<A, SceneControllerError>
  readonly replace: (scene: A) => Effect.Effect<A, SceneControllerError>
  readonly reset: () => Effect.Effect<A>
}

const decodeScene = Schema.decode(SceneStateSchema)

const formatIssue = (issue: Schema.ParseError): string => issue.message

const validate = <A extends SceneState>(scene: A): Effect.Effect<A, SceneControllerError> =>
  decodeScene(scene).pipe(
    Effect.map(() => scene),
    Effect.mapError((issue) => SceneControllerError.InvalidMutation({ reason: formatIssue(issue) }))
  )

export const createSceneController = <A extends SceneState>(initial: A): Effect.Effect<SceneController<A>> =>
  Effect.gen(function* () {
    const validatedInitial = yield* validate(initial)
    const stateRef = yield* Ref.make(validatedInitial)
    const initialRef = yield* Ref.make(validatedInitial)

    const setState = (scene: A) =>
      validate(scene).pipe(Effect.tap((value) => Ref.set(stateRef, value)))

    return {
      current: () => Ref.get(stateRef),
      update: (updater) => Ref.get(stateRef).pipe(Effect.map(updater), Effect.flatMap(setState)),
      replace: (scene) => setState(scene),
      reset: () => Ref.get(initialRef).pipe(Effect.tap((value) => Ref.set(stateRef, value))),
    }
  })

export type SceneBlueprint<A extends ActiveScene, C extends SceneController<A> = SceneController<A>> = {
  readonly initial: A
  readonly controller: Effect.Effect<C>
}

export const isActiveScene = (scene: SceneState): scene is ActiveScene =>
  Schema.decodeEither(SceneStateSchema)(scene)._tag === 'Right'

export interface SceneInitializationError {
  readonly _tag: 'SceneInitializationError'
  readonly sceneType: SceneKind
  readonly message: string
}
export const SceneInitializationError = Data.tagged<SceneInitializationError>('SceneInitializationError')

export interface SceneUpdateError {
  readonly _tag: 'SceneUpdateError'
  readonly sceneType: SceneKind
  readonly reason: string
}
export const SceneUpdateError = Data.tagged<SceneUpdateError>('SceneUpdateError')

export interface SceneRenderError {
  readonly _tag: 'SceneRenderError'
  readonly sceneType: SceneKind
  readonly reason: string
}
export const SceneRenderError = Data.tagged<SceneRenderError>('SceneRenderError')

export interface SceneLifecycleError {
  readonly _tag: 'SceneLifecycleError'
  readonly sceneType: SceneKind
  readonly phase: 'enter' | 'exit'
  readonly message: string
}
export const SceneLifecycleError = Data.tagged<SceneLifecycleError>('SceneLifecycleError')

export interface SceneCleanupError {
  readonly _tag: 'SceneCleanupError'
  readonly sceneType: SceneKind
  readonly message: string
}
export const SceneCleanupError = Data.tagged<SceneCleanupError>('SceneCleanupError')

const FrameTimeSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('FrameTime')
)
export type FrameTime = Schema.Schema.Type<typeof FrameTimeSchema>

const decodeFrameTime = Schema.decode(FrameTimeSchema)
const decodeSceneId = Schema.decode(SceneIdSchema)

const formatParseError = (error: Schema.ParseError): string => TreeFormatter.formatErrorSync(error)

const controllerErrorMessage = (error: SceneControllerError): string =>
  Match.value(error).pipe(
    Match.tag('InvalidMutation', (payload) => payload.reason),
    Match.exhaustive
  )

export const mapControllerFailure = <A, E>(
  effect: Effect.Effect<A, SceneControllerError>,
  toError: (reason: string) => E
): Effect.Effect<A, E> => effect.pipe(Effect.mapError((err) => toError(controllerErrorMessage(err))))

export interface SceneSnapshot<A extends SceneState> {
  readonly id: SceneId
  readonly kind: SceneKind
  readonly isActive: boolean
  readonly metadata: Readonly<Record<string, unknown>>
  readonly state: A
}

export interface SceneRuntime<A extends SceneState> {
  readonly snapshot: () => Effect.Effect<SceneSnapshot<A>>
  readonly initialize: () => Effect.Effect<SceneSnapshot<A>, SceneInitializationError>
  readonly update: (delta: number) => Effect.Effect<SceneSnapshot<A>, SceneUpdateError>
  readonly render: () => Effect.Effect<void, SceneRenderError>
  readonly onEnter: () => Effect.Effect<SceneSnapshot<A>, SceneLifecycleError>
  readonly onExit: () => Effect.Effect<SceneSnapshot<A>, SceneLifecycleError>
  readonly cleanup: () => Effect.Effect<SceneSnapshot<A>, SceneCleanupError>
}

export interface SceneContext<A extends SceneState, C extends SceneController<A>> {
  readonly controller: C
  readonly snapshot: () => Effect.Effect<SceneSnapshot<A>>
  readonly setActive: (value: boolean) => Effect.Effect<void>
  readonly setInitialized: (value: boolean) => Effect.Effect<void>
  readonly isInitialized: () => Effect.Effect<boolean>
  readonly isActive: () => Effect.Effect<boolean>
}

export interface SceneDefinition<A extends SceneState, C extends SceneController<A> = SceneController<A>> {
  readonly id: string
  readonly type: SceneKind
  readonly metadata: Readonly<Record<string, unknown>>
  readonly blueprint: SceneBlueprint<A, C>
  readonly onInitialize?: (context: SceneContext<A, C>) => Effect.Effect<void, SceneInitializationError>
  readonly onUpdate?: (context: SceneContext<A, C>, delta: FrameTime) => Effect.Effect<void, SceneUpdateError>
  readonly onRender?: (context: SceneContext<A, C>) => Effect.Effect<void, SceneRenderError>
  readonly onEnter?: (context: SceneContext<A, C>) => Effect.Effect<void, SceneLifecycleError>
  readonly onExit?: (context: SceneContext<A, C>) => Effect.Effect<void, SceneLifecycleError>
  readonly onCleanup?: (context: SceneContext<A, C>) => Effect.Effect<void, SceneCleanupError>
}

export const createSceneRuntime = <A extends SceneState, C extends SceneController<A>>(
  definition: SceneDefinition<A, C>
): Effect.Effect<SceneRuntime<A>> =>
  Effect.gen(function* () {
    const sceneId = yield* decodeSceneId(definition.id)
    const controller = yield* definition.blueprint.controller
    const initializedRef = yield* Ref.make(false)
    const activeRef = yield* Ref.make(false)

    const snapshot = () =>
      Effect.all({
        state: controller.current(),
        isActive: Ref.get(activeRef),
      }).pipe(
        Effect.map(({ state, isActive }) => ({
          id: sceneId,
          kind: state._tag,
          metadata: definition.metadata,
          isActive,
          state,
        }))
      )

    const setInitialized = (value: boolean) => Ref.set(initializedRef, value)
    const setActive = (value: boolean) => Ref.set(activeRef, value)

    const context: SceneContext<A, C> = {
      controller,
      snapshot,
      setActive,
      setInitialized,
      isInitialized: () => Ref.get(initializedRef),
      isActive: () => Ref.get(activeRef),
    }

    const ensureNotInitialized = <E>(error: () => E) =>
      Ref.get(initializedRef).pipe(
        Effect.flatMap((flag) =>
          Match.value(flag).pipe(
            Match.when(true, () => Effect.fail(error())),
            Match.when(false, () => Effect.void),
            Match.exhaustive
          )
        )
      )

    const ensureInitialized = <E>(error: () => E) =>
      Ref.get(initializedRef).pipe(
        Effect.flatMap((flag) =>
          Match.value(flag).pipe(
            Match.when(false, () => Effect.fail(error())),
            Match.when(true, () => Effect.void),
            Match.exhaustive
          )
        )
      )

    const onInitialize = definition.onInitialize ?? (() => Effect.void)
    const onUpdate = definition.onUpdate ?? (() => Effect.void)
    const onRender = definition.onRender ?? (() => Effect.void)
    const onEnter = definition.onEnter ?? (() => Effect.void)
    const onExit = definition.onExit ?? (() => Effect.void)
    const onCleanup = definition.onCleanup ?? (() => Effect.void)

    const initialize = () =>
      ensureNotInitialized(() =>
        SceneInitializationError({ sceneType: definition.type, message: 'Scene already initialized' })
      ).pipe(Effect.zipRight(onInitialize(context)), Effect.zipRight(setInitialized(true)), Effect.zipRight(snapshot()))

    const update = (delta: number) =>
      decodeFrameTime(delta).pipe(
        Effect.mapError((issue) =>
          SceneUpdateError({ sceneType: definition.type, reason: formatParseError(issue) })
        ),
        Effect.flatMap((frameTime) =>
          Effect.all({
            initialized: Ref.get(initializedRef),
            isActive: Ref.get(activeRef),
          }).pipe(
            Effect.flatMap(({ initialized, isActive }) =>
              Match.value(initialized).pipe(
                Match.when(false, () => snapshot()),
                Match.when(true, () =>
                  Match.value(isActive).pipe(
                    Match.when(false, () => snapshot()),
                    Match.when(true, () => onUpdate(context, frameTime).pipe(Effect.zipRight(snapshot()))),
                    Match.exhaustive
                  )
                ),
                Match.exhaustive
              )
            )
          )
        )
      )

    const render = () =>
      Effect.all({
        initialized: Ref.get(initializedRef),
        isActive: Ref.get(activeRef),
      }).pipe(
        Effect.flatMap(({ initialized, isActive }) =>
          Match.value(initialized).pipe(
            Match.when(false, () => Effect.void),
            Match.when(true, () =>
              Match.value(isActive).pipe(
                Match.when(false, () => Effect.void),
                Match.when(true, () => onRender(context)),
                Match.exhaustive
              )
            ),
            Match.exhaustive
          )
        )
      )

    const enter = () => onEnter(context).pipe(Effect.zipRight(setActive(true)), Effect.zipRight(snapshot()))

    const exit = () => onExit(context).pipe(Effect.zipRight(setActive(false)), Effect.zipRight(snapshot()))

    const cleanup = () =>
      ensureInitialized(() =>
        SceneCleanupError({ sceneType: definition.type, message: 'Scene not initialized' })
      ).pipe(
        Effect.zipRight(onCleanup(context)),
        Effect.zipRight(controller.reset()),
        Effect.zipRight(setInitialized(false)),
        Effect.zipRight(setActive(false)),
        Effect.zipRight(snapshot())
      )

    const runtime: SceneRuntime<A> = {
      snapshot,
      initialize,
      update,
      render,
      onEnter: enter,
      onExit: exit,
      cleanup,
    }

    return runtime
  })
export const buildSceneRuntime = createSceneRuntime
