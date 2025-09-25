import { Effect, Layer, Ref, Queue, Stream, Schedule, Duration } from 'effect'
import { InputService } from './InputService'
import type { MouseDelta } from './types'
import { InputSystemError, InputHandlerRegistrationError } from './types'
import type { InputEvent, InputState, KeyCode, ButtonId, InputTimestamp } from './schemas'

/**
 * InputServiceLive - 入力サービスの仮実装
 *
 * TODO: 本格的な入力処理実装が完了するまでの暫定実装
 * Issue #176のApplication Layer統合のために最小限の機能を提供
 */

const makeInputServiceLive = Effect.gen(function* () {
  // パフォーマンス最適化のための状態管理
  const inputState = yield* Ref.make<InputState>({
    _tag: 'InputState' as const,
    keys: new Set<KeyCode>(),
    mouseButtons: new Set<'left' | 'right' | 'middle'>(),
    mousePosition: { x: 0, y: 0 },
    mouseDelta: { deltaX: 0, deltaY: 0 },
    gamepadAxes: [] as number[],
    gamepadButtons: new Set<ButtonId>(),
    touchPoints: [] as { identifier: number; x: number; y: number; force?: number }[],
    timestamp: Date.now(),
  })

  // 入力イベントキューの作成
  const inputEventQueue = yield* Queue.bounded<InputEvent>(1000)

  // リアルタイム入力処理ストリーム
  const inputProcessingStream = yield* Effect.gen(function* () {
    return Stream.fromQueue(inputEventQueue).pipe(
      Stream.debounce(Duration.millis(16)), // 60FPS制約
      Stream.mapEffect((event) =>
        Effect.gen(function* () {
          yield* processInputEvent(event, inputState)
          return event
        })
      )
    )
  })

  // DOM イベントリスナーの設定
  yield* setupDOMEventListeners(inputEventQueue)

  // ゲームパッド ポーリング
  yield* Effect.forkDaemon(
    Effect.schedule(
      Effect.gen(function* () {
        yield* pollGamepadState(inputState)
      }),
      Schedule.fixed(Duration.millis(16)) // 60FPS
    )
  )

  // 入力処理ストリームの開始
  yield* Effect.forkDaemon(Stream.runDrain(inputProcessingStream))

  return InputService.of({
    isKeyPressed: (key: string) =>
      Ref.get(inputState).pipe(
        Effect.map((state) => state.keys.has(key as KeyCode)),
        Effect.mapError(() =>
          InputSystemError({
            message: `Failed to check key state`,
            key,
          })
        )
      ),

    isMousePressed: (button: number) =>
      Ref.get(inputState).pipe(
        Effect.map((state) => {
          const buttonName = button === 0 ? 'left' : button === 1 ? 'middle' : 'right'
          return state.mouseButtons.has(buttonName)
        }),
        Effect.mapError(() =>
          InputSystemError({
            message: `Failed to check mouse button state`,
            button,
          })
        )
      ),

    getMouseDelta: () =>
      Ref.get(inputState).pipe(
        Effect.map(
          (state) =>
            ({
              deltaX: state.mouseDelta.deltaX,
              deltaY: state.mouseDelta.deltaY,
              timestamp: state.timestamp,
            }) as MouseDelta
        ),
        Effect.mapError(() =>
          InputSystemError({
            message: `Failed to get mouse delta`,
          })
        )
      ),

    registerHandler: (handler) =>
      Effect.gen(function* () {
        yield* Effect.log('InputHandler registered with advanced processing')
        // 実装: ハンドラーを入力処理パイプラインに統合
      }).pipe(
        Effect.mapError(() =>
          InputHandlerRegistrationError({
            message: `Failed to register input handler`,
          })
        )
      ),
  })
})

// DOM イベントリスナーのセットアップ
const setupDOMEventListeners = (queue: Queue.Queue<InputEvent>) =>
  Effect.gen(function* () {
    // キーボードイベント
    const handleKeyDown = (e: KeyboardEvent) => {
      const event: InputEvent = {
        _tag: 'KeyPressed',
        keyCode: e.code as KeyCode,
        modifiers: {
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          meta: e.metaKey,
        },
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const event: InputEvent = {
        _tag: 'KeyReleased',
        keyCode: e.code as KeyCode,
        modifiers: {
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          meta: e.metaKey,
        },
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    // マウスイベント
    const handleMouseDown = (e: MouseEvent) => {
      const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right'
      const event: InputEvent = {
        _tag: 'MouseButtonPressed',
        button,
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    const handleMouseUp = (e: MouseEvent) => {
      const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right'
      const event: InputEvent = {
        _tag: 'MouseButtonReleased',
        button,
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    const handleMouseMove = (e: MouseEvent) => {
      const event: InputEvent = {
        _tag: 'MouseMoved',
        x: e.clientX,
        y: e.clientY,
        deltaX: e.movementX,
        deltaY: e.movementY,
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    // タッチイベント
    const handleTouchStart = (e: TouchEvent) => {
      const touches = Array.from(e.touches).map((touch) => ({
        identifier: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        force: touch.force,
      }))
      const event: InputEvent = {
        _tag: 'TouchStart',
        touches,
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touches = Array.from(e.touches).map((touch) => ({
        identifier: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        force: touch.force,
      }))
      const event: InputEvent = {
        _tag: 'TouchMove',
        touches,
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touches = Array.from(e.changedTouches).map((touch) => ({
        identifier: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        force: touch.force,
      }))
      const event: InputEvent = {
        _tag: 'TouchEnd',
        touches,
        timestamp: Date.now() as InputTimestamp,
      }
      Queue.unsafeOffer(queue, event)
    }

    // イベントリスナーの登録
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)

    // ポインターロックの設定
    yield* Effect.gen(function* () {
      const canvas = document.querySelector('canvas')
      if (canvas) {
        canvas.addEventListener('click', () => {
          canvas.requestPointerLock()
        })
      }
    })

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
        document.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('touchstart', handleTouchStart)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      })
    )
  })

// 入力イベント処理
const processInputEvent = (event: InputEvent, inputStateRef: Ref.Ref<InputState>) =>
  Effect.gen(function* () {
    yield* Ref.update(inputStateRef, (state): InputState => {
      const newState: InputState = {
        ...state,
        timestamp: event.timestamp as number,
      }

      switch (event._tag) {
        case 'KeyPressed':
          return {
            ...newState,
            keys: new Set([...state.keys, event.keyCode]),
          }
        case 'KeyReleased':
          return {
            ...newState,
            keys: new Set([...state.keys].filter((k) => k !== event.keyCode)),
          }
        case 'MouseButtonPressed':
          return {
            ...newState,
            mouseButtons: new Set([...state.mouseButtons, event.button]),
          }
        case 'MouseButtonReleased':
          return {
            ...newState,
            mouseButtons: new Set([...state.mouseButtons].filter((b) => b !== event.button)),
          }
        case 'MouseMoved':
          return {
            ...newState,
            mousePosition: { x: event.x, y: event.y },
            mouseDelta: { deltaX: event.deltaX, deltaY: event.deltaY },
          }
        case 'GamepadButtonPressed':
          return {
            ...newState,
            gamepadButtons: new Set([...state.gamepadButtons, event.buttonId]),
          }
        case 'GamepadButtonReleased':
          return {
            ...newState,
            gamepadButtons: new Set([...state.gamepadButtons].filter((b) => b !== event.buttonId)),
          }
        case 'GamepadAxisMove':
          const newAxes = [...state.gamepadAxes]
          newAxes[event.axisId] = event.value
          return {
            ...newState,
            gamepadAxes: newAxes,
          }
        case 'TouchStart':
        case 'TouchMove':
          return {
            ...newState,
            touchPoints: event.touches.map((touch) => ({
              identifier: touch.identifier,
              x: touch.x,
              y: touch.y,
              force: touch.force || undefined,
            })),
          }
        case 'TouchEnd':
          return {
            ...newState,
            touchPoints: [],
          }
        default:
          return newState
      }
    })
  })

// ゲームパッド状態ポーリング
const pollGamepadState = (inputStateRef: Ref.Ref<InputState>) =>
  Effect.gen(function* () {
    const gamepads = navigator.getGamepads()

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i]
      if (!gamepad) continue

      // ボタン状態のチェック
      gamepad.buttons.forEach((button, index) => {
        if (button.pressed) {
          // ボタンが押された場合の処理
        }
      })

      // 軸状態のチェック
      gamepad.axes.forEach((value, index) => {
        if (Math.abs(value) > 0.1) {
          // デッドゾーン
          // 軸が動いた場合の処理
        }
      })
    }
  })

/**
 * InputServiceLive Layer
 */
export const InputServiceLive = Layer.scoped(InputService, makeInputServiceLive)
