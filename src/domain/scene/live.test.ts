import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Duration, Effect, Layer, Option, Ref, Schema } from 'effect'
import { RendererServiceLive } from '../../infrastructure/rendering.disabled/RendererServiceLive'
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

const makeGameScene = (id: string): ActiveScene =>
  Scenes.GameWorld({
    worldId: Schema.decodeSync(WorldIdSchema)(id),
    playerState: defaultPlayerState,
  })

const buildLayer = (
  saveRef: Ref.Ref<Option.Option<SceneSnapshot>>,
  worldLayer: Layer.Layer<WorldManager>
) =>
  Layer.mergeAll(
    SceneEventBusLayer,
    RendererServiceLive,
    worldLayer,
    makeSaveManagerLayer(saveRef),
    SceneServiceBaseLayer
  )

describe('domain/scene/live', () => {
  it.effect('transitionTo updates current scene and returns new state', () =>
    Effect.gen(function* () {
      const saved = yield* Ref.make<Option.Option<SceneSnapshot>>(Option.none())
      const layer = buildLayer(saved, SceneWorldManagerLayer)

      yield* Effect.gen(function* () {
        const service = yield* SceneService
        const gameScene = makeGameScene('world:transition')
        const transitioned = yield* service.transitionTo(gameScene, TransitionEffect.Instant({}))
        expect(transitioned).toStrictEqual(gameScene)
        const current = yield* service.current()
        expect(current).toStrictEqual(gameScene)
      }).pipe(Layer.provide(layer))
    })
  )

  it.effect('concurrent transitions fail with TransitionInProgress', () =>
    Effect.gen(function* () {
      const saved = yield* Ref.make<Option.Option<SceneSnapshot>>(Option.none())
      const layer = buildLayer(saved, makeWorldManagerLayer(Duration.millis(50)))

      yield* Effect.gen(function* () {
        const service = yield* SceneService
        const firstScene = makeGameScene('world:first')
        const secondScene = makeGameScene('world:second')

        const fiber = yield* service.transitionTo(firstScene).pipe(Effect.fork)
        const result = yield* service.transitionTo(secondScene).pipe(Effect.either)
        expect(result._tag).toBe('Left')
        yield* fiber
      }).pipe(Layer.provide(layer))
    })
  )

  it.effect('saveSnapshot stores snapshot and restoreFrom replays it', () =>
    Effect.gen(function* () {
      const saved = yield* Ref.make<Option.Option<SceneSnapshot>>(Option.none())
      const layer = buildLayer(saved, SceneWorldManagerLayer)

      yield* Effect.gen(function* () {
        const service = yield* SceneService
        const gameScene = makeGameScene('world:snapshot')
        const saveId = Schema.decodeSync(SaveIdSchema)('save:test')

        yield* service.transitionTo(gameScene)
        yield* service.saveSnapshot()

        const stored = yield* Ref.get(saved)
        expect(Option.isSome(stored)).toBe(true)

        const restored = yield* service.restoreFrom(saveId)
        expect(restored).toStrictEqual(gameScene)
      }).pipe(Layer.provide(layer))
    })
  )

  it.prop('preload completes for known scenes', [fc.constantFrom('MainMenu', 'GameWorld')], ([kind]) =>
    Effect.gen(function* () {
      const saved = yield* Ref.make<Option.Option<SceneSnapshot>>(Option.none())
      const layer = buildLayer(saved, SceneWorldManagerLayer)

      const scene: ActiveScene = kind === 'MainMenu'
        ? Scenes.MainMenu()
        : makeGameScene('world:preload')

      yield* Effect.gen(function* () {
        const service = yield* SceneService
        yield* service.preload(scene)
        return true
      }).pipe(Layer.provide(layer))
    })
  )
})
