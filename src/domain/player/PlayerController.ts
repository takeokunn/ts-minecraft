import { Effect, Context, Layer, Ref, Match, pipe, Stream, Option } from 'effect'
import { Schema } from '@effect/schema'
import { Player, PlayerUpdateData } from '../entities/Player'
import { PlayerAction, Direction, MOVEMENT_SPEEDS } from './PlayerState'
import type { PlayerId } from '@domain/core/types/brands'
import { type Vector3D, type MutableVector3D } from '@domain/core/types/spatial'

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

// コントローラーエラー定義 - 関数型スタイル
export const ControllerError = Schema.TaggedStruct('ControllerError', {
  message: Schema.String,
  playerId: Schema.String,
  reason: Schema.Literal('InvalidInput', 'PlayerNotFound', 'ProcessingFailed'),
})
export type ControllerError = Schema.Schema.Type<typeof ControllerError>

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

  readonly handleAction: (player: Player, action: PlayerAction) => Effect.Effect<PlayerUpdateData, ControllerError>

  readonly updatePlayerFromInput: (
    player: Player,
    inputState: InputState,
    deltaTime: number
  ) => Effect.Effect<PlayerUpdateData, ControllerError>
}

// Context Tag定義 - 関数型スタイル
export const PlayerController = Context.GenericTag<PlayerController>('@minecraft/domain/PlayerController')

// PlayerController実装
const makePlayerController: Effect.Effect<PlayerController> = Effect.gen(function* () {
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

      // イベントを順次処理 - Effect-TSパターン（forループ削除）
      currentState = yield* pipe(
        Effect.succeed(events),
        Effect.flatMap((evts) =>
          Effect.reduce(evts, currentState, (state, event) =>
            pipe(
              Match.value(event),
              Match.tag('KeyDown', ({ key }) =>
                Effect.succeed({
                  ...state,
                  keys: { ...state.keys, [key]: true },
                })
              ),
              Match.tag('KeyUp', ({ key }) =>
                Effect.succeed({
                  ...state,
                  keys: { ...state.keys, [key]: false },
                })
              ),
              Match.tag('MouseMove', ({ deltaX, deltaY }) =>
                Effect.succeed({
                  ...state,
                  mouseDelta: { x: deltaX, y: deltaY },
                })
              ),
              Match.tag('MouseDown', ({ button }) =>
                Effect.succeed({
                  ...state,
                  mouseButtons: { ...state.mouseButtons, [button]: true },
                })
              ),
              Match.tag('MouseUp', ({ button }) =>
                Effect.succeed({
                  ...state,
                  mouseButtons: { ...state.mouseButtons, [button]: false },
                })
              ),
              Match.tag('MouseWheel', ({ delta }) =>
                Effect.succeed({
                  ...state,
                  selectedSlot: Math.max(0, Math.min(8, state.selectedSlot + (delta > 0 ? 1 : -1))),
                })
              ),
              Match.exhaustive
            )
          )
        )
      )

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
          // 移動速度計算 - Effect-TSパターン
          const speed = yield* pipe(
            Match.value({
              isSprinting: player.isSprinting,
              isSneaking: player.isSneaking,
              isFlying: player.abilities.isFlying,
            }),
            Match.when(
              ({ isSprinting, isSneaking }) => isSprinting && !isSneaking,
              () => Effect.succeed(MOVEMENT_SPEEDS.SPRINT)
            ),
            Match.when(
              ({ isSneaking }) => isSneaking,
              () => Effect.succeed(MOVEMENT_SPEEDS.SNEAK)
            ),
            Match.when(
              ({ isFlying }) => isFlying,
              () => Effect.succeed(MOVEMENT_SPEEDS.FLY)
            ),
            Match.orElse(() => Effect.succeed(MOVEMENT_SPEEDS.WALK))
          )

          // 方向ベクトルの計算 - Effect-TSパターン
          const moveVector = yield* Effect.gen(function* () {
            const base: MutableVector3D = { x: 0, y: 0, z: 0 }

            // 各方向の移動を加算
            const withForwardBackward = pipe(base, (vec) => ({
              ...vec,
              z: vec.z + (direction.forward ? 1 : 0) + (direction.backward ? -1 : 0),
            }))

            const withLeftRight = pipe(withForwardBackward, (vec) => ({
              ...vec,
              x: vec.x + (direction.left ? -1 : 0) + (direction.right ? 1 : 0),
            }))

            return withLeftRight
          })

          // 対角移動の正規化 - Effect-TSパターン
          const normalizedVector = yield* pipe(
            Effect.succeed(moveVector),
            Effect.map((vec) => {
              const magnitude = Math.sqrt(vec.x ** 2 + vec.z ** 2)
              return magnitude > 0
                ? { x: (vec.x / magnitude) * speed, y: vec.y, z: (vec.z / magnitude) * speed }
                : { x: 0, y: 0, z: 0 }
            })
          )

          return {
            velocity: normalizedVector,
            isSprinting: direction.sprint && !player.isSneaking,
            isSneaking: direction.sneak,
          } satisfies PlayerUpdateData
        })
      ),
      Match.tag('Jump', () =>
        pipe(
          Effect.succeed(player),
          Effect.flatMap((p) =>
            pipe(
              Match.value({ isOnGround: p.isOnGround, canFly: p.abilities.canFly }),
              Match.when(
                ({ isOnGround, canFly }) => !isOnGround && !canFly,
                () => Effect.succeed({} satisfies PlayerUpdateData)
              ),
              Match.orElse(() =>
                Effect.succeed({
                  velocity: {
                    ...player.velocity,
                    y: 8.0, // ジャンプの初速
                  },
                } satisfies PlayerUpdateData)
              )
            )
          )
        )
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

      // 移動アクションを処理
      const updateData = yield* handleAction(player, { _tag: 'Move', direction } as PlayerAction)

      // 回転の更新
      const newRotation = {
        yaw: (player.rotation.yaw + mouseLook.deltaYaw) % 360,
        pitch: Math.max(-90, Math.min(90, player.rotation.pitch + mouseLook.deltaPitch)),
        roll: player.rotation.roll || 0, // rollプロパティを追加
      }

      // ジャンプ処理 - Effect-TSパターン
      return yield* pipe(
        Match.value({ shouldJump: direction.jump && player.isOnGround }),
        Match.when(
          ({ shouldJump }) => shouldJump,
          () =>
            pipe(
              handleAction(player, { _tag: 'Jump' } as PlayerAction),
              Effect.map((jumpUpdate) => ({
                ...updateData,
                ...jumpUpdate,
                rotation: newRotation,
              }))
            )
        ),
        Match.orElse(() =>
          Effect.succeed({
            ...updateData,
            rotation: newRotation,
          })
        )
      )
    })

  const controller: PlayerController = {
    processInput,
    getMovementDirection,
    getMouseLook,
    handleAction,
    updatePlayerFromInput,
  }

  return controller
})

// Live Layer実装
export const PlayerControllerLive = Layer.effect(PlayerController, makePlayerController)
