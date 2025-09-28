import { Effect, Either, Layer, Match, Option, Ref, pipe } from 'effect'
import { Scene, SceneTransition, SceneTransitionError, SceneType } from '../scenes/base'
import { SceneManager, SceneManagerState, processSceneType } from './service'

/**
 * 遷移中かチェックするヘルパー
 */
const ensureNotTransitioning = (
  state: SceneManagerState,
  targetScene: SceneType
): Effect.Effect<void, SceneTransitionError> =>
  pipe(
    state.isTransitioning,
    Match.value,
    Match.when(true, () =>
      Effect.fail(
        SceneTransitionError({
          message: 'Scene transition already in progress',
          currentScene: state.currentScene?.type,
          targetScene,
        })
      )
    ),
    Match.orElse(() => Effect.succeed(undefined))
  )

/**
 * スタックが空でないことを確認
 */
const ensureStackNotEmpty = (state: SceneManagerState): Effect.Effect<SceneType, SceneTransitionError> =>
  pipe(
    state.sceneStack.length,
    Match.value,
    Match.when(0, () =>
      Effect.fail(
        SceneTransitionError({
          message: 'No scene in stack to pop',
          currentScene: state.currentScene?.type,
          targetScene: 'MainMenu',
        })
      )
    ),
    Match.orElse(() => {
      const previousScene = state.sceneStack[state.sceneStack.length - 1]
      return pipe(
        Option.fromNullable(previousScene),
        Option.match({
          onNone: () =>
            Effect.fail(
              SceneTransitionError({
                message: 'Previous scene is undefined',
                currentScene: state.currentScene?.type,
                targetScene: 'MainMenu',
              })
            ),
          onSome: (scene) => Effect.succeed(scene.type),
        })
      )
    })
  )

// SceneManagerLive実装
export const SceneManagerLive = Layer.effect(
  SceneManager,
  Effect.gen(function* () {
    // 状態管理用のRef
    const stateRef = yield* Ref.make<SceneManagerState>({
      currentScene: undefined,
      sceneStack: [],
      isTransitioning: false,
      transitionProgress: 0,
    })

    // アクティブなシーンインスタンス管理
    const activeSceneRef = yield* Ref.make<Scene | undefined>(undefined)

    // シーンファクトリー: Match.valueを使った型安全なシーン生成
    const createScene = (sceneType: SceneType): Effect.Effect<Scene, SceneTransitionError> =>
      Effect.gen(function* () {
        const sceneFactory: Effect.Effect<Scene, SceneTransitionError> = processSceneType(sceneType, {
          MainMenu: () =>
            Effect.gen(function* () {
              const { MainMenuScene } = yield* Effect.promise(() => import('../scenes/main_menu'))
              return yield* Scene.pipe(Effect.provide(MainMenuScene))
            }),
          Game: () =>
            Effect.gen(function* () {
              const { GameScene } = yield* Effect.promise(() => import('../scenes/game'))
              return yield* Scene.pipe(Effect.provide(GameScene))
            }),
          Loading: () =>
            Effect.gen(function* () {
              const { LoadingScene } = yield* Effect.promise(() => import('../scenes/loading'))
              return yield* Scene.pipe(Effect.provide(LoadingScene))
            }),
          Pause: (): Effect.Effect<Scene, SceneTransitionError> =>
            Effect.fail(
              SceneTransitionError({
                message: 'Pause scene not implemented yet',
                targetScene: sceneType,
              })
            ),
          Settings: (): Effect.Effect<Scene, SceneTransitionError> =>
            Effect.fail(
              SceneTransitionError({
                message: 'Settings scene not implemented yet',
                targetScene: sceneType,
              })
            ),
        })

        return yield* sceneFactory
      })

    // シーンクリーンアップ処理
    const cleanupCurrentScene = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const currentActiveScene = yield* Ref.get(activeSceneRef)

        yield* pipe(
          Option.fromNullable(currentActiveScene),
          Option.match({
            onNone: () => Effect.succeed(undefined),
            onSome: (scene) =>
              Effect.gen(function* () {
                yield* Effect.logInfo('現在のシーンをクリーンアップ中...')
                yield* scene.onExit()
                yield* Effect.catchAll(scene.cleanup(), (error) =>
                  Effect.logError(`シーンクリーンアップエラー: ${error}`)
                )
                yield* Ref.set(activeSceneRef, undefined)
              }),
          })
        )
      })

    // シーン遷移処理
    const performTransition = (
      targetScene: Scene,
      transition: SceneTransition
    ): Effect.Effect<void, SceneTransitionError> =>
      Effect.gen(function* () {
        // 遷移開始
        yield* Ref.update(stateRef, (s) => ({ ...s, isTransitioning: true, transitionProgress: 0 }))

        // 現在のシーンの終了処理
        yield* cleanupCurrentScene()

        // 新しいシーンの初期化
        yield* Effect.logInfo(`シーン遷移: ${transition.from || 'none'} → ${transition.to}`)

        const initializeResult = yield* Effect.either(
          Effect.gen(function* () {
            yield* targetScene.initialize()
            yield* targetScene.onEnter()
          })
        )

        yield* pipe(
          initializeResult,
          Either.match({
            onLeft: (error) =>
              Effect.gen(function* () {
                // エラー時の復旧処理
                yield* Ref.update(stateRef, (s) => ({ ...s, isTransitioning: false, transitionProgress: 0 }))
                yield* Effect.logError(`シーン遷移エラー: ${error}`)

                const state = yield* Ref.get(stateRef)
                return yield* Effect.fail(
                  SceneTransitionError({
                    message: `Failed to transition to ${transition.to}: ${error.message || JSON.stringify(error)}`,
                    currentScene: state.currentScene?.type,
                    targetScene: transition.to,
                  })
                )
              }),
            onRight: () =>
              Effect.gen(function* () {
                // 状態更新
                yield* Ref.update(stateRef, (s) => ({
                  ...s,
                  currentScene: targetScene.data,
                  isTransitioning: false,
                  transitionProgress: 1,
                }))

                yield* Ref.set(activeSceneRef, targetScene)
                yield* Effect.logInfo(`シーン遷移完了: ${transition.to}`)
              }),
          })
        )
      })

    return SceneManager.of({
      getCurrentScene: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.currentScene
        }),

      getState: () => Ref.get(stateRef),

      transitionTo: (sceneType, transition) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)

          yield* ensureNotTransitioning(currentState, sceneType)

          const transitionData: SceneTransition = {
            from: currentState.currentScene?.type,
            to: sceneType,
            duration: transition?.duration ?? 500,
            fadeType: transition?.fadeType ?? 'fade',
          }

          const newScene = yield* createScene(sceneType)
          yield* performTransition(newScene, transitionData)
        }),

      pushScene: (sceneType) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)

          yield* ensureNotTransitioning(currentState, sceneType)

          // 現在のシーンをスタックにプッシュ
          yield* pipe(
            Option.fromNullable(currentState.currentScene),
            Option.match({
              onNone: () => Effect.succeed(undefined),
              onSome: () =>
                Ref.update(stateRef, (s) => ({
                  ...s,
                  sceneStack: [...s.sceneStack, s.currentScene!],
                })),
            })
          )

          // 新しいシーンに遷移
          const newScene = yield* createScene(sceneType)
          yield* performTransition(newScene, { from: currentState.currentScene?.type, to: sceneType })
        }),

      popScene: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)
          const previousSceneType = yield* ensureStackNotEmpty(currentState)

          // スタックから削除
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            sceneStack: s.sceneStack.slice(0, -1),
          }))

          // 前のシーンに遷移
          const newScene = yield* createScene(previousSceneType)
          yield* performTransition(newScene, {
            from: currentState.currentScene?.type,
            to: previousSceneType,
          })
        }),

      createScene,

      update: (deltaTime) =>
        Effect.gen(function* () {
          const activeScene = yield* Ref.get(activeSceneRef)
          yield* pipe(
            Option.fromNullable(activeScene),
            Option.match({
              onNone: () => Effect.succeed(undefined),
              onSome: (scene) => scene.update(deltaTime),
            })
          )
        }),

      render: () =>
        Effect.gen(function* () {
          const activeScene = yield* Ref.get(activeSceneRef)
          yield* pipe(
            Option.fromNullable(activeScene),
            Option.match({
              onNone: () => Effect.succeed(undefined),
              onSome: (scene) => scene.render(),
            })
          )
        }),

      cleanup: () =>
        Effect.gen(function* () {
          yield* cleanupCurrentScene()
          yield* Ref.set(stateRef, {
            currentScene: undefined,
            sceneStack: [],
            isTransitioning: false,
            transitionProgress: 0,
          })
          yield* Effect.logInfo('SceneManager cleanup completed')
        }),
    })
  })
)
