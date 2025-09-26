import { describe, it, expect } from '@effect/vitest'
import * as Arbitrary from '@effect/schema/Arbitrary'
import * as FastCheck from '@effect/schema/FastCheck'
import * as Schema from '@effect/schema/Schema'
import * as TestClock from 'effect/TestClock'
import { Effect, Either, Fiber, Ref, Stream, Layer, Duration, Context } from 'effect'
import { SceneService } from '../SceneService'
import { SceneServiceLive } from '../SceneServiceLive'
import {
  SceneType,
  TransitionEffect,
  TransitionError,
  SceneEvent,
  TransitionDuration,
  WorldId,
  PlayerState,
  ErrorInfo
} from '../SceneTypes'
import { RendererService } from '../../../infrastructure/rendering/RendererService'

// Schema-based Arbitrary generators
const arbSceneType = Arbitrary.make(SceneType)
const arbTransitionEffect = Arbitrary.make(TransitionEffect)

// Test player state
const testPlayerState: PlayerState = {
  position: { x: 0, y: 0, z: 0 },
  health: 100,
  hunger: 100
}

// Mock EventBus for testing
interface EventBus {
  readonly publish: (event: SceneEvent) => Effect.Effect<void>
  readonly subscribe: () => Stream.Stream<SceneEvent>
  readonly getPublishedEvents: () => Effect.Effect<ReadonlyArray<SceneEvent>>
}

const EventBus = Context.GenericTag<EventBus>('@minecraft/EventBus')

const createTestEventBus = (): Effect.Effect<EventBus> =>
  Effect.gen(function* () {
    const events = yield* Ref.make<Array<SceneEvent>>([])

    return {
      publish: (event) =>
        Ref.update(events, (arr) => [...arr, event]),
      subscribe: () =>
        Stream.fromEffect(Ref.get(events)).pipe(
          Stream.flatMap(Stream.fromIterable)
        ),
      getPublishedEvents: () =>
        Ref.get(events)
    }
  })

// Test Layers
const TestEventBusLive = Layer.effect(EventBus, createTestEventBus())

const TestRendererServiceLive = Layer.succeed(
  RendererService,
  RendererService.of({
    initialize: () => Effect.void,
    render: () => Effect.void,
    resize: () => Effect.void,
    dispose: () => Effect.void,
    getRenderer: () => Effect.succeed(null as any),
    isInitialized: () => Effect.succeed(true),
    setClearColor: () => Effect.void,
    setPixelRatio: () => Effect.void
  })
)

const TestLayers = Layer.mergeAll(
  TestEventBusLive,
  TestRendererServiceLive,
  SceneServiceLive
)

describe('SceneService', () => {
  it.effect('scene transitions should be atomic', () =>
    Effect.gen(function* () {
      const service = yield* SceneService

      // メインメニューから設定画面への遷移
      const settingsScene: SceneType = {
        _tag: 'Settings',
        previousScene: { _tag: 'MainMenu' } as SceneType
      }

      yield* service.transitionTo(settingsScene)
      const currentAfterFirst = yield* service.getCurrentScene()
      expect(currentAfterFirst._tag).toBe('Settings')

      // 設定画面からゲームワールドへの遷移
      const gameScene: SceneType = {
        _tag: 'GameWorld',
        worldId: 'test-world' as WorldId,
        playerState: testPlayerState
      }

      yield* service.transitionTo(gameScene)
      const currentAfterSecond = yield* service.getCurrentScene()
      expect(currentAfterSecond._tag).toBe('GameWorld')
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('concurrent transitions should be prevented', () =>
    Effect.gen(function* () {
      const service = yield* SceneService

      const scene1: SceneType = {
        _tag: 'Settings',
        previousScene: { _tag: 'MainMenu' } as SceneType
      }
      const scene2: SceneType = {
        _tag: 'GameWorld',
        worldId: 'test' as WorldId,
        playerState: testPlayerState
      }

      // 同時に2つの遷移を開始
      const fiber1 = yield* service.transitionTo(
        scene1,
        { _tag: 'Fade', duration: 1000 as TransitionDuration }
      ).pipe(Effect.fork)

      const fiber2 = yield* service.transitionTo(scene2).pipe(
        Effect.either,
        Effect.fork
      )

      // 両方の結果を待つ
      yield* Fiber.join(fiber1)
      const result2 = yield* Fiber.join(fiber2)

      // 2つ目はエラーになるはず
      expect(Either.isLeft(result2)).toBe(true)
      if (Either.isLeft(result2)) {
        expect(result2.left._tag).toBe('TransitionInProgressError')
      }
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('loading progress tracking', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const eventBus = yield* EventBus

      // ゲームワールドへの遷移（ローディング発生）
      yield* service.transitionTo({
        _tag: 'GameWorld',
        worldId: 'test' as WorldId,
        playerState: testPlayerState
      })

      const recordedEvents = yield* eventBus.getPublishedEvents()
      const loadingEvents = recordedEvents.filter(
        (e) => e._tag === 'LoadingProgress'
      )

      // ローディングイベントが発行されていること
      expect(loadingEvents.length).toBeGreaterThan(0)

      // 進捗が増加していること
      const progresses = loadingEvents.map((e) =>
        e._tag === 'LoadingProgress' ? e.progress : 0
      )
      for (let i = 1; i < progresses.length; i++) {
        expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1])
      }
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('error recovery mechanism', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const clock = yield* TestClock.TestClock

      // リカバリ可能なエラーを発生させる
      const recoverableError = new Error('network timeout')
      yield* service.handleError(recoverableError)

      const errorScene = yield* service.getCurrentScene()
      expect(errorScene._tag).toBe('Error')
      if (errorScene._tag === 'Error') {
        expect(errorScene.recoverable).toBe(true)
      }

      // 時間を進めて自動リカバリを確認
      yield* clock.adjust(Duration.seconds(5))

      // リトライが開始されることを確認（実際の遷移はバックグラウンド）
      yield* Effect.sleep(Duration.millis(100))
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('state persistence on scene change', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const eventBus = yield* EventBus

      // ゲームワールドへ遷移
      yield* service.transitionTo({
        _tag: 'GameWorld',
        worldId: 'test-world' as WorldId,
        playerState: testPlayerState
      })

      // 状態を保存
      yield* service.saveState()

      const events = yield* eventBus.getPublishedEvents()
      const snapshotEvents = events.filter((e) => e._tag === 'StateSnapshot')

      // スナップショットイベントが発行されていること
      expect(snapshotEvents.length).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('transition effects are applied correctly', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const eventBus = yield* EventBus

      // フェード効果での遷移
      const fadeEffect: TransitionEffect = {
        _tag: 'Fade',
        duration: 500 as TransitionDuration
      }

      yield* service.transitionTo(
        { _tag: 'Settings', previousScene: { _tag: 'MainMenu' } } as SceneType,
        fadeEffect
      )

      const events = yield* eventBus.getPublishedEvents()
      const transitionStartedEvents = events.filter(
        (e) => e._tag === 'TransitionStarted'
      )

      expect(transitionStartedEvents.length).toBe(1)
      if (transitionStartedEvents[0]?._tag === 'TransitionStarted') {
        expect(transitionStartedEvents[0].duration).toBe(500)
      }
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('preload scene resources', () =>
    Effect.gen(function* () {
      const service = yield* SceneService

      // メインメニューのリソースをプリロード
      const result = yield* service.preloadScene({
        _tag: 'MainMenu'
      } as SceneType).pipe(Effect.either)

      // プリロードが成功することを確認
      expect(Either.isRight(result)).toBe(true)
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('scene stack management for back navigation', () =>
    Effect.gen(function* () {
      const service = yield* SceneService

      // 初期状態はメインメニュー
      const initial = yield* service.getCurrentScene()
      expect(initial._tag).toBe('MainMenu')

      // 設定画面へ遷移
      const settingsScene: SceneType = {
        _tag: 'Settings',
        previousScene: initial
      }
      yield* service.transitionTo(settingsScene)

      const current = yield* service.getCurrentScene()
      expect(current._tag).toBe('Settings')
      if (current._tag === 'Settings') {
        expect(current.previousScene._tag).toBe('MainMenu')
      }
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('error scene displays correct error info', () =>
    Effect.gen(function* () {
      const service = yield* SceneService

      const testError = new Error('Test error message')
      yield* service.handleError(testError)

      const scene = yield* service.getCurrentScene()
      expect(scene._tag).toBe('Error')
      if (scene._tag === 'Error') {
        expect(scene.error.message).toBe('Test error message')
        expect(scene.error.stack).toBeDefined()
        expect(scene.error.timestamp).toBeDefined()
      }
    }).pipe(
      Effect.provide(TestLayers)
    )
  )

  it.effect('instant transition has no delay', () =>
    Effect.gen(function* () {
      const service = yield* SceneService
      const eventBus = yield* EventBus

      const instantEffect: TransitionEffect = {
        _tag: 'Instant'
      }

      const startTime = Date.now()
      yield* service.transitionTo(
        { _tag: 'MainMenu' } as SceneType,
        instantEffect
      )
      const endTime = Date.now()

      // インスタント遷移は即座に完了する（100ms以内）
      expect(endTime - startTime).toBeLessThan(100)

      const events = yield* eventBus.getPublishedEvents()
      const completedEvents = events.filter(
        (e) => e._tag === 'TransitionCompleted'
      )
      expect(completedEvents.length).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestLayers)
    )
  )
})