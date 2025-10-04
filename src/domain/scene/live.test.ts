import { describe, expect, it } from '@effect/vitest'
import { Context, Duration, Effect, Fiber, Layer, Option, Ref, Schema } from 'effect'
import { RendererService } from '../../infrastructure/rendering.disabled/RendererService'
import { SceneService } from './service'
import {
  ActiveScene,
  PlayerStateSchema,
  SceneState as Scenes,
  SaveIdSchema,
  TransitionEffect,
  WorldId,
  WorldIdSchema,
} from './types'
import {
  SceneEventBusLayer,
  SceneServiceBaseLayer,
  SceneSnapshot,
  SceneWorldManagerLayer,
  SaveManager,
  WorldManager,
} from './live'
import { EventBus } from '../../infrastructure/events/EventBus'

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
    Layer.provide(SceneEventBusLayer),
    Layer.provide(testRendererLayer),
    Layer.provide(worldLayer),
    Layer.provide(makeSaveManagerLayer(saveRef))
  )

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
          const transitioned = yield* service.transitionTo(target)
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
          const firstTransition = yield* Effect.fork(service.transitionTo(primary))
          yield* Effect.sleep(Duration.millis(5))
          const secondExit = yield* service.transitionTo(secondary).pipe(Effect.exit)
          const firstResult = yield* Fiber.join(firstTransition)
          expect(firstResult._tag).toBe('Success')
          expect(secondExit._tag).toBe('Failure')
          if (secondExit._tag === 'Failure') {
            expect(secondExit.error._tag).toBe('TransitionInProgress')
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
          yield* service.transitionTo(target)
          yield* service.saveSnapshot()
          const saved = yield* Ref.get(store)
          expect(Option.isSome(saved)).toBe(true)
          yield* service.transitionTo(Scenes.MainMenu())
          const restored = yield* service.restoreFrom(saveId)
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
          yield* service.preload(mainMenu)
          yield* service.preload(gameWorld)
          yield* service.preload(Scenes.Settings())
        })
      )
    })
  )
})
