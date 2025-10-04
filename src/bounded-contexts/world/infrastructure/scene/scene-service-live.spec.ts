import { describe, expect, it } from '@effect/vitest'
import { Cause, Context, Duration, Effect, Fiber, Layer, Option, Ref, Schema, TestClock } from 'effect'
import { RendererService } from '@mc/bc-world/infrastructure/rendering/disabled/renderer-service'
import { SceneService } from '@domain/scene/service'
import {
  ActiveScene,
  PlayerStateSchema,
  SceneState as Scenes,
  SaveIdSchema,
  WorldId,
  WorldIdSchema,
} from '@domain/scene/types'
import {
  SceneEventBusLayer,
  SceneServiceBaseLayer,
  SceneSnapshot,
  SceneWorldManagerLayer,
  SaveManager,
  WorldManager,
} from './scene-service-live'
import { EventBus } from '@mc/bc-world/infrastructure/events/event-bus'

const makeSaveManagerLayer = (store: Ref.Ref<Option.Option<SceneSnapshot>>) =>
  Layer.succeed(SaveManager, {
    save: (snapshot: SceneSnapshot) => Ref.set(store, Option.some(snapshot)),
    load: () =>
      Ref.get(store).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new Error('snapshot not found')),
            onSome: Effect.succeed,
          })
        )
      ),
    autoSave: () => Effect.void,
  })

const makeWorldManagerLayer = (delay: Duration.Duration = Duration.millis(0)) =>
  Layer.succeed(WorldManager, {
    loadChunks: () => Effect.sleep(delay),
    loadEntities: () => Effect.sleep(delay),
    loadInventory: () => Effect.sleep(delay),
    generateTerrain: () => Effect.sleep(delay),
    initPhysics: () => Effect.sleep(delay),
    pauseWorld: () => Effect.sleep(delay),
    startWorld: () => Effect.sleep(delay),
    serializeWorld: (worldId: WorldId) => Effect.succeed({ worldId, checksum: 'test' }),
  })

const defaultPlayerState = Schema.decodeSync(PlayerStateSchema)({
  position: { x: 0, y: 64, z: 0 },
  health: 100,
  hunger: 100,
})

const testRendererLayer = Layer.succeed(RendererService, {
  initialize: () => Effect.void,
  render: () => Effect.void,
  resize: () => Effect.void,
  dispose: () => Effect.void,
  getRenderer: () => Effect.succeed(null),
  isInitialized: () => Effect.succeed(true),
  setClearColor: () => Effect.void,
  setPixelRatio: () => Effect.void,
})

const makeGameScene = (id: string): ActiveScene =>
  Scenes.GameWorld({
    worldId: Schema.decodeSync(WorldIdSchema)(id),
    playerState: defaultPlayerState,
  })

const buildLayer = (
  saveRef: Ref.Ref<Option.Option<SceneSnapshot>>,
  worldLayer: Layer.Layer<WorldManager>
) =>
  SceneServiceBaseLayer.pipe(
    Layer.provide(TestClock.defaultTestClock),
    Layer.provide(SceneEventBusLayer),
    Layer.provide(testRendererLayer),
    Layer.provide(worldLayer),
    Layer.provide(makeSaveManagerLayer(saveRef))
  )

const waitFor = (millis: number) => TestClock.adjust(Duration.millis(millis))

const runWithTiming = <A>(effect: Effect.Effect<A>, timeoutMillis: number) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(effect)
    const step = Math.max(10, Math.min(100, Math.floor(timeoutMillis / 10)))
    let elapsed = 0

    while (elapsed < timeoutMillis) {
      const done = yield* Fiber.poll(fiber)
      if (Option.isSome(done)) {
        return yield* Fiber.join(fiber)
      }

      const slice = Math.min(step, timeoutMillis - elapsed)
      yield* waitFor(slice)
      elapsed += slice
    }

    const finalCheck = yield* Fiber.poll(fiber)
    if (Option.isSome(finalCheck)) {
      return yield* Fiber.join(fiber)
    }

    yield* Fiber.interrupt(fiber)
    return yield* Effect.fail(new Error('処理がタイムアウトしました'))
  })

const runWithSceneService = <A>(
  store: Ref.Ref<Option.Option<SceneSnapshot>>,
  worldLayer: Layer.Layer<WorldManager>,
  use: (service: SceneService) => Effect.Effect<A>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const layer = buildLayer(store, worldLayer)
      const context = yield* Layer.build(layer)
      const service = Context.unsafeGet(context, SceneService)
      return yield* use(service)
    })
  )

describe('domain/scene/live', () => {
  it.effect('transitionTo updates current scene and returns new state', () =>
    Effect.gen(function* () {
      const store = Ref.unsafeMake<Option.Option<SceneSnapshot>>(Option.none())
      const target = makeGameScene('world:alpha')

      yield* runWithSceneService(store, makeWorldManagerLayer(), (service) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(Date.now())

          const transitioned = yield* runWithTiming(service.transitionTo(target), 1_000)
          expect(transitioned).toStrictEqual(target)
          const current = yield* service.current()
          expect(current).toStrictEqual(target)
        })
      )
    })
  )

  it.effect('concurrent transitions fail with TransitionInProgress', () =>
    Effect.gen(function* () {
      const store = Ref.unsafeMake<Option.Option<SceneSnapshot>>(Option.none())
      const slowWorldLayer = makeWorldManagerLayer(Duration.millis(50))
      const primary = makeGameScene('world:primary')
      const secondary = makeGameScene('world:secondary')

      yield* runWithSceneService(store, slowWorldLayer, (service) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(Date.now())

          const firstTransition = yield* Effect.fork(service.transitionTo(primary))
          yield* waitFor(10)
          const secondResult = yield* service.transitionTo(secondary).pipe(Effect.either)
          const firstResult = yield* runWithTiming(Fiber.join(firstTransition), 2_000)
          expect(firstResult).toStrictEqual(primary)
          expect(secondResult._tag).toBe('Left')
          if (secondResult._tag === 'Left') {
            expect(secondResult.left._tag).toBe('TransitionInProgress')
          }
          const current = yield* service.current()
          expect(current).toStrictEqual(primary)
        })
      )
    })
  )

  it.effect('saveSnapshot stores snapshot and restoreFrom replays it', () =>
    Effect.gen(function* () {
      const store = Ref.unsafeMake<Option.Option<SceneSnapshot>>(Option.none())
      const target = makeGameScene('world:saved')
      const saveId = Schema.decodeSync(SaveIdSchema)('save:test')

      yield* runWithSceneService(store, makeWorldManagerLayer(), (service) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(Date.now())

          yield* runWithTiming(service.transitionTo(target), 1_000)
          yield* service.saveSnapshot()
          const saved = yield* Ref.get(store)
          expect(Option.isSome(saved)).toBe(true)
          yield* runWithTiming(service.transitionTo(Scenes.MainMenu()), 1_000)
          const restored = yield* runWithTiming(service.restoreFrom(saveId), 1_000)
          expect(restored).toStrictEqual(target)
          const current = yield* service.current()
          expect(current).toStrictEqual(target)
        })
      )
    })
  )

  it.effect('preload completes for known scenes', () =>
    Effect.gen(function* () {
      const store = Ref.unsafeMake<Option.Option<SceneSnapshot>>(Option.none())
      const mainMenu = Scenes.MainMenu()
      const gameWorld = makeGameScene('world:preload')

      yield* runWithSceneService(store, makeWorldManagerLayer(), (service) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(Date.now())

          const preloadMain = yield* service.preload(mainMenu).pipe(Effect.exit)
          const preloadGame = yield* service.preload(gameWorld).pipe(Effect.exit)
          const preloadSettings = yield* service.preload(Scenes.Settings()).pipe(Effect.exit)

          if (preloadMain._tag === 'Failure') {
            expect.fail(`main menu preload failed: ${Cause.pretty(preloadMain.cause)}`)
          }
          if (preloadGame._tag === 'Failure') {
            expect.fail(`game world preload failed: ${Cause.pretty(preloadGame.cause)}`)
          }
          if (preloadSettings._tag === 'Failure') {
            expect.fail(`settings preload failed: ${Cause.pretty(preloadSettings.cause)}`)
          }
        })
      )
    })
  )
})
