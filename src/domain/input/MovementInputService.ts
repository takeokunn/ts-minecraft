import { Context, Effect, Layer, Match, pipe, Ref } from 'effect'
import { Direction } from '../player/PlayerState'

/**
 * Movement Input Service
 * WASD移動とマウスルックの入力処理を統合管理
 */

// 入力イベントの種類
export interface KeyboardInputEvent {
  readonly _tag: 'KeyboardInput'
  readonly key: string
  readonly action: 'keydown' | 'keyup'
  readonly timestamp: number
}

export interface MouseInputEvent {
  readonly _tag: 'MouseInput'
  readonly deltaX: number
  readonly deltaY: number
  readonly timestamp: number
}

export interface MouseButtonEvent {
  readonly _tag: 'MouseButton'
  readonly button: 'left' | 'right' | 'middle'
  readonly action: 'mousedown' | 'mouseup'
  readonly timestamp: number
}

export type InputEvent = KeyboardInputEvent | MouseInputEvent | MouseButtonEvent

// キー設定
export interface KeyBindings {
  readonly forward: string[]
  readonly backward: string[]
  readonly left: string[]
  readonly right: string[]
  readonly jump: string[]
  readonly sneak: string[]
  readonly sprint: string[]
}

// デフォルトキー設定
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: ['KeyW', 'ArrowUp'],
  backward: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  sprint: ['ControlLeft', 'ControlRight'],
} as const

// 現在の入力状態
export interface InputState {
  readonly keyboard: ReadonlyMap<string, boolean>
  readonly mouse: {
    readonly deltaX: number
    readonly deltaY: number
    readonly buttons: ReadonlyMap<string, boolean>
  }
  readonly lastUpdateTime: number
}

// 移動入力状態
export interface MovementInput {
  readonly direction: Direction
  readonly mouseRotation: { deltaX: number; deltaY: number }
  readonly jumpPressed: boolean
  readonly timestamp: number
}

// Movement Input Service インターフェース
export interface MovementInputService {
  /**
   * 入力イベントの処理
   */
  readonly processInputEvent: (event: InputEvent) => Effect.Effect<void, never>

  /**
   * 現在の移動入力状態を取得
   */
  readonly getMovementInput: () => Effect.Effect<MovementInput, never>

  /**
   * キーバインディングの設定
   */
  readonly setKeyBindings: (bindings: Partial<KeyBindings>) => Effect.Effect<void, never>

  /**
   * マウス感度の設定
   */
  readonly setMouseSensitivity: (sensitivity: number) => Effect.Effect<void, never>

  /**
   * 入力状態のリセット
   */
  readonly resetInputState: () => Effect.Effect<void, never>

  /**
   * 生の入力状態の取得（デバッグ用）
   */
  readonly getRawInputState: () => Effect.Effect<InputState, never>
}

// Context Tag定義
export const MovementInputService = Context.GenericTag<MovementInputService>('@minecraft/domain/MovementInputService')

// Movement Input Service実装
const makeMovementInputService: Effect.Effect<MovementInputService> = Effect.gen(function* () {
  // 入力状態管理
  const inputStateRef = yield* Ref.make<InputState>({
    keyboard: new Map(),
    mouse: {
      deltaX: 0,
      deltaY: 0,
      buttons: new Map(),
    },
    lastUpdateTime: Date.now(),
  })

  // キーバインディング設定
  const keyBindingsRef = yield* Ref.make<KeyBindings>(DEFAULT_KEY_BINDINGS)

  // マウス感度設定
  const mouseSensitivityRef = yield* Ref.make(1.0)

  // 一時的なマウスデルタ（フレーム間でリセット）
  const mouseDeltaRef = yield* Ref.make({ deltaX: 0, deltaY: 0 })

  // 入力イベントの処理
  const processInputEvent = (event: InputEvent) =>
    Effect.gen(function* () {
      const currentTime = Date.now()

      yield* pipe(
        Match.value(event),
        Match.tag('KeyboardInput', ({ key, action, timestamp }) =>
          Effect.gen(function* () {
            const currentState = yield* Ref.get(inputStateRef)
            const newKeyboard = new Map(currentState.keyboard)

            // キー状態を更新
            newKeyboard.set(key, action === 'keydown')

            yield* Ref.set(inputStateRef, {
              ...currentState,
              keyboard: newKeyboard,
              lastUpdateTime: timestamp || currentTime,
            })
          })
        ),
        Match.tag('MouseInput', ({ deltaX, deltaY, timestamp }) =>
          Effect.gen(function* () {
            const sensitivity = yield* Ref.get(mouseSensitivityRef)
            const scaledDeltaX = deltaX * sensitivity
            const scaledDeltaY = deltaY * sensitivity

            // マウスデルタを累積
            yield* Ref.update(mouseDeltaRef, (current) => ({
              deltaX: current.deltaX + scaledDeltaX,
              deltaY: current.deltaY + scaledDeltaY,
            }))

            // 入力状態を更新
            const currentState = yield* Ref.get(inputStateRef)
            yield* Ref.set(inputStateRef, {
              ...currentState,
              mouse: {
                ...currentState.mouse,
                deltaX: scaledDeltaX,
                deltaY: scaledDeltaY,
              },
              lastUpdateTime: timestamp || currentTime,
            })
          })
        ),
        Match.tag('MouseButton', ({ button, action, timestamp }) =>
          Effect.gen(function* () {
            const currentState = yield* Ref.get(inputStateRef)
            const newButtons = new Map(currentState.mouse.buttons)

            // マウスボタン状態を更新
            newButtons.set(button, action === 'mousedown')

            yield* Ref.set(inputStateRef, {
              ...currentState,
              mouse: {
                ...currentState.mouse,
                buttons: newButtons,
              },
              lastUpdateTime: timestamp || currentTime,
            })
          })
        ),
        Match.exhaustive
      )
    })

  // 現在の移動入力状態を取得
  const getMovementInput = () =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(inputStateRef)
      const keyBindings = yield* Ref.get(keyBindingsRef)
      const mouseDelta = yield* Ref.get(mouseDeltaRef)

      // キーバインディングに基づいて移動方向を判定
      const direction: Direction = {
        forward: keyBindings.forward.some((key) => currentState.keyboard.get(key) === true),
        backward: keyBindings.backward.some((key) => currentState.keyboard.get(key) === true),
        left: keyBindings.left.some((key) => currentState.keyboard.get(key) === true),
        right: keyBindings.right.some((key) => currentState.keyboard.get(key) === true),
        jump: keyBindings.jump.some((key) => currentState.keyboard.get(key) === true),
        sneak: keyBindings.sneak.some((key) => currentState.keyboard.get(key) === true),
        sprint: keyBindings.sprint.some((key) => currentState.keyboard.get(key) === true),
      }

      // ジャンプキーの状態（瞬間的な入力として処理）
      const jumpPressed = direction.jump

      const movementInput: MovementInput = {
        direction,
        mouseRotation: mouseDelta,
        jumpPressed,
        timestamp: currentState.lastUpdateTime,
      }

      // マウスデルタをリセット（次のフレームまで累積しない）
      yield* Ref.set(mouseDeltaRef, { deltaX: 0, deltaY: 0 })

      return movementInput
    })

  // キーバインディングの設定
  const setKeyBindings = (bindings: Partial<KeyBindings>) =>
    Effect.gen(function* () {
      const currentBindings = yield* Ref.get(keyBindingsRef)
      const newBindings: KeyBindings = {
        ...currentBindings,
        ...bindings,
      }

      yield* Ref.set(keyBindingsRef, newBindings)
      console.log('Key bindings updated:', newBindings)
    })

  // マウス感度の設定
  const setMouseSensitivity = (sensitivity: number) =>
    Effect.gen(function* () {
      const clampedSensitivity = Math.max(0.1, Math.min(5.0, sensitivity))
      yield* Ref.set(mouseSensitivityRef, clampedSensitivity)
      console.log(`Mouse sensitivity set to: ${clampedSensitivity}`)
    })

  // 入力状態のリセット
  const resetInputState = () =>
    Effect.gen(function* () {
      yield* Ref.set(inputStateRef, {
        keyboard: new Map(),
        mouse: {
          deltaX: 0,
          deltaY: 0,
          buttons: new Map(),
        },
        lastUpdateTime: Date.now(),
      })

      yield* Ref.set(mouseDeltaRef, { deltaX: 0, deltaY: 0 })

      console.log('Input state reset')
    })

  // 生の入力状態の取得
  const getRawInputState = () =>
    Effect.gen(function* () {
      return yield* Ref.get(inputStateRef)
    })

  const service: MovementInputService = {
    processInputEvent,
    getMovementInput,
    setKeyBindings,
    setMouseSensitivity,
    resetInputState,
    getRawInputState,
  }

  return service
})

// Live Layer実装
export const MovementInputServiceLive = Layer.effect(MovementInputService, makeMovementInputService)

// DOM イベントリスナーとの統合ヘルパー
export const setupDOMEventListeners = (
  inputService: MovementInputService,
  canvas?: HTMLCanvasElement
): Effect.Effect<() => void, never> =>
  Effect.gen(function* () {
    const targetElement = canvas || document

    // キーボードイベントハンドラ
    const handleKeyDown = (event: KeyboardEvent) => {
      const inputEvent: KeyboardInputEvent = {
        _tag: 'KeyboardInput',
        key: event.code,
        action: 'keydown',
        timestamp: Date.now(),
      }
      Effect.runSync(inputService.processInputEvent(inputEvent))
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const inputEvent: KeyboardInputEvent = {
        _tag: 'KeyboardInput',
        key: event.code,
        action: 'keyup',
        timestamp: Date.now(),
      }
      Effect.runSync(inputService.processInputEvent(inputEvent))
    }

    // マウスイベントハンドラ
    const handleMouseMove = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const inputEvent: MouseInputEvent = {
        _tag: 'MouseInput',
        deltaX: mouseEvent.movementX || 0,
        deltaY: mouseEvent.movementY || 0,
        timestamp: Date.now(),
      }
      Effect.runSync(inputService.processInputEvent(inputEvent))
    }

    const handleMouseDown = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const button = mouseEvent.button === 0 ? 'left' : mouseEvent.button === 1 ? 'middle' : 'right'
      const inputEvent: MouseButtonEvent = {
        _tag: 'MouseButton',
        button,
        action: 'mousedown',
        timestamp: Date.now(),
      }
      Effect.runSync(inputService.processInputEvent(inputEvent))
    }

    const handleMouseUp = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const button = mouseEvent.button === 0 ? 'left' : mouseEvent.button === 1 ? 'middle' : 'right'
      const inputEvent: MouseButtonEvent = {
        _tag: 'MouseButton',
        button,
        action: 'mouseup',
        timestamp: Date.now(),
      }
      Effect.runSync(inputService.processInputEvent(inputEvent))
    }

    // イベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    targetElement.addEventListener('mousemove', handleMouseMove)
    targetElement.addEventListener('mousedown', handleMouseDown)
    targetElement.addEventListener('mouseup', handleMouseUp)

    console.log('DOM event listeners set up for movement input')

    // クリーンアップ関数を返す
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      targetElement.removeEventListener('mousemove', handleMouseMove)
      targetElement.removeEventListener('mousedown', handleMouseDown)
      targetElement.removeEventListener('mouseup', handleMouseUp)
      console.log('DOM event listeners cleaned up')
    }
  })
