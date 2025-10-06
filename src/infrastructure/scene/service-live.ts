import { SceneService } from '@domain/scene'
import {
  ActiveScene,
  LoadError as LoadErrorADT,
  PlayerState,
  PreloadError as PreloadErrorADT,
  PreloadedResource,
  ResourceKind,
  SaveError as SaveErrorADT,
  SaveId,
  SceneEvent,
  SceneProgress,
  SceneProgressSchema,
  SceneState,
  SceneStateSchema,
  SceneTimestamp,
  SceneTimestampSchema,
  SceneState as Scenes,
  TransitionDurationSchema,
  TransitionEffect,
  TransitionError as TransitionErrorADT,
  WorldId,
} from '@domain/scene'
import type { EventBusService } from '@infrastructure/events'
import { EventBus } from '@infrastructure/events'
import {
  RendererService,
  parseAlpha as parseRendererAlpha,
  parseRgbColor,
} from '@infrastructure/rendering'
import { RendererServiceLive } from '@infrastructure/rendering'
import { Clock, Context, Duration, Effect, HashMap, Layer, Match, Option, Ref, Schema, pipe } from 'effect'

// ===== 外部ポート =====

export interface WorldSnapshot {
  readonly worldId: WorldId
  readonly checksum: string
}

export interface WorldManager {
  readonly loadChunks: (worldId: WorldId) => Effect.Effect<void>
  readonly loadEntities: (worldId: WorldId) => Effect.Effect<void>
  readonly loadInventory: (player: PlayerState) => Effect.Effect<void>
  readonly generateTerrain: (worldId: WorldId) => Effect.Effect<void>
  readonly initPhysics: () => Effect.Effect<void>
  readonly pauseWorld: (worldId: WorldId) => Effect.Effect<void>
  readonly startWorld: (worldId: WorldId) => Effect.Effect<void>
  readonly serializeWorld: (worldId: WorldId) => Effect.Effect<WorldSnapshot>
}

export const WorldManager = Context.GenericTag<WorldManager>('@minecraft/domain/scene/WorldManager')

export interface SceneSnapshot {
  readonly scene: SceneState
  readonly world: Option.Option<WorldSnapshot>
  readonly player: Option.Option<PlayerState>
  readonly createdAt: SceneTimestamp
}

export interface SaveManager {
  readonly save: (snapshot: SceneSnapshot) => Effect.Effect<void>
  readonly load: (saveId: SaveId) => Effect.Effect<SceneSnapshot>
  readonly autoSave: (worldId: WorldId) => Effect.Effect<void>
}

export const SaveManager = Context.GenericTag<SaveManager>('@minecraft/domain/scene/SaveManager')

export const parseTransitionDuration = Schema.decodeUnknownSync(TransitionDurationSchema)
export const parseSceneProgress = Schema.decodeUnknownSync(SceneProgressSchema)
export const parseTimestamp = Schema.decodeUnknownSync(SceneTimestampSchema)

const defaultTransitionEffect = TransitionEffect.Fade({ duration: parseTransitionDuration(500) })
const zeroProgress = parseSceneProgress(0)
const fullProgress = parseSceneProgress(1)
const opaqueAlpha = parseRendererAlpha(1)
const mainMenuClearColor = parseRgbColor(0x000000)
const settingsClearColor = parseRgbColor(0x202020)
const errorClearColor = parseRgbColor(0x440000)

const resourceKindFromPath = (path: string): ResourceKind =>
  Match.value(path).pipe(
    Match.when(
      (value: string) => value.endsWith('.png'),
      () => 'texture'
    ),
    Match.when(
      (value: string) => value.endsWith('.obj'),
      () => 'model'
    ),
    Match.when(
      (value: string) => value.endsWith('.mp3'),
      () => 'sound'
    ),
    Match.orElse(() => 'data'),
    Match.exhaustive
  )

const transitionDurationOf = (effect: TransitionEffect) =>
  Match.value(effect).pipe(
    Match.tag('Fade', (fade) => fade.duration),
    Match.tag('Slide', (slide) => slide.duration),
    Match.tag('Instant', () => parseTransitionDuration(0)),
    Match.exhaustive
  )

const executeTransitionEffect = (effect: TransitionEffect) =>
  Match.value(effect).pipe(
    Match.tag('Fade', (fade) => Effect.sleep(Duration.millis(Number(fade.duration)))),
    Match.tag('Slide', (slide) => Effect.sleep(Duration.millis(Number(slide.duration)))),
    Match.tag('Instant', () => Effect.void),
    Match.exhaustive
  )

const clampProgress = (value: number): SceneProgress => parseSceneProgress(Math.min(1, Math.max(0, value)))

const toSnapshot = (params: {
  readonly scene: SceneState
  readonly world: Option.Option<WorldSnapshot>
  readonly player: Option.Option<PlayerState>
  readonly timestamp: SceneTimestamp
}): SceneSnapshot => ({
  scene: params.scene,
  world: params.world,
  player: params.player,
  createdAt: params.timestamp,
})

const withTransitionLock = <A>(params: {
  readonly requested: ActiveScene
  readonly currentRef: Ref.Ref<SceneState>
  readonly flagRef: Ref.Ref<boolean>
  readonly use: (current: SceneState) => Effect.Effect<A, TransitionErrorADT>
}) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const current = yield* Ref.get(params.currentRef)
      const active = yield* Ref.get(params.flagRef)

      return yield* Match.value(active).pipe(
        Match.when(true, () =>
          Effect.fail(
            TransitionErrorADT.TransitionInProgress({
              currentScene: Option.some(current),
              requested: params.requested,
            })
          )
        ),
        Match.orElse(() => Ref.set(params.flagRef, true).pipe(Effect.as(current)))
      )
    }),
    params.use,
    () => Ref.set(params.flagRef, false)
  )

const publishEvent = (bus: EventBusService, event: SceneEvent) => bus.publish(event)

const mergeResource = (ref: Ref.Ref<HashMap.HashMap<string, PreloadedResource>>, resource: PreloadedResource) =>
  Ref.update(ref, (map) => HashMap.set(map, resource.id, resource))

const preloadResource = (resources: Ref.Ref<HashMap.HashMap<string, PreloadedResource>>, path: string) =>
  Clock.currentTimeMillis.pipe(
    Effect.map(parseTimestamp),
    Effect.flatMap((timestamp) =>
      mergeResource(resources, {
        id: path,
        type: resourceKindFromPath(path),
        data: Option.none(),
        size: 0,
        loadedAt: timestamp,
      })
    )
  )

const ensureSceneValid = (scene: ActiveScene) =>
  Schema.decode(SceneStateSchema)(scene).pipe(
    Effect.as(scene),
    Effect.mapError((issue) =>
      TransitionErrorADT.InvalidScene({
        requested: scene,
        reason: issue.message,
      })
    )
  )

export const makeSceneService = Effect.gen(function* () {
  const eventBus = yield* EventBus
  const renderer = yield* RendererService
  const worldManager = yield* WorldManager
  const saveManager = yield* SaveManager

  const currentScene = yield* Ref.make<SceneState>(Scenes.MainMenu())
  const transitionFlag = yield* Ref.make(false)
  const resourcesRef = yield* Ref.make(HashMap.empty<string, PreloadedResource>())

  const emitTransitionStarted = (fromScene: SceneState, toScene: ActiveScene, effect: TransitionEffect) =>
    publishEvent(eventBus, {
      _tag: 'TransitionStarted',
      from: Option.some(fromScene),
      to: toScene,
      duration: transitionDurationOf(effect),
    })

  const emitTransitionCompleted = (scene: SceneState) =>
    publishEvent(eventBus, {
      _tag: 'TransitionCompleted',
      scene,
    })

  const emitLoadingProgress = (progress: SceneProgress, message: string) =>
    publishEvent(eventBus, {
      _tag: 'LoadingProgress',
      progress,
      message,
    })

  const emitSnapshot = (snapshot: SceneSnapshot) =>
    publishEvent(eventBus, {
      _tag: 'StateSnapshot',
      scene: snapshot.scene,
      timestamp: snapshot.createdAt,
    })

  const runCleanup = (scene: SceneState) =>
    Match.value(scene).pipe(
      Match.tag('GameWorld', ({ worldId }) =>
        Effect.zipRight(saveManager.autoSave(worldId), worldManager.pauseWorld(worldId))
      ),
      Match.tag('Error', () => Effect.void),
      Match.tag('Loading', () => Effect.void),
      Match.tag('MainMenu', () => Effect.void),
      Match.tag('Settings', () => Effect.void),
      Match.exhaustive
    )

  const initializeScene = (scene: ActiveScene) =>
    Match.value(scene).pipe(
      Match.tag('MainMenu', () => renderer.setClearColor(mainMenuClearColor, opaqueAlpha)),
      Match.tag('Settings', () => renderer.setClearColor(settingsClearColor, opaqueAlpha)),
      Match.tag('Error', () => renderer.setClearColor(errorClearColor, opaqueAlpha)),
      Match.tag('GameWorld', ({ worldId, playerState }) =>
        Effect.gen(function* () {
          const tasks: ReadonlyArray<{
            readonly label: string
            readonly weight: number
            readonly job: Effect.Effect<void>
          }> = [
            { label: 'チャンク読み込み', weight: 0.35, job: worldManager.loadChunks(worldId) },
            { label: 'エンティティ読み込み', weight: 0.2, job: worldManager.loadEntities(worldId) },
            { label: 'インベントリ同期', weight: 0.1, job: worldManager.loadInventory(playerState) },
            { label: '地形生成', weight: 0.2, job: worldManager.generateTerrain(worldId) },
            { label: '物理エンジン初期化', weight: 0.15, job: worldManager.initPhysics() },
          ]

          yield* Ref.set(currentScene, Scenes.Loading({ target: scene, progress: zeroProgress }))
          const progressRef = yield* Ref.make(0)

          yield* Effect.forEach(
            tasks,
            ({ job, weight, label }) =>
              Effect.gen(function* () {
                yield* job
                const accumulated = yield* Ref.updateAndGet(progressRef, (value) => value + weight)
                const progress = clampProgress(accumulated)
                yield* emitLoadingProgress(progress, label)
                yield* Ref.set(currentScene, Scenes.Loading({ target: scene, progress }))
              }),
            { discard: true }
          )

          yield* worldManager.startWorld(worldId)
          yield* emitLoadingProgress(fullProgress, 'ワールド開始')
        })
      ),
      Match.exhaustive
    )

  const preload = (scene: ActiveScene) =>
    Match.value(scene).pipe(
      Match.tag('GameWorld', () =>
        Effect.forEach(
          ['textures/blocks.png', 'models/player.obj', 'sounds/ambient.mp3'],
          (path) => preloadResource(resourcesRef, path),
          { discard: true }
        ).pipe(
          Effect.mapError(() =>
            PreloadErrorADT.PreloadFailed({
              message: 'ゲームワールドリソースのプリロードに失敗しました',
              resources: ['textures/blocks.png', 'models/player.obj', 'sounds/ambient.mp3'],
            })
          )
        )
      ),
      Match.tag('MainMenu', () =>
        Effect.forEach(
          ['textures/menu-bg.png', 'sounds/menu-music.mp3'],
          (path) => preloadResource(resourcesRef, path),
          { discard: true }
        ).pipe(
          Effect.mapError(() =>
            PreloadErrorADT.PreloadFailed({
              message: 'メインメニューリソースのプリロードに失敗しました',
              resources: ['textures/menu-bg.png', 'sounds/menu-music.mp3'],
            })
          )
        )
      ),
      Match.orElse(() => Effect.void)
    )

  const transitionTo = (target: ActiveScene, maybeEffect?: TransitionEffect) =>
    Effect.gen(function* () {
      const scene = yield* ensureSceneValid(target)
      const effect = pipe(
        Option.fromNullable(maybeEffect),
        Option.match({
          onNone: () => defaultTransitionEffect,
          onSome: (value) => value,
        })
      )

      return yield* withTransitionLock({
        requested: scene,
        currentRef: currentScene,
        flagRef: transitionFlag,
        use: (previous) =>
          Effect.gen(function* () {
            yield* emitTransitionStarted(previous, scene, effect)
            yield* runCleanup(previous)
            yield* executeTransitionEffect(effect)
            yield* initializeScene(scene)
            yield* Ref.set(currentScene, scene)
            yield* emitTransitionCompleted(scene)
            return scene
          }),
      })
    })

  const saveSnapshot = () =>
    Effect.gen(function* () {
      const scene = yield* Ref.get(currentScene)
      const timestamp = yield* Clock.currentTimeMillis.pipe(Effect.map(parseTimestamp))

      const snapshot = yield* Match.value(scene).pipe(
        Match.tag('GameWorld', ({ worldId, playerState }) =>
          Effect.gen(function* () {
            const world = yield* worldManager.serializeWorld(worldId)
            return toSnapshot({
              scene,
              world: Option.some(world),
              player: Option.some(playerState),
              timestamp,
            })
          })
        ),
        Match.orElse(() =>
          Effect.succeed(
            toSnapshot({
              scene,
              world: Option.none(),
              player: Option.none(),
              timestamp,
            })
          )
        )
      )

      yield* saveManager.save(snapshot).pipe(
        Effect.mapError(() =>
          SaveErrorADT.SaveFailed({
            message: 'シーンの保存に失敗しました',
            cause: Option.none(),
          })
        )
      )

      yield* emitSnapshot(snapshot)
    })

  const restoreFrom = (saveId: SaveId) =>
    Effect.gen(function* () {
      const snapshot = yield* saveManager.load(saveId).pipe(
        Effect.mapError(() =>
          LoadErrorADT.SaveNotFound({
            saveId,
            message: 'セーブデータが見つかりません',
          })
        )
      )

      return yield* Match.value(snapshot.scene).pipe(
        Match.tag('Loading', () =>
          Effect.fail(
            LoadErrorADT.LoadFailed({
              saveId,
              message: 'ローディング中の状態は復元できません',
            })
          )
        ),
        Match.tag('MainMenu', (scene) => transitionTo(scene)),
        Match.tag('GameWorld', (scene) => transitionTo(scene)),
        Match.tag('Settings', (scene) => transitionTo(scene)),
        Match.tag('Error', (scene) => transitionTo(scene))
      )
    })

  const registerFailure = (error: Error) =>
    Clock.currentTimeMillis.pipe(
      Effect.map(parseTimestamp),
      Effect.flatMap((timestamp) => {
        const scene = Scenes.Error({
          error: {
            message: error.message,
            stack: Option.fromNullable(error.stack),
            timestamp,
          },
          recoverable: false,
        })
        return Ref.set(currentScene, scene).pipe(Effect.zipRight(emitTransitionCompleted(scene)), Effect.as(scene))
      })
    )

  return SceneService.of({
    transitionTo,
    current: () => Ref.get(currentScene),
    saveSnapshot,
    restoreFrom,
    registerFailure,
    preload,
  })
})

export const SceneEventBusLayer = Layer.succeed(EventBus, {
  publish: <T>(_: T) => Effect.void,
  subscribe: <T>(_: (event: T) => Effect.Effect<void>) =>
    Effect.succeed({
      close: () => Effect.void,
    }),
})

export const SceneWorldManagerLayer = Layer.succeed(WorldManager, {
  loadChunks: () => Effect.void,
  loadEntities: () => Effect.void,
  loadInventory: () => Effect.void,
  generateTerrain: () => Effect.void,
  initPhysics: () => Effect.void,
  pauseWorld: () => Effect.void,
  startWorld: () => Effect.void,
  serializeWorld: (worldId: WorldId) => Effect.succeed({ worldId, checksum: 'mock' }),
})

export const SceneSaveManagerLayer = Layer.succeed(SaveManager, {
  save: () => Effect.void,
  load: () =>
    Clock.currentTimeMillis.pipe(
      Effect.map(parseTimestamp),
      Effect.map((timestamp) => ({
        scene: Scenes.MainMenu(),
        world: Option.none<WorldSnapshot>(),
        player: Option.none<PlayerState>(),
        createdAt: timestamp,
      }))
    ),
  autoSave: () => Effect.void,
})

export const SceneServiceBaseLayer = Layer.effect(SceneService, makeSceneService)

export const SceneServiceLive = SceneServiceBaseLayer.pipe(
  Layer.provide(SceneEventBusLayer),
  Layer.provide(RendererServiceLive),
  Layer.provide(SceneWorldManagerLayer),
  Layer.provide(SceneSaveManagerLayer)
)
