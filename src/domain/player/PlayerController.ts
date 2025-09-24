import { Effect, Context, Layer, Ref, Match, pipe, Stream, Option, Schema } from 'effect'
import { Player, PlayerUpdateData } from '../entities/Player.js'
import { PlayerAction, Direction, MOVEMENT_SPEEDS } from './PlayerState.js'
import type { PlayerId } from '../../shared/types/branded.js'
import { type Vector3D, type MutableVector3D } from '../../shared/schemas/spatial.js'

// 入力イベント定義
export const InputEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('KeyDown'),
    key: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('KeyUp'),
    key: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseMove'),
    deltaX: Schema.Number,
    deltaY: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseDown'),
    button: Schema.Literal('left', 'right', 'middle'),
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseUp'),
    button: Schema.Literal('left', 'right', 'middle'),
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseWheel'),
    delta: Schema.Number,
    timestamp: Schema.Number,
  })
)
export type InputEvent = Schema.Schema.Type<typeof InputEvent>

// 入力状態管理
export const InputState = Schema.Struct({
  keys: Schema.Record({ key: Schema.String, value: Schema.Boolean }),
  mouseButtons: Schema.Struct({
    left: Schema.Boolean,
    right: Schema.Boolean,
    middle: Schema.Boolean,
  }),
  mouseDelta: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),
  lastUpdateTime: Schema.Number,
})
export type InputState = Schema.Schema.Type<typeof InputState>

// コントローラーエラー定義
export class ControllerError extends Schema.TaggedError<ControllerError>()('ControllerError', {
  message: Schema.String,
  playerId: Schema.String,
  reason: Schema.Literal('InvalidInput', 'PlayerNotFound', 'ProcessingFailed'),
}) {}

// PlayerController インターフェース
export interface PlayerController {
  readonly processInput: (
    playerId: PlayerId,
    events: ReadonlyArray<InputEvent>
  ) => Effect.Effect<InputState, ControllerError>

  readonly getMovementDirection: (state: InputState) => Effect.Effect<Direction>

  readonly getMouseLook: (
    state: InputState,
    sensitivity: number
  ) => Effect.Effect<{ deltaYaw: number; deltaPitch: number }>

  readonly handleAction: (
    player: Player,
    action: PlayerAction
  ) => Effect.Effect<PlayerUpdateData, ControllerError>

  readonly updatePlayerFromInput: (
    player: Player,
    inputState: InputState,
    deltaTime: number
  ) => Effect.Effect<PlayerUpdateData, ControllerError>
}

// Context Tag定義
export class PlayerController extends Context.Tag('PlayerController')<
  PlayerController,
  PlayerController
>() {}

// PlayerController実装
const makePlayerController = Effect.gen(function* () {
  // 入力状態の管理
  const inputStates = yield* Ref.make<Map<PlayerId, InputState>>(new Map())

  // デフォルト入力状態
  const createDefaultInputState = (): InputState => ({
    keys: {},
    mouseButtons: { left: false, right: false, middle: false },
    mouseDelta: { x: 0, y: 0 },
    selectedSlot: 0,
    lastUpdateTime: Date.now(),
  })

  // 入力イベント処理
  const processInput = (playerId: PlayerId, events: ReadonlyArray<InputEvent>) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(inputStates)
      let currentState = states.get(playerId) || createDefaultInputState()

      // イベントを順次処理
      for (const event of events) {
        currentState = yield* pipe(
          Match.value(event),
          Match.tag('KeyDown', ({ key }) =>
            Effect.succeed({
              ...currentState,
              keys: { ...currentState.keys, [key]: true },
            })
          ),
          Match.tag('KeyUp', ({ key }) =>
            Effect.succeed({
              ...currentState,
              keys: { ...currentState.keys, [key]: false },
            })
          ),
          Match.tag('MouseMove', ({ deltaX, deltaY }) =>
            Effect.succeed({
              ...currentState,
              mouseDelta: { x: deltaX, y: deltaY },
            })
          ),
          Match.tag('MouseDown', ({ button }) =>
            Effect.succeed({
              ...currentState,
              mouseButtons: { ...currentState.mouseButtons, [button]: true },
            })
          ),
          Match.tag('MouseUp', ({ button }) =>
            Effect.succeed({
              ...currentState,
              mouseButtons: { ...currentState.mouseButtons, [button]: false },
            })
          ),
          Match.tag('MouseWheel', ({ delta }) =>
            Effect.succeed({
              ...currentState,
              selectedSlot: Math.max(
                0,
                Math.min(8, currentState.selectedSlot + (delta > 0 ? 1 : -1))
              ),
            })
          ),
          Match.exhaustive
        )
      }

      // 状態を更新
      currentState = { ...currentState, lastUpdateTime: Date.now() }
      yield* Ref.update(inputStates, (states) => {
        const newStates = new Map(states)
        newStates.set(playerId, currentState)
        return newStates
      })

      return currentState
    })

  // 移動方向の取得
  const getMovementDirection = (state: InputState) =>
    Effect.succeed<Direction>({
      forward: state.keys['KeyW'] || state.keys['ArrowUp'] || false,
      backward: state.keys['KeyS'] || state.keys['ArrowDown'] || false,
      left: state.keys['KeyA'] || state.keys['ArrowLeft'] || false,
      right: state.keys['KeyD'] || state.keys['ArrowRight'] || false,
      jump: state.keys['Space'] || false,
      sneak: state.keys['ShiftLeft'] || state.keys['ShiftRight'] || false,
      sprint: state.keys['ControlLeft'] || state.keys['ControlRight'] || false,
    })

  // マウス視点制御
  const getMouseLook = (state: InputState, sensitivity: number) =>
    Effect.succeed({
      deltaYaw: state.mouseDelta.x * sensitivity * 0.15,
      deltaPitch: -state.mouseDelta.y * sensitivity * 0.15, // Y軸反転
    })

  // アクション処理
  const handleAction = (player: Player, action: PlayerAction) =>
    pipe(
      Match.value(action),
      Match.tag('Move', ({ direction }) =>
        Effect.gen(function* () {
          // 移動速度計算
          let speed: number = MOVEMENT_SPEEDS.WALK
          if (player.isSprinting && !player.isSneaking) {
            speed = MOVEMENT_SPEEDS.SPRINT
          } else if (player.isSneaking) {
            speed = MOVEMENT_SPEEDS.SNEAK
          } else if (player.abilities.isFlying) {
            speed = MOVEMENT_SPEEDS.FLY
          }

          // 方向ベクトルの計算
          const moveVector: MutableVector3D = { x: 0, y: 0, z: 0 }

          // Forward/Backward (Z軸)
          if (direction.forward) moveVector.z += 1
          if (direction.backward) moveVector.z -= 1

          // Left/Right (X軸)
          if (direction.left) moveVector.x -= 1
          if (direction.right) moveVector.x += 1

          // 対角移動の正規化
          const magnitude = Math.sqrt(moveVector.x ** 2 + moveVector.z ** 2)
          if (magnitude > 0) {
            moveVector.x = (moveVector.x / magnitude) * speed
            moveVector.z = (moveVector.z / magnitude) * speed
          }

          return {
            velocity: moveVector,
            isSprinting: direction.sprint && !player.isSneaking,
            isSneaking: direction.sneak,
          } satisfies PlayerUpdateData
        })
      ),
      Match.tag('Jump', () =>
        Effect.gen(function* () {
          // ジャンプ可能条件チェック
          if (!player.isOnGround && !player.abilities.canFly) {
            return {} // ジャンプできない
          }

          return {
            velocity: {
              ...player.velocity,
              y: 8.0, // ジャンプの初速
            },
          } satisfies PlayerUpdateData
        })
      ),
      Match.tag('PlaceBlock', ({ position }) =>
        Effect.succeed({
          // ブロック設置のための更新データ
          // 実際の設置はWorldServiceで処理
        } satisfies PlayerUpdateData)
      ),
      Match.tag('BreakBlock', ({ position }) =>
        Effect.succeed({
          // ブロック破壊のための更新データ
          // 実際の破壊はWorldServiceで処理
        } satisfies PlayerUpdateData)
      ),
      Match.orElse(() => Effect.succeed({} satisfies PlayerUpdateData))
    )

  // 入力状態からプレイヤー更新データを生成
  const updatePlayerFromInput = (player: Player, inputState: InputState, deltaTime: number) =>
    Effect.gen(function* () {
      const direction = yield* getMovementDirection(inputState)
      const mouseLook = yield* getMouseLook(inputState, 1.0) // デフォルト感度

      // 移動アクションの生成と処理
      const moveAction: PlayerAction = { _tag: 'Move', direction }
      const moveUpdate = yield* handleAction(player, moveAction)

      // ジャンプ処理
      let jumpUpdate: PlayerUpdateData = {}
      if (direction.jump) {
        const jumpAction: PlayerAction = { _tag: 'Jump' }
        jumpUpdate = yield* handleAction(player, jumpAction)
      }

      // 回転の更新
      const newRotation = {
        pitch: Math.max(
          -90,
          Math.min(90, player.rotation.pitch + mouseLook.deltaPitch)
        ),
        yaw: (player.rotation.yaw + mouseLook.deltaYaw) % 360,
        roll: 0,
      }

      // すべての更新をマージ
      return {
        ...moveUpdate,
        ...jumpUpdate,
        rotation: newRotation,
      } satisfies PlayerUpdateData
    })

  return {
    processInput,
    getMovementDirection,
    getMouseLook,
    handleAction,
    updatePlayerFromInput,
  } satisfies PlayerController
})

// Live Layer実装
export const PlayerControllerLive = Layer.effect(PlayerController, makePlayerController)