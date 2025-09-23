import { Context, Effect, Layer, Ref, pipe, Match } from 'effect'
import { GameApplication } from './GameApplication'
import type {
  GameApplicationConfig,
  GameApplicationState,
  ApplicationLifecycleState,
  SystemHealthCheck,
} from './types'
import { DEFAULT_GAME_APPLICATION_CONFIG } from './types'
import type {
  GameApplicationInitError,
  GameApplicationRuntimeError,
  GameApplicationStateError,
} from './errors'
import {
  createErrorContext,
  CanvasNotFoundError,
  InvalidStateTransitionError,
  ConfigurationValidationError,
  SystemCommunicationError,
  FrameProcessingError,
  PerformanceDegradationError,
} from './errors'

// 依存サービスの型インポート
import { GameLoopService } from '../domain/game-loop/GameLoopService'
import { SceneManager } from '../domain/scene/SceneManager'
import { ThreeRenderer } from '../infrastructure/rendering/ThreeRenderer'
import { InputService } from '../domain/input/InputService'

/**
 * GameApplicationLive - ゲームアプリケーション統合サービスの実装
 *
 * Issue #176: Application Layer Integration - Game Systems Unity
 *
 * 全システム（ECS, Renderer, Scene, Input, GameLoop）を統合し、
 * 60FPS安定動作とシステム間連携を実現
 */

// Canvas取得のヘルパー関数
const getCanvas = (canvasId: string = 'game-canvas'): Effect.Effect<HTMLCanvasElement, CanvasNotFoundError, never> =>
  Effect.gen(function* () {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null

    if (!canvas) {
      return yield* Effect.fail(
        CanvasNotFoundError({
          context: createErrorContext('GameApplication', 'getCanvas'),
          canvasId,
        })
      )
    }

    if (!(canvas instanceof HTMLCanvasElement)) {
      return yield* Effect.fail(
        CanvasNotFoundError({
          context: createErrorContext('GameApplication', 'getCanvas'),
          canvasId,
          selector: `Element #${canvasId} is not a canvas element`,
        })
      )
    }

    return canvas
  })

// Live実装の作成
const makeGameApplicationLive = Effect.gen(function* () {
  // 依存サービスの取得
  const gameLoopService = yield* GameLoopService
  const sceneManager = yield* SceneManager
  const threeRenderer = yield* ThreeRenderer
  const inputService = yield* InputService

  // アプリケーション状態の管理
  const lifecycleStateRef = yield* Ref.make<ApplicationLifecycleState>('Uninitialized')
  const configRef = yield* Ref.make<GameApplicationConfig>(DEFAULT_GAME_APPLICATION_CONFIG)
  const startTimeRef = yield* Ref.make<number | undefined>(undefined)
  const frameCallbacksRef = yield* Ref.make<Array<() => void>>([])

  // 状態遷移の検証
  const validateStateTransition = (
    current: ApplicationLifecycleState,
    target: ApplicationLifecycleState
  ): Effect.Effect<void, InvalidStateTransitionError, never> => {
    const validTransitions: Record<ApplicationLifecycleState, ApplicationLifecycleState[]> = {
      Uninitialized: ['Initializing'],
      Initializing: ['Initialized', 'Error'],
      Initialized: ['Starting', 'Error'],
      Starting: ['Running', 'Error'],
      Running: ['Pausing', 'Stopping', 'Error'],
      Pausing: ['Paused', 'Error'],
      Paused: ['Resuming', 'Stopping', 'Error'],
      Resuming: ['Running', 'Error'],
      Stopping: ['Stopped', 'Error'],
      Stopped: ['Initializing'],
      Error: ['Initializing', 'Stopping'],
    }

    const allowed = validTransitions[current] || []

    if (!allowed.includes(target)) {
      return Effect.fail(
        InvalidStateTransitionError({
          context: createErrorContext('GameApplication', 'validateStateTransition'),
          currentState: current,
          attemptedState: target,
          validTransitions: allowed,
        })
      )
    }

    return Effect.void
  }

  // 状態の安全な変更
  const transitionToState = (newState: ApplicationLifecycleState) =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(lifecycleStateRef)
      yield* validateStateTransition(currentState, newState)
      yield* Ref.set(lifecycleStateRef, newState)
      yield* Effect.log(`State transition: ${currentState} → ${newState}`)
    })

  // フレーム更新ハンドラー
  const onFrameUpdate = (frameInfo: any) =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(lifecycleStateRef)

      if (currentState !== 'Running') {
        return
      }

      // Scene更新
      yield* sceneManager.update(frameInfo.deltaTime).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            FrameProcessingError({
              context: createErrorContext('GameApplication', 'onFrameUpdate'),
              frameNumber: frameInfo.frameCount,
              deltaTime: frameInfo.deltaTime,
              stage: 'update',
              cause: `Scene update failed: ${error}`,
            })
          )
        )
      )

      // Scene描画
      yield* sceneManager.render().pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            FrameProcessingError({
              context: createErrorContext('GameApplication', 'onFrameUpdate'),
              frameNumber: frameInfo.frameCount,
              deltaTime: frameInfo.deltaTime,
              stage: 'render',
              cause: `Scene render failed: ${error}`,
            })
          )
        )
      )
    })

  // パフォーマンス監視
  const monitorPerformance = Effect.gen(function* () {
    const performanceStats = yield* threeRenderer.getPerformanceStats()

    // FPS低下の検出
    if (performanceStats.fps < 45) {
      yield* Effect.logWarning('Performance degradation detected', {
        fps: performanceStats.fps,
        frameTime: performanceStats.frameTime,
      })

      if (performanceStats.fps < 30) {
        return yield* Effect.fail(
          PerformanceDegradationError({
            context: createErrorContext('GameApplication', 'monitorPerformance'),
            metric: 'fps',
            currentValue: performanceStats.fps,
            thresholdValue: 30,
            severity: 'critical',
          })
        )
      }
    }

    // メモリ使用量の監視
    const totalMemory = performanceStats.memory.geometries + performanceStats.memory.textures
    if (totalMemory > 1500) {
      // 1.5GB閾値
      yield* Effect.logWarning('High memory usage detected', {
        totalMemory,
        geometries: performanceStats.memory.geometries,
        textures: performanceStats.memory.textures,
      })
    }
  })

  return GameApplication.of({
    // アプリケーション初期化
    initialize: (config) =>
      Effect.gen(function* () {
        yield* transitionToState('Initializing')

        // 設定のマージ
        const mergedConfig = { ...DEFAULT_GAME_APPLICATION_CONFIG, ...config }
        yield* Ref.set(configRef, mergedConfig)

        yield* Effect.log('Initializing Game Application...', mergedConfig)

        // Canvas要素の取得
        const canvas = yield* getCanvas()

        // 各サービスの初期化
        yield* Effect.log('Initializing GameLoop...')
        yield* gameLoopService.initialize({
          targetFps: mergedConfig.rendering.targetFps,
          maxFrameSkip: 5,
          enablePerformanceMonitoring: mergedConfig.performance.enableMetrics,
          adaptiveQuality: false,
        })

        yield* Effect.log('Initializing Renderer...')
        yield* threeRenderer.initialize(canvas)

        yield* Effect.log('Configuring Renderer...')
        yield* threeRenderer.configureShadowMap({
          enabled: mergedConfig.rendering.shadowMapping,
        })
        yield* threeRenderer.configureAntialiasing({
          enabled: mergedConfig.rendering.antialiasing,
        })

        if (mergedConfig.rendering.webgl2) {
          const webgl2Supported = yield* threeRenderer.isWebGL2Supported()
          if (webgl2Supported) {
            yield* threeRenderer.enableWebGL2Features()
          }
        }

        // GameLoopにフレーム更新コールバックを登録
        const unregisterCallback = yield* gameLoopService.onFrame(onFrameUpdate)
        yield* Ref.update(frameCallbacksRef, (callbacks) => [...callbacks, unregisterCallback])

        yield* transitionToState('Initialized')
        yield* Effect.log('Game Application initialized successfully')
      }),

    // アプリケーション開始
    start: () =>
      Effect.gen(function* () {
        yield* transitionToState('Starting')

        // 開始時刻の記録
        yield* Ref.set(startTimeRef, Date.now())

        yield* Effect.log('Starting Game Application...')

        // GameLoopの開始
        yield* gameLoopService.start()

        yield* transitionToState('Running')
        yield* Effect.log('Game Application started successfully')
      }),

    // アプリケーション一時停止
    pause: () =>
      Effect.gen(function* () {
        yield* transitionToState('Pausing')
        yield* gameLoopService.pause()
        yield* transitionToState('Paused')
        yield* Effect.log('Game Application paused')
      }),

    // アプリケーション再開
    resume: () =>
      Effect.gen(function* () {
        yield* transitionToState('Resuming')
        yield* gameLoopService.resume()
        yield* transitionToState('Running')
        yield* Effect.log('Game Application resumed')
      }),

    // アプリケーション停止
    stop: () =>
      Effect.gen(function* () {
        yield* transitionToState('Stopping')

        yield* Effect.log('Stopping Game Application...')

        // コールバックの登録解除
        const callbacks = yield* Ref.get(frameCallbacksRef)
        yield* Effect.forEach(callbacks, (unregister) => Effect.sync(unregister))
        yield* Ref.set(frameCallbacksRef, [])

        // 各サービスの停止
        yield* gameLoopService.stop()
        yield* sceneManager.cleanup()
        yield* threeRenderer.dispose()

        yield* transitionToState('Stopped')
        yield* Effect.log('Game Application stopped successfully')
      }),

    // 状態取得
    getState: () =>
      Effect.gen(function* () {
        const lifecycle = yield* Ref.get(lifecycleStateRef)
        const config = yield* Ref.get(configRef)
        const startTime = yield* Ref.get(startTimeRef)

        const gameLoopState = yield* gameLoopService.getState()
        const sceneState = yield* sceneManager.getState()
        const performanceStats = yield* threeRenderer.getPerformanceStats()

        const now = Date.now()
        const uptime = startTime ? now - startTime : 0

        return {
          lifecycle,
          startTime,
          uptime,
          systems: {
            gameLoop: {
              status: gameLoopState.isRunning ? 'running' : 'idle',
              currentFps: gameLoopState.fps,
              targetFps: gameLoopState.targetFPS,
              frameCount: gameLoopState.frameCount,
              totalTime: gameLoopState.totalTime,
            },
            renderer: {
              status: 'running', // ThreeRendererには状態がないため仮定
              memoryUsage: {
                geometries: performanceStats.memory.geometries,
                textures: performanceStats.memory.textures,
                total: performanceStats.memory.geometries + performanceStats.memory.textures,
              },
              renderStats: {
                drawCalls: performanceStats.render.calls,
                triangles: performanceStats.render.triangles,
                frameTime: performanceStats.frameTime,
              },
            },
            scene: {
              status: 'running', // SceneManagerから取得
              currentScene: sceneState.currentScene?.type,
              sceneStack: sceneState.sceneStack.map((scene) => scene.type),
              isTransitioning: sceneState.isTransitioning,
              transitionProgress: sceneState.transitionProgress,
            },
            input: {
              status: 'running', // InputServiceには状態がないため仮定
              connectedDevices: {
                keyboard: true, // 仮の値
                mouse: true,
                gamepad: 0,
              },
              activeInputs: 0,
            },
            ecs: {
              status: 'running', // ECSサービスがないため仮定
              entityCount: 0,
              componentCount: 0,
              systemCount: 0,
              activeQueries: 0,
            },
          },
          performance: {
            overallFps: performanceStats.fps,
            memoryUsage: performanceStats.memory.geometries + performanceStats.memory.textures,
            cpuUsage: 0, // 測定方法を後で実装
            isHealthy: performanceStats.fps > 45,
          },
          config,
          lastError: undefined, // エラー履歴管理を後で実装
        } as GameApplicationState
      }),

    // ライフサイクル状態取得
    getLifecycleState: () => Ref.get(lifecycleStateRef),

    // 手動フレーム実行
    tick: (deltaTime) =>
      Effect.gen(function* () {
        const frameInfo = yield* gameLoopService.tick(deltaTime)
        yield* onFrameUpdate(frameInfo)
      }),

    // 設定更新
    updateConfig: (newConfig) =>
      Effect.gen(function* () {
        yield* Ref.update(configRef, (current) => ({ ...current, ...newConfig }))
        yield* Effect.log('Configuration updated', newConfig)
      }),

    // ヘルスチェック
    healthCheck: () =>
      Effect.gen(function* () {
        const performanceStats = yield* threeRenderer.getPerformanceStats()
        const gameLoopState = yield* gameLoopService.getState()
        const sceneState = yield* sceneManager.getState()

        return {
          gameLoop: {
            status: gameLoopState.fps > 45 ? 'healthy' : 'unhealthy',
            fps: gameLoopState.fps,
            message: gameLoopState.fps < 30 ? 'Low FPS detected' : undefined,
          },
          renderer: {
            status: performanceStats.memory.geometries + performanceStats.memory.textures < 1500 ? 'healthy' : 'unhealthy',
            memory: performanceStats.memory.geometries + performanceStats.memory.textures,
            message: undefined,
          },
          scene: {
            status: 'healthy',
            sceneCount: sceneState.sceneStack.length,
            message: undefined,
          },
          input: {
            status: 'healthy',
            message: undefined,
          },
          ecs: {
            status: 'healthy',
            entityCount: 0,
            message: undefined,
          },
        } as SystemHealthCheck
      }),

    // リセット
    reset: () =>
      Effect.gen(function* () {
        yield* Effect.log('Resetting Game Application...')
        yield* gameLoopService.reset()
        yield* sceneManager.cleanup()
        yield* Ref.set(lifecycleStateRef, 'Uninitialized')
        yield* Ref.set(startTimeRef, undefined)
        yield* Effect.log('Game Application reset completed')
      }),
  })
})

/**
 * GameApplicationLive Layer
 *
 * GameLoopService, SceneManager, ThreeRenderer, InputServiceに依存
 */
export const GameApplicationLive = Layer.effect(GameApplication, makeGameApplicationLive)