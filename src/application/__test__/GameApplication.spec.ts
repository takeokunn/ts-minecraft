import { describe, it, expect } from 'vitest'
import { Effect, Layer, Ref } from 'effect'
import { GameApplication } from '../GameApplication'
import { GameApplicationLive } from '../GameApplicationLive'
import { DEFAULT_GAME_APPLICATION_CONFIG } from '../types'

// 依存サービスのMock実装
import { GameLoopService } from '../../domain/game-loop/GameLoopService'
import { SceneManager } from '../../domain/scene/SceneManager'
import { ThreeRenderer } from '../../infrastructure/rendering/ThreeRenderer'
import { InputService } from '../../domain/input/InputService'

/**
 * GameApplication テストスイート
 *
 * Issue #176: Application Layer Integration
 *
 * テスト項目:
 * - アプリケーションライフサイクル管理
 * - システム間連携
 * - エラーハンドリング
 * - パフォーマンス監視
 * - 設定管理
 */

// ===== Mock実装 =====

const createMockGameLoopService = () =>
  Layer.succeed(
    GameLoopService,
    GameLoopService.of({
      initialize: () => Effect.log('Mock GameLoop initialized').pipe(Effect.asVoid),
      start: () => Effect.log('Mock GameLoop started').pipe(Effect.asVoid),
      pause: () => Effect.log('Mock GameLoop paused').pipe(Effect.asVoid),
      resume: () => Effect.log('Mock GameLoop resumed').pipe(Effect.asVoid),
      stop: () => Effect.log('Mock GameLoop stopped').pipe(Effect.asVoid),
      onFrame: () => Effect.succeed(() => {}),
      getState: () => Effect.succeed('running' as const),
      getPerformanceMetrics: () =>
        Effect.succeed({
          fps: 60,
          averageFrameTime: 16.67,
          minFrameTime: 14.0,
          maxFrameTime: 20.0,
          frameTimeStdDev: 2.0,
          totalFrames: 1000,
          droppedFrames: 0,
        }),
      tick: () =>
        Effect.succeed({
          frameCount: 1001,
          deltaTime: 16.67,
          totalTime: 16683.67,
          fps: 60,
        }),
      updateConfig: () => Effect.void,
      reset: () => Effect.log('Mock GameLoop reset').pipe(Effect.asVoid),
    })
  )

const createMockSceneManager = () =>
  Layer.succeed(
    SceneManager,
    SceneManager.of({
      getCurrentScene: () => Effect.succeed(undefined),
      getState: () =>
        Effect.succeed({
          currentScene: undefined,
          sceneStack: [],
          isTransitioning: false,
          transitionProgress: 0,
        }),
      transitionTo: () => Effect.log('Mock Scene transition').pipe(Effect.asVoid),
      pushScene: () => Effect.log('Mock Scene push').pipe(Effect.asVoid),
      popScene: () => Effect.log('Mock Scene pop').pipe(Effect.asVoid),
      createScene: () => Effect.fail('Mock Scene creation not implemented' as any),
      update: () => Effect.log('Mock Scene update').pipe(Effect.asVoid),
      render: () => Effect.log('Mock Scene render').pipe(Effect.asVoid),
      cleanup: () => Effect.log('Mock Scene cleanup').pipe(Effect.asVoid),
    })
  )

const createMockThreeRenderer = () =>
  Layer.succeed(
    ThreeRenderer,
    ThreeRenderer.of({
      initialize: () => Effect.log('Mock Renderer initialized').pipe(Effect.asVoid),
      render: () => Effect.log('Mock Renderer render').pipe(Effect.asVoid),
      resize: () => Effect.void,
      enableWebGL2Features: () => Effect.log('Mock WebGL2 enabled').pipe(Effect.asVoid),
      configureShadowMap: () => Effect.void,
      configureAntialiasing: () => Effect.void,
      setupPostprocessing: () => Effect.log('Mock Postprocessing setup').pipe(Effect.asVoid),
      getPerformanceStats: () =>
        Effect.succeed({
          fps: 60,
          frameTime: 16.67,
          memory: {
            geometries: 100,
            textures: 200,
          },
          render: {
            calls: 50,
            triangles: 10000,
          },
        }),
      getRenderer: () => Effect.succeed(null),
      isWebGL2Supported: () => Effect.succeed(true),
      dispose: () => Effect.log('Mock Renderer disposed').pipe(Effect.asVoid),
    })
  )

const createMockInputService = () =>
  Layer.succeed(
    InputService,
    InputService.of({
      isKeyPressed: () => Effect.succeed(false),
      isMousePressed: () => Effect.succeed(false),
      getMouseDelta: () =>
        Effect.succeed({
          deltaX: 0,
          deltaY: 0,
          timestamp: Date.now(),
        }),
      registerHandler: () => Effect.log('Mock Input handler registered').pipe(Effect.asVoid),
    })
  )

const MockLayer = Layer.mergeAll(
  createMockGameLoopService(),
  createMockSceneManager(),
  createMockThreeRenderer(),
  createMockInputService(),
  GameApplicationLive
)

// ===== テスト用ヘルパー =====

const createMockCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.id = 'game-canvas'
  document.body.appendChild(canvas)
  return canvas
}

const runTestWithMockCanvas = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const canvas = createMockCanvas()
    try {
      return yield* effect
    } finally {
      document.body.removeChild(canvas)
    }
  })

// ===== テストケース =====

describe('GameApplication', () => {
  describe('基本ライフサイクル', () => {
    it('初期化 → 開始 → 停止のライフサイクルが正常に動作する', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        // 初期化
        yield* gameApp.initialize()
        const stateAfterInit = yield* gameApp.getLifecycleState()
        expect(stateAfterInit).toBe('Initialized')

        // 開始
        yield* gameApp.start()
        const stateAfterStart = yield* gameApp.getLifecycleState()
        expect(stateAfterStart).toBe('Running')

        // 停止
        yield* gameApp.stop()
        const stateAfterStop = yield* gameApp.getLifecycleState()
        expect(stateAfterStop).toBe('Stopped')
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })

    it('一時停止と再開が正常に動作する', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        yield* gameApp.initialize()
        yield* gameApp.start()

        // 一時停止
        yield* gameApp.pause()
        const stateAfterPause = yield* gameApp.getLifecycleState()
        expect(stateAfterPause).toBe('Paused')

        // 再開
        yield* gameApp.resume()
        const stateAfterResume = yield* gameApp.getLifecycleState()
        expect(stateAfterResume).toBe('Running')
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })

  describe('設定管理', () => {
    it('カスタム設定で初期化できる', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        const customConfig = {
          rendering: {
            targetFps: 30,
            enableVSync: false,
          },
        }

        yield* gameApp.initialize(customConfig)
        const state = yield* gameApp.getState()

        expect(state.config.rendering.targetFps).toBe(30)
        expect(state.config.rendering.enableVSync).toBe(false)
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })

    it('実行時に設定を更新できる', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        yield* gameApp.initialize()

        const newConfig = {
          performance: {
            enableMetrics: false,
          },
        }

        yield* gameApp.updateConfig(newConfig)
        const state = yield* gameApp.getState()

        expect(state.config.performance.enableMetrics).toBe(false)
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })

  describe('状態管理', () => {
    it('アプリケーション状態を正しく取得できる', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        yield* gameApp.initialize()
        yield* gameApp.start()

        const state = yield* gameApp.getState()

        expect(state.lifecycle).toBe('Running')
        expect(state.systems.gameLoop.status).toBe('running')
        expect(state.systems.renderer.status).toBe('running')
        expect(state.performance.isHealthy).toBe(true)
        expect(state.startTime).toBeDefined()
        expect(state.uptime).toBeGreaterThan(0)
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })

  describe('ヘルスチェック', () => {
    it('システムヘルスチェックが正常に動作する', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        yield* gameApp.initialize()
        yield* gameApp.start()

        const healthCheck = yield* gameApp.healthCheck()

        expect(healthCheck.gameLoop.status).toBe('healthy')
        expect(healthCheck.renderer.status).toBe('healthy')
        expect(healthCheck.scene.status).toBe('healthy')
        expect(healthCheck.input.status).toBe('healthy')
        expect(healthCheck.ecs.status).toBe('healthy')
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })

  describe('手動フレーム実行', () => {
    it('手動でフレームを実行できる', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        yield* gameApp.initialize()

        // フレームを手動実行
        yield* gameApp.tick(16.67)

        // エラーが発生しないことを確認
        expect(true).toBe(true)
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })

  describe('リセット機能', () => {
    it('アプリケーションをリセットできる', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        yield* gameApp.initialize()
        yield* gameApp.start()
        yield* gameApp.reset()

        const state = yield* gameApp.getLifecycleState()
        expect(state).toBe('Uninitialized')
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })

  describe('エラーハンドリング', () => {
    it('Canvas要素が存在しない場合はエラーを返す', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        // Canvasを作成せずに初期化を試行
        const result = yield* Effect.either(gameApp.initialize())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('CanvasNotFoundError')
        }
      })

      await Effect.runPromise(test.pipe(Effect.provide(MockLayer)))
    })

    it('不正な状態遷移を試行するとエラーを返す', async () => {
      const test = Effect.gen(function* () {
        const gameApp = yield* GameApplication

        // 初期化せずに開始を試行
        const result = yield* Effect.either(gameApp.start())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('InvalidStateTransitionError')
        }
      })

      await Effect.runPromise(
        test.pipe(
          runTestWithMockCanvas,
          Effect.provide(MockLayer)
        )
      )
    })
  })
})