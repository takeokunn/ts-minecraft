import { Context, Duration, Effect, HashMap, Layer, Match, pipe, Ref, Schedule } from 'effect'
import type { EventBusService } from '../../infrastructure/events/EventBus'
import { EventBus } from '../../infrastructure/events/EventBus'
import { RendererService } from '../../infrastructure/rendering/RendererService'
import { RendererServiceLive } from '../../infrastructure/rendering/RendererServiceLive'
import { SceneService } from './SceneService'
import {
  ErrorInfo,
  LoadError,
  PlayerState,
  PreloadedResource,
  PreloadError,
  SaveError,
  SaveId,
  SceneType,
  TransitionDuration,
  TransitionEffect,
  TransitionError,
  WorldId,
} from './SceneTypes'

// Using standard EventBusService interface for scene events

// Temporary WorldManager interface
interface WorldManager {
  readonly loadChunks: (worldId: WorldId) => Effect.Effect<void>
  readonly loadEntities: (worldId: WorldId) => Effect.Effect<void>
  readonly loadInventory: (playerState: PlayerState) => Effect.Effect<void>
  readonly generateTerrain: (worldId: WorldId) => Effect.Effect<void>
  readonly initPhysics: () => Effect.Effect<void>
  readonly pauseWorld: (worldId: WorldId) => Effect.Effect<void>
  readonly startWorld: (worldId: WorldId) => Effect.Effect<void>
  readonly serializeWorld: (worldId: WorldId) => Effect.Effect<unknown>
}

const WorldManager = Context.GenericTag<WorldManager>('@minecraft/domain/WorldManager')

// Temporary SaveManager interface
interface SaveManager {
  readonly save: (data: unknown) => Effect.Effect<void>
  readonly load: (saveId: SaveId) => Effect.Effect<unknown>
  readonly autoSave: (worldId: WorldId) => Effect.Effect<void>
}

const SaveManager = Context.GenericTag<SaveManager>('@minecraft/domain/SaveManager')

// Temporary PlayerManager interface
interface PlayerManager {
  readonly serializePlayer: (playerState: PlayerState) => Effect.Effect<unknown>
}

const PlayerManager = Context.GenericTag<PlayerManager>('@minecraft/domain/PlayerManager')

const makeSceneService: Effect.Effect<
  SceneService,
  never,
  EventBusService | RendererService | WorldManager | SaveManager | PlayerManager
> = Effect.gen(function* () {
  const eventBus = yield* EventBus
  const renderEngine = yield* RendererService
  const worldManager = yield* WorldManager
  const saveManager = yield* SaveManager
  const playerManager = yield* PlayerManager

  // 現在のシーン状態
  const currentScene = yield* Ref.make<SceneType>({
    _tag: 'MainMenu',
    selectedOption: undefined,
  })

  // 遷移中フラグ
  const isTransitioning = yield* Ref.make(false)

  // プリロード済みリソース
  const preloadedResources = yield* Ref.make(HashMap.empty<string, PreloadedResource>())

  const getTransitionDuration = (effect: TransitionEffect): TransitionDuration => {
    switch (effect._tag) {
      case 'Fade':
        return effect.duration
      case 'Slide':
        return effect.duration
      case 'Instant':
        return 0 as TransitionDuration
    }
  }

  const executeFadeTransition = (duration: TransitionDuration) =>
    Effect.gen(function* () {
      // フェード効果の実装
      yield* Effect.sleep(Duration.millis(duration))
    })

  const executeSlideTransition = (direction: any, duration: TransitionDuration) =>
    Effect.gen(function* () {
      // スライド効果の実装
      yield* Effect.sleep(Duration.millis(duration))
    })

  const loadWorldWithProgress = (worldId: WorldId, playerState: PlayerState) =>
    Effect.gen(function* () {
      const tasks = [
        { name: 'Loading chunks', weight: 0.4, task: worldManager.loadChunks(worldId) },
        { name: 'Loading entities', weight: 0.2, task: worldManager.loadEntities(worldId) },
        { name: 'Loading inventory', weight: 0.1, task: worldManager.loadInventory(playerState) },
        { name: 'Generating terrain', weight: 0.2, task: worldManager.generateTerrain(worldId) },
        { name: 'Initializing physics', weight: 0.1, task: worldManager.initPhysics() },
      ]

      let totalProgress = 0

      yield* Effect.forEach(
        tasks,
        ({ name, weight, task }) =>
          Effect.gen(function* () {
            yield* eventBus.publish({
              _tag: 'LoadingProgress',
              progress: totalProgress,
              message: name,
            })

            yield* task
            totalProgress += weight

            yield* Ref.update(currentScene, (scene) => {
              if (scene._tag === 'Loading') {
                return {
                  ...scene,
                  progress: totalProgress,
                }
              }
              return scene
            })
          }),
        { discard: true }
      )
    })

  const transitionTo = (
    scene: SceneType,
    effect: TransitionEffect = { _tag: 'Fade', duration: 500 as TransitionDuration }
  ): Effect.Effect<void, TransitionError, never> =>
    Effect.gen(function* () {
      // 遷移中チェック
      const transitioning = yield* Ref.get(isTransitioning)
      if (transitioning) {
        return yield* Effect.fail({
          _tag: 'TransitionInProgressError' as const,
          message: 'Another scene transition is already in progress',
        })
      }

      yield* Ref.set(isTransitioning, true)

      // 遷移処理をensureingで包み、必ずフラグをリセット
      yield* Effect.ensuring(
        Effect.gen(function* () {
          const fromScene = yield* Ref.get(currentScene)

          // イベント発行
          yield* eventBus.publish({
            _tag: 'TransitionStarted',
            from: fromScene,
            to: scene,
            duration: getTransitionDuration(effect),
          })

          // シーンごとのクリーンアップ処理
          yield* pipe(
            fromScene,
            Match.value,
            Match.when({ _tag: 'GameWorld' }, (gameScene) =>
              Effect.gen(function* () {
                const typedScene = gameScene as any
                yield* saveManager.autoSave(typedScene.worldId)
                yield* worldManager.pauseWorld(typedScene.worldId)
              })
            ),
            Match.orElse(() => Effect.void)
          )

          // トランジション効果の実行
          yield* pipe(
            effect,
            Match.value,
            Match.when({ _tag: 'Fade' }, (fadeEffect) => executeFadeTransition(fadeEffect.duration)),
            Match.when({ _tag: 'Slide' }, (slideEffect) =>
              executeSlideTransition(slideEffect.direction, slideEffect.duration)
            ),
            Match.when({ _tag: 'Instant' }, () => Effect.void),
            Match.orElse(() => Effect.void)
          )

          // 新しいシーンの初期化
          yield* pipe(
            scene,
            Match.value,
            Match.when({ _tag: 'GameWorld' }, (gameScene) =>
              Effect.gen(function* () {
                const typedScene = gameScene as any
                // ローディング画面を表示
                yield* Ref.set(currentScene, {
                  _tag: 'Loading',
                  targetScene: scene,
                  progress: 0,
                })

                // ワールドロード
                yield* loadWorldWithProgress(typedScene.worldId, typedScene.playerState)

                // ワールド開始
                yield* worldManager.startWorld(typedScene.worldId)
              })
            ),
            Match.when({ _tag: 'MainMenu' }, () =>
              Effect.gen(function* () {
                yield* renderEngine.setClearColor(0x000000, 1)
                // メインメニューの表示処理
              })
            ),
            Match.when({ _tag: 'Settings' }, () => Effect.void),
            Match.when({ _tag: 'Loading' }, () => Effect.void),
            Match.when({ _tag: 'Error' }, (errorScene) =>
              Effect.gen(function* () {
                const typedScene = errorScene as any
                // エラー画面の表示処理
                if (!typedScene.recoverable) {
                  yield* Effect.logError('Unrecoverable error', typedScene.error)
                }
              })
            ),
            Match.orElse(() => Effect.void)
          )

          // 遷移完了
          yield* Ref.set(currentScene, scene)

          // イベント発行
          yield* eventBus.publish({
            _tag: 'TransitionCompleted',
            scene,
          })
        }),
        // 必ずisTransitioningをfalseにリセット
        Ref.set(isTransitioning, false)
      )
    })

  const getCurrentScene = (): Effect.Effect<SceneType, never> => Ref.get(currentScene)

  const saveState = (): Effect.Effect<void, SaveError> =>
    Effect.gen(function* () {
      const scene = yield* Ref.get(currentScene)

      const saveData = yield* pipe(
        scene,
        Match.value,
        Match.when({ _tag: 'GameWorld' }, (gameScene) =>
          Effect.gen(function* () {
            const typedScene = gameScene as any
            const worldData = yield* worldManager.serializeWorld(typedScene.worldId)
            const playerData = yield* playerManager.serializePlayer(typedScene.playerState)
            return {
              scene: 'GameWorld',
              worldData,
              playerData,
              timestamp: Date.now(),
            }
          })
        ),
        Match.orElse(() =>
          Effect.succeed({
            scene: scene._tag,
            timestamp: Date.now(),
          })
        )
      )

      yield* saveManager.save(saveData).pipe(
        Effect.mapError(
          () =>
            ({
              _tag: 'SaveFailedError',
              message: 'Failed to save game state',
            }) as SaveError
        )
      )

      yield* eventBus.publish({
        _tag: 'StateSnapshot',
        scene,
        timestamp: Date.now(),
      })
    })

  const loadState = (saveId: SaveId): Effect.Effect<void, LoadError> =>
    Effect.gen(function* () {
      const saveData = yield* saveManager.load(saveId).pipe(
        Effect.mapError(
          () =>
            ({
              _tag: 'SaveNotFoundError',
              saveId,
              message: `Save file ${saveId} not found`,
            }) as LoadError
        )
      )

      // セーブデータから適切なシーンを復元
      // この実装は簡略化されており、実際にはより詳細な復元処理が必要
      yield* transitionTo({
        _tag: 'MainMenu',
        selectedOption: undefined,
      }).pipe(
        Effect.mapError(
          () =>
            ({
              _tag: 'LoadFailedError',
              saveId,
              message: 'Failed to restore scene from save data',
            }) as LoadError
        )
      )
    })

  const isRecoverableError = (error: unknown): Effect.Effect<boolean> =>
    Effect.succeed(
      error instanceof Error &&
        (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('temporary'))
    )

  const handleError = (error: unknown): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const errorInfo: ErrorInfo = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now(),
      }

      // エラーの種類に応じて回復可能か判定
      const recoverable = yield* isRecoverableError(error)

      yield* transitionTo(
        {
          _tag: 'Error',
          error: errorInfo,
          recoverable,
        },
        { _tag: 'Instant' }
      ).pipe(Effect.orDie)

      if (recoverable) {
        // 自動リトライのスケジューリング
        yield* Effect.schedule(
          transitionTo({
            _tag: 'MainMenu',
            selectedOption: undefined,
          }),
          Schedule.exponential(Duration.seconds(1))
        ).pipe(
          Effect.fork // バックグラウンドで実行
        )
      }
    })

  const preloadScene = (scene: SceneType): Effect.Effect<void, PreloadError> =>
    Effect.gen(function* () {
      // シーンに必要なリソースのプリロード
      const resources = pipe(
        scene,
        Match.value,
        Match.when({ _tag: 'GameWorld' }, () => ['textures/blocks.png', 'models/player.obj', 'sounds/ambient.mp3']),
        Match.when({ _tag: 'MainMenu' }, () => ['textures/menu-bg.png', 'sounds/menu-music.mp3']),
        Match.orElse(() => [] as string[])
      )

      if (resources.length === 0) {
        return
      }

      // リソースのロード処理（実装は簡略化）
      yield* Effect.forEach(
        resources,
        (resourcePath) =>
          Effect.gen(function* () {
            const resource: PreloadedResource = {
              id: resourcePath,
              type: resourcePath.endsWith('.png')
                ? 'texture'
                : resourcePath.endsWith('.obj')
                  ? 'model'
                  : resourcePath.endsWith('.mp3')
                    ? 'sound'
                    : 'data',
              data: null, // 実際のデータロード処理
              size: 0,
              loadedAt: Date.now(),
            }

            yield* Ref.update(preloadedResources, (map) => HashMap.set(map, resourcePath, resource))
          }),
        { discard: true }
      ).pipe(
        Effect.mapError(
          () =>
            ({
              _tag: 'PreloadFailedError',
              message: 'Failed to preload scene resources',
              resources,
            }) as PreloadError
        )
      )
    })

  return {
    transitionTo,
    getCurrentScene,
    saveState,
    loadState,
    handleError,
    preloadScene,
  } satisfies SceneService
})

// Mock implementations for testing
const EventBusLive = Layer.succeed(EventBus, {
  publish: <T>() => Effect.void,
  subscribe: <T>() =>
    Effect.succeed({
      close: () => Effect.void,
    }),
})

const WorldManagerLive = Layer.succeed(WorldManager, {
  loadChunks: () => Effect.void,
  loadEntities: () => Effect.void,
  loadInventory: () => Effect.void,
  generateTerrain: () => Effect.void,
  initPhysics: () => Effect.void,
  pauseWorld: () => Effect.void,
  startWorld: () => Effect.void,
  serializeWorld: () => Effect.succeed({}),
})

const SaveManagerLive = Layer.succeed(SaveManager, {
  save: () => Effect.void,
  load: () => Effect.succeed({}),
  autoSave: () => Effect.void,
})

const PlayerManagerLive = Layer.succeed(PlayerManager, {
  serializePlayer: () => Effect.succeed({}),
})

export const SceneServiceLive = Layer.effect(SceneService, makeSceneService).pipe(
  Layer.provide(EventBusLive),
  Layer.provide(RendererServiceLive),
  Layer.provide(WorldManagerLive),
  Layer.provide(SaveManagerLive),
  Layer.provide(PlayerManagerLive)
)
