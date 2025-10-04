import { Effect, Match, Schema } from 'effect'
import {
  PlayerStateSchema,
  SceneState as Scenes,
  WorldIdSchema,
} from '../types'
import { SceneBlueprint, SceneController, SceneControllerError, createSceneController, makeBlueprint } from './base'

const defaultWorldId = Schema.decodeSync(WorldIdSchema)('world:overworld')
const defaultPlayerState = Schema.decodeSync(PlayerStateSchema)({
  position: { x: 0, y: 64, z: 0 },
  health: 100,
  hunger: 100,
})

export interface GameSceneController extends SceneController<ReturnType<typeof Scenes.GameWorld>> {
  readonly movePlayer: (delta: { readonly dx: number; readonly dy: number; readonly dz: number }) => Effect.Effect<
    ReturnType<typeof Scenes.GameWorld>['playerState']['position'],
    SceneControllerError
  >
  readonly applyDamage: (amount: number) => Effect.Effect<number, SceneControllerError>
  readonly heal: (amount: number) => Effect.Effect<number, SceneControllerError>
}

const clampHealth = (value: number) =>
  Math.max(0, Math.min(100, value))

const ensureFinite = (value: number, message: string) =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(false, () =>
      Effect.fail(
        SceneControllerError.InvalidMutation({ reason: message })
      )
    ),
    Match.orElse(() => Effect.succeed(value))
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
                health: clampHealth(scene.playerState.health - Math.abs(value)),
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
                health: clampHealth(scene.playerState.health + Math.abs(value)),
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

export const GameSceneBlueprint: SceneBlueprint<ReturnType<typeof Scenes.GameWorld>> = makeBlueprint(
  Scenes.GameWorld({
    worldId: defaultWorldId,
    playerState: defaultPlayerState,
  })
)
