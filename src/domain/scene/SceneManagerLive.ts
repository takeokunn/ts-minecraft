import { Effect, Layer, Ref } from 'effect'
import { Scene, SceneTransition, SceneTransitionError, SceneType } from './Scene'
import { SceneManager, SceneManagerState, processSceneType } from './SceneManager'

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
              const { MainMenuScene } = yield* Effect.promise(() => import('./scenes/MainMenuScene'))
              return yield* Scene.pipe(Effect.provide(MainMenuScene))
            }),
          Game: () =>
            Effect.gen(function* () {
              const { GameScene } = yield* Effect.promise(() => import('./scenes/GameScene'))
              return yield* Scene.pipe(Effect.provide(GameScene))
            }),
          Loading: () =>
            Effect.gen(function* () {
              const { LoadingScene } = yield* Effect.promise(() => import('./scenes/LoadingScene'))
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

        if (currentActiveScene) {
          yield* Effect.logInfo('現在のシーンをクリーンアップ中...')
          yield* currentActiveScene.onExit()
          yield* Effect.catchAll(currentActiveScene.cleanup(), (error) =>
            Effect.logError(`シーンクリーンアップエラー: ${error}`)
          )
          yield* Ref.set(activeSceneRef, undefined)
        }
      })

    // シーン遷移処理
    const performTransition = (
      targetScene: Scene,
      transition: SceneTransition
    ): Effect.Effect<void, SceneTransitionError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

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

        if (initializeResult._tag === 'Left') {
          // エラー時の復旧処理
          yield* Ref.update(stateRef, (s) => ({ ...s, isTransitioning: false, transitionProgress: 0 }))
          yield* Effect.logError(`シーン遷移エラー: ${initializeResult.left}`)

          return yield* Effect.fail(
            SceneTransitionError({
              message: `Failed to transition to ${transition.to}: ${initializeResult.left.message || JSON.stringify(initializeResult.left)}`,
              currentScene: state.currentScene?.type,
              targetScene: transition.to,
            })
          )
        }

        // 状態更新
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          currentScene: targetScene.data,
          isTransitioning: false,
          transitionProgress: 1,
        }))

        yield* Ref.set(activeSceneRef, targetScene)
        yield* Effect.logInfo(`シーン遷移完了: ${transition.to}`)
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

          if (currentState.isTransitioning) {
            return yield* Effect.fail(
              SceneTransitionError({
                message: 'Scene transition already in progress',
                currentScene: currentState.currentScene?.type,
                targetScene: sceneType,
              })
            )
          }

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

          if (currentState.isTransitioning) {
            return yield* Effect.fail(
              SceneTransitionError({
                message: 'Cannot push scene during transition',
                currentScene: currentState.currentScene?.type,
                targetScene: sceneType,
              })
            )
          }

          // 現在のシーンをスタックにプッシュ
          if (currentState.currentScene) {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              sceneStack: [...s.sceneStack, s.currentScene!],
            }))
          }

          // 新しいシーンに遷移
          const newScene = yield* createScene(sceneType)
          yield* performTransition(newScene, { from: currentState.currentScene?.type, to: sceneType })
        }),

      popScene: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)

          if (currentState.sceneStack.length === 0) {
            return yield* Effect.fail(
              SceneTransitionError({
                message: 'No scene in stack to pop',
                currentScene: currentState.currentScene?.type,
                targetScene: 'MainMenu', // デフォルトでMainMenuに戻る
              })
            )
          }

          const previousScene = currentState.sceneStack[currentState.sceneStack.length - 1]

          if (!previousScene) {
            return yield* Effect.fail(
              SceneTransitionError({
                message: 'Previous scene is undefined',
                currentScene: currentState.currentScene?.type,
                targetScene: 'MainMenu',
              })
            )
          }

          // スタックから削除
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            sceneStack: s.sceneStack.slice(0, -1),
          }))

          // 前のシーンに遷移
          const newScene = yield* createScene(previousScene.type)
          yield* performTransition(newScene, {
            from: currentState.currentScene?.type,
            to: previousScene.type,
          })
        }),

      createScene,

      update: (deltaTime) =>
        Effect.gen(function* () {
          const activeScene = yield* Ref.get(activeSceneRef)
          if (activeScene) {
            yield* activeScene.update(deltaTime)
          }
        }),

      render: () =>
        Effect.gen(function* () {
          const activeScene = yield* Ref.get(activeSceneRef)
          if (activeScene) {
            yield* activeScene.render()
          }
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
