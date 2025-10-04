import { Effect, Layer, Match, Option, Ref, Schema, pipe } from 'effect'
import { SceneService } from '../service'
import {
  ActiveScene,
  PreloadError,
  SceneState,
  SceneState as Scenes,
  TransitionEffect,
  TransitionError as TransitionErrorADT,
} from '../types'
import { SceneManager, SceneManagerState, SceneManagerStateSchema, sceneManagerState } from './service'

const toActiveScene = (scene: SceneState) =>
  Match.value(scene).pipe(
    Match.tag('Loading', () => Option.none<ActiveScene>()),
    Match.tag('MainMenu', (value) => Option.some<ActiveScene>(value)),
    Match.tag('GameWorld', (value) => Option.some<ActiveScene>(value)),
    Match.tag('Settings', (value) => Option.some<ActiveScene>(value)),
    Match.tag('Error', (value) => Option.some<ActiveScene>(value)),
    Match.exhaustive
  )

const ensureTransitionable =
  (
    requested: ActiveScene
  ): ((state: SceneManagerState) => Effect.Effect<readonly [SceneManagerState, ActiveScene], TransitionErrorADT>) =>
  (state) =>
    Match.value(state.isTransitioning).pipe(
      Match.when(true, () =>
        Effect.fail(
          TransitionErrorADT.TransitionInProgress({
            currentScene: Option.some(state.current),
            requested,
          })
        )
      ),
      Match.orElse(() =>
        Effect.succeed<readonly [SceneManagerState, ActiveScene]>([
          {
            ...state,
            isTransitioning: true,
          },
          requested,
        ])
      )
    )

const ensurePopTarget = (
  state: SceneManagerState
): Effect.Effect<readonly [SceneManagerState, ActiveScene], TransitionErrorADT> =>
  Match.value(state.isTransitioning).pipe(
    Match.when(true, () =>
      Effect.fail(
        TransitionErrorADT.TransitionInProgress({
          currentScene: Option.some(state.current),
          requested: state.current,
        })
      )
    ),
    Match.orElse(() =>
      pipe(
        state.stack.at(-1),
        Option.fromNullable,
        Option.match({
          onNone: () =>
            Effect.fail(
              TransitionErrorADT.InvalidScene({
                requested: state.current,
                reason: 'シーンスタックが空です',
              })
            ),
          onSome: (target) =>
            Effect.succeed<readonly [SceneManagerState, ActiveScene]>([
              {
                ...state,
                isTransitioning: true,
              },
              target,
            ]),
        })
      )
    )
  )

const withTransition = <A>(
  ref: Ref.Ref<SceneManagerState>,
  resolver: (state: SceneManagerState) => Effect.Effect<readonly [SceneManagerState, ActiveScene], TransitionErrorADT>,
  use: (state: SceneManagerState, target: ActiveScene) => Effect.Effect<A, TransitionErrorADT>
): Effect.Effect<A, TransitionErrorADT> =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const current = yield* Ref.get(ref)
      const [updated, target] = yield* resolver(current)
      yield* Ref.set(ref, updated)
      return { state: updated, target }
    }),
    ({ state, target }) => use(state, target),
    ({ state }) => Ref.update(ref, (current) => ({ ...current, isTransitioning: false }))
  )

const appendHistory = (state: SceneManagerState, next: SceneState): SceneManagerState => ({
  ...state,
  current: next,
  history: [...state.history, next],
})

const pushStack = (stack: ReadonlyArray<ActiveScene>, previous: Option.Option<ActiveScene>) =>
  Option.match(previous, {
    onNone: () => stack,
    onSome: (scene) => [...stack, scene],
  })

const dropLast = (stack: ReadonlyArray<ActiveScene>) => stack.slice(0, Math.max(0, stack.length - 1))

export const SceneManagerLive = Layer.effect(
  SceneManager,
  Effect.gen(function* () {
    const sceneService = yield* SceneService
    const initialScene = yield* sceneService.current()
    const initialState = yield* Schema.decode(SceneManagerStateSchema)(
      sceneManagerState.make({ current: initialScene })
    )

    const stateRef = yield* Ref.make(initialState)

    const transition = (scene: ActiveScene, effect?: TransitionEffect): Effect.Effect<SceneState, TransitionErrorADT> =>
      withTransition(stateRef, ensureTransitionable(scene), (_, target) =>
        Effect.gen(function* () {
          const nextScene = yield* sceneService.transitionTo(target, effect)
          yield* Ref.update(stateRef, (state) => appendHistory({ ...state, isTransitioning: true }, nextScene))
          return nextScene
        })
      )

    const push = (scene: ActiveScene, effect?: TransitionEffect): Effect.Effect<SceneState, TransitionErrorADT> =>
      withTransition(stateRef, ensureTransitionable(scene), (lockedState, target) =>
        Effect.gen(function* () {
          const active = toActiveScene(lockedState.current)
          const nextScene = yield* sceneService.transitionTo(target, effect)
          yield* Ref.update(stateRef, (state) => ({
            ...appendHistory(state, nextScene),
            stack: pushStack(state.stack, active),
          }))
          return nextScene
        })
      )

    const pop = (effect?: TransitionEffect): Effect.Effect<SceneState, TransitionErrorADT> =>
      withTransition(stateRef, ensurePopTarget, (_, target) =>
        Effect.gen(function* () {
          const nextScene = yield* sceneService.transitionTo(target, effect)
          yield* Ref.update(stateRef, (state) => ({
            ...appendHistory(state, nextScene),
            stack: dropLast(state.stack),
          }))
          return nextScene
        })
      )

    const reset = (scene: ActiveScene = Scenes.MainMenu()): Effect.Effect<SceneState, TransitionErrorADT> =>
      withTransition(stateRef, ensureTransitionable(scene), () =>
        Effect.gen(function* () {
          const nextScene = yield* sceneService.transitionTo(scene, TransitionEffect.Instant({}))
          yield* Ref.set(stateRef, sceneManagerState.make({ current: nextScene }))
          return nextScene
        })
      )

    const preload = (scene: ActiveScene): Effect.Effect<void, PreloadError> => sceneService.preload(scene)

    return SceneManager.of({
      current: () => Ref.get(stateRef).pipe(Effect.map((state) => state.current)),
      state: () => Ref.get(stateRef),
      transitionTo: transition,
      push,
      pop,
      preload,
      reset,
      history: () => Ref.get(stateRef).pipe(Effect.map((state) => state.history)),
    })
  })
)
