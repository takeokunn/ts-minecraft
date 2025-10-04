import { Effect, Match, Schema } from 'effect'
import { PlayerStateSchema, SceneState as Scenes, WorldIdSchema } from '../types'
import {
  SceneBlueprint,
  SceneCleanupError,
  SceneContext,
  SceneController,
  SceneControllerError,
  SceneDefinition,
  SceneInitializationError,
  SceneLifecycleError,
  SceneUpdateError,
  createSceneController,
  createSceneRuntime,
  mapControllerFailure,
} from './base'

const defaultWorldId = Schema.decodeSync(WorldIdSchema)('world:overworld')
const defaultPlayerState = Schema.decodeSync(PlayerStateSchema)({
  position: { x: 0, y: 64, z: 0 },
  health: 100,
  hunger: 100,
})

export interface GameSceneController extends SceneController<ReturnType<typeof Scenes.GameWorld>> {
  readonly movePlayer: (delta: {
    readonly dx: number
    readonly dy: number
    readonly dz: number
  }) => Effect.Effect<ReturnType<typeof Scenes.GameWorld>['playerState']['position'], SceneControllerError>
  readonly applyDamage: (amount: number) => Effect.Effect<number, SceneControllerError>
  readonly heal: (amount: number) => Effect.Effect<number, SceneControllerError>
}

const clampStat = (value: number) => Math.max(0, Math.min(100, value))

const ensureFinite = (value: number, message: string) =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(false, () => Effect.fail(SceneControllerError.InvalidMutation({ reason: message }))),
    Match.when(true, () => Effect.succeed(value)),
    Match.exhaustive
  )

export const createGameSceneController = (): Effect.Effect<GameSceneController> =>
  createSceneController(
    Scenes.GameWorld({
      worldId: defaultWorldId,
      playerState: defaultPlayerState,
    })
  ).pipe(
    Effect.map((controller) => {
      const movePlayer: GameSceneController['movePlayer'] = (delta) =>
        Effect.all({
          dx: ensureFinite(delta.dx, 'X軸の移動量が有限ではありません'),
          dy: ensureFinite(delta.dy, 'Y軸の移動量が有限ではありません'),
          dz: ensureFinite(delta.dz, 'Z軸の移動量が有限ではありません'),
        }).pipe(
          Effect.flatMap(({ dx, dy, dz }) =>
            controller.update((scene) => ({
              ...scene,
              playerState: {
                ...scene.playerState,
                position: {
                  x: scene.playerState.position.x + dx,
                  y: scene.playerState.position.y + dy,
                  z: scene.playerState.position.z + dz,
                },
              },
            }))
          ),
          Effect.map((scene) => scene.playerState.position)
        )

      const applyDamage: GameSceneController['applyDamage'] = (amount) =>
        ensureFinite(amount, 'ダメージ量が有限ではありません').pipe(
          Effect.flatMap((value) =>
            controller.update((scene) => ({
              ...scene,
              playerState: {
                ...scene.playerState,
                health: clampStat(scene.playerState.health - Math.abs(value)),
              },
            }))
          ),
          Effect.map((scene) => scene.playerState.health)
        )

      const heal: GameSceneController['heal'] = (amount) =>
        ensureFinite(amount, '回復量が有限ではありません').pipe(
          Effect.flatMap((value) =>
            controller.update((scene) => ({
              ...scene,
              playerState: {
                ...scene.playerState,
                health: clampStat(scene.playerState.health + Math.abs(value)),
              },
            }))
          ),
          Effect.map((scene) => scene.playerState.health)
        )

      return {
        ...controller,
        movePlayer,
        applyDamage,
        heal,
      }
    })
  )

type GameState = ReturnType<typeof Scenes.GameWorld>

type GameSceneContext = SceneContext<GameState, GameSceneController>

interface GameMetadata {
  readonly gameMode: string
  readonly worldName: string
  readonly difficulty: string
}

const metadata: Readonly<GameMetadata> = {
  gameMode: 'Creative',
  worldName: 'New World',
  difficulty: 'Normal',
}

const handleInitializationFailure = (reason: string): SceneInitializationError =>
  SceneInitializationError({ sceneType: 'GameWorld', message: reason })

const handleUpdateFailure = (reason: string): SceneUpdateError =>
  SceneUpdateError({ sceneType: 'GameWorld', reason })

const handleLifecycleFailure = (phase: SceneLifecycleError['phase']) => (reason: string): SceneLifecycleError =>
  SceneLifecycleError({ sceneType: 'GameWorld', phase, message: reason })

const handleCleanupFailure = (reason: string): SceneCleanupError =>
  SceneCleanupError({ sceneType: 'GameWorld', message: reason })

const GameSceneBlueprint: SceneBlueprint<GameState, GameSceneController> = {
  initial: Scenes.GameWorld({ worldId: defaultWorldId, playerState: defaultPlayerState }),
  controller: createGameSceneController(),
}

const warmUpWorld = (context: GameSceneContext) =>
  mapControllerFailure(
    context.controller.replace(
      Scenes.GameWorld({ worldId: defaultWorldId, playerState: defaultPlayerState })
    ),
    handleInitializationFailure
  ).pipe(Effect.asVoid)

const updatePlayerStamina = (context: GameSceneContext, frameTime: number) =>
  mapControllerFailure(
    context.controller.update((state) => ({
      ...state,
      playerState: {
        ...state.playerState,
        hunger: clampStat(state.playerState.hunger - frameTime * 0.5),
      },
    })),
    handleUpdateFailure
  ).pipe(Effect.asVoid)

const recoverPlayer = (context: GameSceneContext) =>
  mapControllerFailure(context.controller.heal(0), handleCleanupFailure).pipe(Effect.asVoid)

const gameDefinition: SceneDefinition<GameState, GameSceneController> = {
  id: 'game-scene-001',
  type: 'GameWorld',
  metadata,
  blueprint: GameSceneBlueprint,
  onInitialize: (context) =>
    Effect.gen(function* () {
      yield* context.controller.reset()
      yield* warmUpWorld(context)
      return undefined
    }),
  onUpdate: (context, frameTime) => updatePlayerStamina(context, Math.min(1, Number(frameTime) / 16)),
  onEnter: () => Effect.void,
  onExit: (context) =>
    mapControllerFailure(context.controller.applyDamage(0), handleLifecycleFailure('exit')).pipe(Effect.asVoid),
  onCleanup: (context) => recoverPlayer(context),
}

export const GameScene = createSceneRuntime(gameDefinition)

export { GameSceneBlueprint }
export const GameDefinition = gameDefinition
