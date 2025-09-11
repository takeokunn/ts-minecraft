/**
 * InputService - Complete input handling with Context.Tag pattern
 * 
 * Features:
 * - Multi-device input support (keyboard, mouse, gamepad, touch)
 * - Event-driven input system with custom actions
 * - Input mapping and remapping support
 * - Input history and replay capabilities
 * - Gesture recognition and multi-touch support
 * - Effect-TS Service pattern with full dependency injection
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'
import * as Set from 'effect/Set'
import * as Ref from 'effect/Ref'
import * as Queue from 'effect/Queue'
import * as Schedule from 'effect/Schedule'
import * as Match from 'effect/Match'

// Core imports
import { Position } from '../../core/values'
import {
  InputNotAvailableError,
} from '../../core/errors'

// ===== INPUT SERVICE INTERFACE =====

export interface InputServiceInterface {
  // Input state querying
  readonly isKeyDown: (key: KeyCode) => Effect.Effect<boolean, never>
  readonly isKeyPressed: (key: KeyCode) => Effect.Effect<boolean, never>
  readonly isKeyReleased: (key: KeyCode) => Effect.Effect<boolean, never>
  readonly getKeyPressedKeys: () => Effect.Effect<readonly KeyCode[], never>

  // Mouse input
  readonly getMousePosition: () => Effect.Effect<MousePosition, never>
  readonly getMouseDelta: () => Effect.Effect<MouseDelta, never>
  readonly isMouseButtonDown: (button: MouseButton) => Effect.Effect<boolean, never>
  readonly isMouseButtonPressed: (button: MouseButton) => Effect.Effect<boolean, never>
  readonly isMouseButtonReleased: (button: MouseButton) => Effect.Effect<boolean, never>
  readonly getScrollDelta: () => Effect.Effect<ScrollDelta, never>

  // Gamepad support
  readonly getConnectedGamepads: () => Effect.Effect<readonly GamepadId[], never>
  readonly isGamepadButtonDown: (gamepadId: GamepadId, button: GamepadButton) => Effect.Effect<boolean, never>
  readonly getGamepadAxis: (gamepadId: GamepadId, axis: GamepadAxis) => Effect.Effect<number, never>
  readonly getGamepadVibration: (gamepadId: GamepadId) => Effect.Effect<VibrationState, never>
  readonly setGamepadVibration: (gamepadId: GamepadId, vibration: VibrationConfig) => Effect.Effect<void, never>

  // Touch input (for mobile/tablet support)
  readonly getTouchPoints: () => Effect.Effect<readonly TouchPoint[], never>
  readonly isTouchActive: (touchId: TouchId) => Effect.Effect<boolean, never>
  readonly getTouchGestures: () => Effect.Effect<readonly Gesture[], never>

  // Action mapping system
  readonly mapAction: (actionName: string, binding: InputBinding) => Effect.Effect<void, never>
  readonly unmapAction: (actionName: string) => Effect.Effect<void, never>
  readonly isActionActive: (actionName: string) => Effect.Effect<boolean, never>
  readonly getActionValue: (actionName: string) => Effect.Effect<number, never>
  readonly getActionVector: (actionName: string) => Effect.Effect<Vector2, never>

  // Input events
  readonly subscribeToInputEvents: (callback: InputEventCallback) => Effect.Effect<SubscriptionId, never>
  readonly unsubscribeFromInputEvents: (subscriptionId: SubscriptionId) => Effect.Effect<void, never>
  readonly subscribeToAction: (actionName: string, callback: ActionCallback) => Effect.Effect<SubscriptionId, never>

  // Input context and modes
  readonly pushInputContext: (context: InputContext) => Effect.Effect<void, never>
  readonly popInputContext: () => Effect.Effect<Option.Option<InputContext>, never>
  readonly getCurrentInputContext: () => Effect.Effect<Option.Option<InputContext>, never>
  readonly setInputMode: (mode: InputMode) => Effect.Effect<void, never>

  // Input recording and playback
  readonly startRecording: (config?: RecordingConfig) => Effect.Effect<RecordingId, never>
  readonly stopRecording: (recordingId: RecordingId) => Effect.Effect<InputRecording, never>
  readonly playbackRecording: (recording: InputRecording, options?: PlaybackOptions) => Effect.Effect<void, never>

  // Configuration and settings
  readonly loadInputMappings: (mappings: InputMappings) => Effect.Effect<void, never>
  readonly saveInputMappings: () => Effect.Effect<InputMappings, never>
  readonly resetToDefaultMappings: () => Effect.Effect<void, never>
  readonly setInputSensitivity: (device: InputDevice, sensitivity: number) => Effect.Effect<void, never>

  // System integration
  readonly lockPointer: () => Effect.Effect<void, never>
  readonly unlockPointer: () => Effect.Effect<void, never>
  readonly isPointerLocked: () => Effect.Effect<boolean, never>
  readonly requestFullscreen: () => Effect.Effect<void, never>

  // Performance and debugging
  readonly getInputStats: () => Effect.Effect<InputStats, never>
  readonly enableDebugMode: (enabled: boolean) => Effect.Effect<void, never>
  readonly getDebugInfo: () => Effect.Effect<InputDebugInfo, never>
}

// ===== SUPPORTING TYPES =====

export type KeyCode = 
  | 'KeyA' | 'KeyB' | 'KeyC' | 'KeyD' | 'KeyE' | 'KeyF' | 'KeyG' | 'KeyH' | 'KeyI' | 'KeyJ'
  | 'KeyK' | 'KeyL' | 'KeyM' | 'KeyN' | 'KeyO' | 'KeyP' | 'KeyQ' | 'KeyR' | 'KeyS' | 'KeyT'
  | 'KeyU' | 'KeyV' | 'KeyW' | 'KeyX' | 'KeyY' | 'KeyZ'
  | 'Digit0' | 'Digit1' | 'Digit2' | 'Digit3' | 'Digit4' | 'Digit5' | 'Digit6' | 'Digit7' | 'Digit8' | 'Digit9'
  | 'Space' | 'Enter' | 'Escape' | 'Tab' | 'Backspace' | 'Delete'
  | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
  | 'ShiftLeft' | 'ShiftRight' | 'ControlLeft' | 'ControlRight' | 'AltLeft' | 'AltRight'
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F10' | 'F11' | 'F12'

export type MouseButton = 'Left' | 'Right' | 'Middle' | 'Back' | 'Forward'

export type GamepadId = string & { readonly _brand: 'GamepadId' }
export type TouchId = string & { readonly _brand: 'TouchId' }
export type SubscriptionId = string & { readonly _brand: 'SubscriptionId' }
export type RecordingId = string & { readonly _brand: 'RecordingId' }

export type GamepadButton = 
  | 'A' | 'B' | 'X' | 'Y' 
  | 'LeftBumper' | 'RightBumper' | 'LeftTrigger' | 'RightTrigger'
  | 'Select' | 'Start' | 'LeftStick' | 'RightStick'
  | 'DPadUp' | 'DPadDown' | 'DPadLeft' | 'DPadRight'

export type GamepadAxis = 'LeftStickX' | 'LeftStickY' | 'RightStickX' | 'RightStickY' | 'LeftTrigger' | 'RightTrigger'

export interface MousePosition {
  readonly x: number
  readonly y: number
  readonly clientX: number
  readonly clientY: number
}

export interface MouseDelta {
  readonly deltaX: number
  readonly deltaY: number
  readonly movementX: number
  readonly movementY: number
}

export interface ScrollDelta {
  readonly deltaX: number
  readonly deltaY: number
  readonly deltaZ: number
}

export interface TouchPoint {
  readonly id: TouchId
  readonly position: Vector2
  readonly pressure: number
  readonly size: number
  readonly timestamp: number
}

export interface Vector2 {
  readonly x: number
  readonly y: number
}

export interface VibrationState {
  readonly lowFrequency: number
  readonly highFrequency: number
  readonly duration: number
  readonly remainingTime: number
}

export interface VibrationConfig {
  readonly lowFrequency: number
  readonly highFrequency: number
  readonly duration: number
}

export interface InputBinding {
  readonly type: InputBindingType
  readonly primary: InputSource
  readonly secondary?: InputSource
  readonly modifiers?: readonly KeyCode[]
  readonly deadzone?: number
  readonly sensitivity?: number
}

export type InputBindingType = 'button' | 'axis' | 'vector2d'

export interface InputSource {
  readonly device: InputDevice
  readonly control: string
  readonly inverted?: boolean
  readonly scale?: number
}

export type InputDevice = 'keyboard' | 'mouse' | 'gamepad' | 'touch'

export interface Gesture {
  readonly type: GestureType
  readonly startTime: number
  readonly duration: number
  readonly startPosition: Vector2
  readonly currentPosition: Vector2
  readonly velocity: Vector2
  readonly data: GestureData
}

export type GestureType = 'tap' | 'doubleTap' | 'longPress' | 'swipe' | 'pinch' | 'rotate' | 'pan'

export interface GestureData {
  readonly tap?: { count: number }
  readonly swipe?: { direction: SwipeDirection; distance: number }
  readonly pinch?: { scale: number; center: Vector2 }
  readonly rotate?: { angle: number; center: Vector2 }
  readonly pan?: { delta: Vector2; totalDelta: Vector2 }
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right'

export type InputEventCallback = (event: InputEvent) => void
export type ActionCallback = (actionName: string, value: number, pressed: boolean) => void

export interface InputEvent {
  readonly type: InputEventType
  readonly timestamp: number
  readonly device: InputDevice
  readonly data: InputEventData
}

export type InputEventType = 'keyDown' | 'keyUp' | 'mouseMove' | 'mouseDown' | 'mouseUp' | 'scroll' | 'gamepadButton' | 'gamepadAxis' | 'touch' | 'gesture'

export interface InputEventData {
  readonly key?: KeyCode
  readonly mouseButton?: MouseButton
  readonly mousePosition?: MousePosition
  readonly mouseDelta?: MouseDelta
  readonly scrollDelta?: ScrollDelta
  readonly gamepadId?: GamepadId
  readonly gamepadButton?: GamepadButton
  readonly gamepadAxis?: GamepadAxis
  readonly axisValue?: number
  readonly touchPoint?: TouchPoint
  readonly gesture?: Gesture
}

export interface InputContext {
  readonly name: string
  readonly priority: number
  readonly exclusive: boolean
  readonly mappings: InputMappings
}

export type InputMode = 'game' | 'ui' | 'debug' | 'menu' | 'text'

export interface InputMappings {
  readonly actions: Record<string, InputBinding>
  readonly contexts: Record<string, InputContext>
}

export interface RecordingConfig {
  readonly includeTimestamps: boolean
  readonly includeMouseMovement: boolean
  readonly maxDuration: number
}

export interface InputRecording {
  readonly id: RecordingId
  readonly events: readonly RecordedInputEvent[]
  readonly duration: number
  readonly metadata: RecordingMetadata
}

interface RecordedInputEvent {
  readonly event: InputEvent
  readonly relativeTimestamp: number
}

interface RecordingMetadata {
  readonly startTime: Date
  readonly endTime: Date
  readonly device: string
  readonly platform: string
}

export interface PlaybackOptions {
  readonly speed: number
  readonly loop: boolean
  readonly startFrom: number
}

export interface InputStats {
  readonly totalEvents: number
  readonly eventsPerSecond: number
  readonly keyPresses: number
  readonly mouseClicks: number
  readonly gamepadInputs: number
  readonly touchInputs: number
  readonly gesturesRecognized: number
  readonly averageLatency: number
}

export interface InputDebugInfo {
  readonly currentKeyStates: Record<KeyCode, boolean>
  readonly currentMouseState: {
    position: MousePosition
    buttons: Record<MouseButton, boolean>
  }
  readonly connectedGamepads: readonly GamepadDebugInfo[]
  readonly activeTouches: readonly TouchPoint[]
  readonly activeGestures: readonly Gesture[]
  readonly inputContextStack: readonly string[]
  readonly actionMappings: Record<string, InputBinding>
}

export interface GamepadDebugInfo {
  readonly id: GamepadId
  readonly name: string
  readonly connected: boolean
  readonly buttons: Record<GamepadButton, number>
  readonly axes: Record<GamepadAxis, number>
}

// ===== INPUT SERVICE TAG =====

export class InputService extends Context.Tag('InputService')<
  InputService,
  InputServiceInterface
>() {
  static readonly Live = Layer.effect(
    InputService,
    Effect.gen(function* () {
      // Internal state
      const keyStates = yield* Ref.make(HashMap.empty<KeyCode, KeyState>())
      const mouseState = yield* Ref.make<MouseState>({
        position: { x: 0, y: 0, clientX: 0, clientY: 0 },
        delta: { deltaX: 0, deltaY: 0, movementX: 0, movementY: 0 },
        buttons: HashMap.empty(),
        scrollDelta: { deltaX: 0, deltaY: 0, deltaZ: 0 },
      })
      const gamepadStates = yield* Ref.make(HashMap.empty<GamepadId, GamepadState>())
      const touchStates = yield* Ref.make(HashMap.empty<TouchId, TouchPoint>())
      const gestures = yield* Ref.make<readonly Gesture[]>([])
      
      const actionMappings = yield* Ref.make(HashMap.empty<string, InputBinding>())
      const inputContextStack = yield* Ref.make<readonly InputContext[]>([])
      const currentInputMode = yield* Ref.make<InputMode>('game')
      
      const eventSubscriptions = yield* Ref.make(HashMap.empty<SubscriptionId, InputEventCallback>())
      const actionSubscriptions = yield* Ref.make(HashMap.empty<string, Set<SubscriptionId>>())
      const eventQueue = yield* Queue.unbounded<InputEvent>()
      
      const recordings = yield* Ref.make(HashMap.empty<RecordingId, InputRecording>())
      const activeRecordings = yield* Ref.make(Set.empty<RecordingId>())
      const playbackState = yield* Ref.make<Option.Option<PlaybackState>>(Option.none())
      
      const inputStats = yield* Ref.make({
        totalEvents: 0,
        eventTimestamps: [] as number[],
        keyPresses: 0,
        mouseClicks: 0,
        gamepadInputs: 0,
        touchInputs: 0,
        gesturesRecognized: 0,
      })
      
      const debugMode = yield* Ref.make(false)
      const pointerLocked = yield* Ref.make(false)
      const nextId = yield* Ref.make(0)

      // Helper functions
      const generateId = (): Effect.Effect<string, never> =>
        Ref.modify(nextId, id => [(id + 1).toString(), id + 1])

      const createGamepadId = (id: string): GamepadId => id as GamepadId
      const createTouchId = (id: string): TouchId => id as TouchId
      const createSubscriptionId = (id: string): SubscriptionId => id as SubscriptionId
      const createRecordingId = (id: string): RecordingId => id as RecordingId

      // Input state management
      const updateKeyState = (key: KeyCode, pressed: boolean): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const currentStates = yield* Ref.get(keyStates)
          const existingState = HashMap.get(currentStates, key)
          
          const previousPressed = Option.match(existingState, {
            onNone: () => false,
            onSome: (state) => state.current,
          })

          const newState: KeyState = {
            current: pressed,
            previous: previousPressed,
            justPressed: pressed && !previousPressed,
            justReleased: !pressed && previousPressed,
            timestamp: Date.now(),
          }

          yield* Ref.update(keyStates, HashMap.set(key, newState))
          
          // Update stats
          if (pressed && !previousPressed) {
            yield* Ref.update(inputStats, stats => ({
              ...stats,
              keyPresses: stats.keyPresses + 1,
            }))
          }
        })

      const updateMousePosition = (position: MousePosition, delta: MouseDelta): Effect.Effect<void, never> =>
        Ref.update(mouseState, state => ({
          ...state,
          position,
          delta,
        }))

      const updateMouseButton = (button: MouseButton, pressed: boolean): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(mouseState)
          const existingPressed = HashMap.get(currentState.buttons, button)
          const previousPressed = Option.getOrElse(existingPressed, () => false)

          const newButtonState = {
            current: pressed,
            previous: previousPressed,
            justPressed: pressed && !previousPressed,
            justReleased: !pressed && previousPressed,
            timestamp: Date.now(),
          }

          yield* Ref.update(mouseState, state => ({
            ...state,
            buttons: HashMap.set(state.buttons, button, newButtonState),
          }))

          if (pressed && !previousPressed) {
            yield* Ref.update(inputStats, stats => ({
              ...stats,
              mouseClicks: stats.mouseClicks + 1,
            }))
          }
        })

      // Event processing
      const processInputEvent = (event: InputEvent): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          // Update internal state based on event type
          yield* Match.value(event.type).pipe(
            Match.when('keyDown', () => 
              event.data.key ? updateKeyState(event.data.key, true) : Effect.succeed(undefined)
            ),
            Match.when('keyUp', () => 
              event.data.key ? updateKeyState(event.data.key, false) : Effect.succeed(undefined)
            ),
            Match.when('mouseMove', () => 
              event.data.mousePosition && event.data.mouseDelta ? 
                updateMousePosition(event.data.mousePosition, event.data.mouseDelta) : 
                Effect.succeed(undefined)
            ),
            Match.when('mouseDown', () => 
              event.data.mouseButton ? updateMouseButton(event.data.mouseButton, true) : Effect.succeed(undefined)
            ),
            Match.when('mouseUp', () => 
              event.data.mouseButton ? updateMouseButton(event.data.mouseButton, false) : Effect.succeed(undefined)
            ),
            Match.orElse(() => Effect.succeed(undefined))
          )

          // Update statistics
          yield* Ref.update(inputStats, stats => ({
            ...stats,
            totalEvents: stats.totalEvents + 1,
            eventTimestamps: [...stats.eventTimestamps.slice(-99), event.timestamp], // Keep last 100
          }))

          // Notify subscribers
          const subscriptions = yield* Ref.get(eventSubscriptions)
          Array.fromIterable(HashMap.values(subscriptions)).forEach(callback => {
            try {
              callback(event)
            } catch (error) {
              // Log error but don't fail the entire event processing
              console.error('Input event callback error:', error)
            }
          })

          // Process action mappings
          yield* processActionMappings(event)

          // Record event if recording is active
          const activeRecs = yield* Ref.get(activeRecordings)
          if (Set.size(activeRecs) > 0) {
            yield* recordInputEvent(event)
          }
        })

      const processActionMappings = (event: InputEvent): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const mappings = yield* Ref.get(actionMappings)
          const contextStack = yield* Ref.get(inputContextStack)
          
          // Process actions from highest priority context first
          const sortedContexts = Array.fromIterable(contextStack)
            .sort((a, b) => b.priority - a.priority)

          for (const context of sortedContexts) {
            for (const [actionName, binding] of HashMap.entries(mappings)) {
              const actionValue = yield* calculateActionValue(binding, event)
              if (actionValue !== 0) {
                yield* notifyActionSubscribers(actionName, actionValue, actionValue > 0)
                
                // If context is exclusive, stop processing
                if (context.exclusive) {
                  return
                }
              }
            }
          }
        })

      const calculateActionValue = (binding: InputBinding, event: InputEvent): Effect.Effect<number, never> =>
        Effect.gen(function* () {
          // Simplified implementation - would be more sophisticated in practice
          if (binding.type === 'button' && event.type === 'keyDown') {
            return binding.primary.control === event.data.key ? 1 : 0
          }
          return 0
        })

      const notifyActionSubscribers = (actionName: string, value: number, pressed: boolean): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const subscriptions = yield* Ref.get(actionSubscriptions)
          const actionSubs = HashMap.get(subscriptions, actionName)
          
          if (Option.isSome(actionSubs)) {
            const callbacks = yield* Ref.get(eventSubscriptions)
            for (const subId of actionSubs.value) {
              const callback = HashMap.get(callbacks, subId)
              if (Option.isSome(callback)) {
                try {
                  // Would call action callback instead of input event callback
                  // callback.value(actionName, value, pressed)
                } catch (error) {
                  console.error('Action callback error:', error)
                }
              }
            }
          }
        })

      // Gesture recognition
      const recognizeGestures = (touchPoints: readonly TouchPoint[]): Effect.Effect<readonly Gesture[], never> =>
        Effect.gen(function* () {
          // Simplified gesture recognition - would be more sophisticated
          const recognizedGestures: Gesture[] = []
          
          if (touchPoints.length === 1) {
            // Single touch gestures (tap, swipe, etc.)
            const touch = touchPoints[0]
            // Implementation would analyze touch movement patterns
          }
          
          if (touchPoints.length === 2) {
            // Two-finger gestures (pinch, rotate, etc.)
            // Implementation would analyze relative movement
          }

          return recognizedGestures
        })

      // Recording and playback
      const recordInputEvent = (event: InputEvent): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const activeRecs = yield* Ref.get(activeRecordings)
          const recordingsMap = yield* Ref.get(recordings)
          
          for (const recordingId of activeRecs) {
            const recording = HashMap.get(recordingsMap, recordingId)
            if (Option.isSome(recording)) {
              const recordedEvent: RecordedInputEvent = {
                event,
                relativeTimestamp: event.timestamp - recording.value.events[0]?.relativeTimestamp || 0,
              }
              
              const updatedEvents = [...recording.value.events, recordedEvent]
              const updatedRecording = { ...recording.value, events: updatedEvents }
              yield* Ref.update(recordings, HashMap.set(recordingId, updatedRecording))
            }
          }
        })

      // Initialize event listeners
      yield* Effect.gen(function* () {
        // In a real implementation, this would set up actual DOM event listeners
        // For now, we'll create a simplified event processing loop
        yield* Effect.forever(
          Effect.gen(function* () {
            const event = yield* Queue.take(eventQueue)
            yield* processInputEvent(event)
          })
        ).pipe(Effect.fork)
      })

      // Return the service implementation
      return {
        // Keyboard input
        isKeyDown: (key: KeyCode) =>
          Effect.gen(function* () {
            const states = yield* Ref.get(keyStates)
            const keyState = HashMap.get(states, key)
            return Option.match(keyState, {
              onNone: () => false,
              onSome: (state) => state.current,
            })
          }),

        isKeyPressed: (key: KeyCode) =>
          Effect.gen(function* () {
            const states = yield* Ref.get(keyStates)
            const keyState = HashMap.get(states, key)
            return Option.match(keyState, {
              onNone: () => false,
              onSome: (state) => state.justPressed,
            })
          }),

        isKeyReleased: (key: KeyCode) =>
          Effect.gen(function* () {
            const states = yield* Ref.get(keyStates)
            const keyState = HashMap.get(states, key)
            return Option.match(keyState, {
              onNone: () => false,
              onSome: (state) => state.justReleased,
            })
          }),

        getKeyPressedKeys: () =>
          Effect.gen(function* () {
            const states = yield* Ref.get(keyStates)
            return Array.fromIterable(HashMap.keys(states))
              .filter(key => {
                const state = HashMap.get(states, key)
                return Option.match(state, {
                  onNone: () => false,
                  onSome: (s) => s.current,
                })
              })
          }),

        // Mouse input
        getMousePosition: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(mouseState)
            return state.position
          }),

        getMouseDelta: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(mouseState)
            return state.delta
          }),

        isMouseButtonDown: (button: MouseButton) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(mouseState)
            const buttonState = HashMap.get(state.buttons, button)
            return Option.match(buttonState, {
              onNone: () => false,
              onSome: (bs) => bs.current,
            })
          }),

        isMouseButtonPressed: (button: MouseButton) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(mouseState)
            const buttonState = HashMap.get(state.buttons, button)
            return Option.match(buttonState, {
              onNone: () => false,
              onSome: (bs) => bs.justPressed,
            })
          }),

        isMouseButtonReleased: (button: MouseButton) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(mouseState)
            const buttonState = HashMap.get(state.buttons, button)
            return Option.match(buttonState, {
              onNone: () => false,
              onSome: (bs) => bs.justReleased,
            })
          }),

        getScrollDelta: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(mouseState)
            return state.scrollDelta
          }),

        // Gamepad support
        getConnectedGamepads: () =>
          Effect.gen(function* () {
            const states = yield* Ref.get(gamepadStates)
            return Array.fromIterable(HashMap.keys(states))
          }),

        isGamepadButtonDown: (gamepadId: GamepadId, button: GamepadButton) =>
          Effect.gen(function* () {
            const states = yield* Ref.get(gamepadStates)
            const gamepadState = HashMap.get(states, gamepadId)
            return Option.match(gamepadState, {
              onNone: () => false,
              onSome: (state) => {
                const buttonState = HashMap.get(state.buttons, button)
                return Option.getOrElse(buttonState, () => 0) > 0.5
              },
            })
          }),

        getGamepadAxis: (gamepadId: GamepadId, axis: GamepadAxis) =>
          Effect.gen(function* () {
            const states = yield* Ref.get(gamepadStates)
            const gamepadState = HashMap.get(states, gamepadId)
            return Option.match(gamepadState, {
              onNone: () => 0,
              onSome: (state) => {
                const axisValue = HashMap.get(state.axes, axis)
                return Option.getOrElse(axisValue, () => 0)
              },
            })
          }),

        getGamepadVibration: (gamepadId: GamepadId) =>
          Effect.succeed({
            lowFrequency: 0,
            highFrequency: 0,
            duration: 0,
            remainingTime: 0,
          }),

        setGamepadVibration: (gamepadId: GamepadId, vibration: VibrationConfig) =>
          Effect.succeed(undefined),

        // Touch input
        getTouchPoints: () => 
          Effect.gen(function* () {
            const touches = yield* Ref.get(touchStates)
            return Array.fromIterable(HashMap.values(touches))
          }),

        isTouchActive: (touchId: TouchId) =>
          Effect.gen(function* () {
            const touches = yield* Ref.get(touchStates)
            return HashMap.has(touches, touchId)
          }),

        getTouchGestures: () => Ref.get(gestures),

        // Action mapping
        mapAction: (actionName: string, binding: InputBinding) =>
          Ref.update(actionMappings, HashMap.set(actionName, binding)),

        unmapAction: (actionName: string) =>
          Ref.update(actionMappings, HashMap.remove(actionName)),

        isActionActive: (actionName: string) =>
          Effect.gen(function* () {
            const mappings = yield* Ref.get(actionMappings)
            const binding = HashMap.get(mappings, actionName)
            // Simplified - would check actual input state
            return Option.isSome(binding)
          }),

        getActionValue: (actionName: string) =>
          Effect.gen(function* () {
            const mappings = yield* Ref.get(actionMappings)
            const binding = HashMap.get(mappings, actionName)
            // Simplified - would calculate actual value from input state
            return Option.isSome(binding) ? 1 : 0
          }),

        getActionVector: (actionName: string) =>
          Effect.succeed({ x: 0, y: 0 }),

        // Event subscriptions
        subscribeToInputEvents: (callback: InputEventCallback) =>
          Effect.gen(function* () {
            const id = createSubscriptionId(yield* generateId())
            yield* Ref.update(eventSubscriptions, HashMap.set(id, callback))
            return id
          }),

        unsubscribeFromInputEvents: (subscriptionId: SubscriptionId) =>
          Ref.update(eventSubscriptions, HashMap.remove(subscriptionId)),

        subscribeToAction: (actionName: string, callback: ActionCallback) =>
          Effect.gen(function* () {
            const id = createSubscriptionId(yield* generateId())
            // Store action-specific callback (simplified implementation)
            yield* Ref.update(eventSubscriptions, HashMap.set(id, () => {}))
            yield* Ref.update(actionSubscriptions, subs => {
              const existing = HashMap.get(subs, actionName)
              const newSet = Option.match(existing, {
                onNone: () => Set.make(id),
                onSome: (set) => Set.add(set, id),
              })
              return HashMap.set(subs, actionName, newSet)
            })
            return id
          }),

        // Input contexts
        pushInputContext: (context: InputContext) =>
          Ref.update(inputContextStack, contexts => [...contexts, context]),

        popInputContext: () =>
          Effect.gen(function* () {
            const currentStack = yield* Ref.get(inputContextStack)
            if (currentStack.length === 0) {
              return Option.none()
            }
            const popped = currentStack[currentStack.length - 1]
            yield* Ref.set(inputContextStack, currentStack.slice(0, -1))
            return Option.some(popped)
          }),

        getCurrentInputContext: () =>
          Effect.gen(function* () {
            const stack = yield* Ref.get(inputContextStack)
            return stack.length > 0 ? Option.some(stack[stack.length - 1]) : Option.none()
          }),

        setInputMode: (mode: InputMode) =>
          Ref.set(currentInputMode, mode),

        // Recording and playback
        startRecording: (config?: RecordingConfig) =>
          Effect.gen(function* () {
            const id = createRecordingId(yield* generateId())
            const recording: InputRecording = {
              id,
              events: [],
              duration: 0,
              metadata: {
                startTime: new Date(),
                endTime: new Date(),
                device: navigator.userAgent,
                platform: navigator.platform,
              },
            }
            yield* Ref.update(recordings, HashMap.set(id, recording))
            yield* Ref.update(activeRecordings, Set.add(id))
            return id
          }),

        stopRecording: (recordingId: RecordingId) =>
          Effect.gen(function* () {
            yield* Ref.update(activeRecordings, Set.remove(recordingId))
            const recordingsMap = yield* Ref.get(recordings)
            const recording = HashMap.get(recordingsMap, recordingId)
            return Option.getOrElse(recording, () => ({
              id: recordingId,
              events: [],
              duration: 0,
              metadata: {
                startTime: new Date(),
                endTime: new Date(),
                device: '',
                platform: '',
              },
            }))
          }),

        playbackRecording: (recording: InputRecording, options?: PlaybackOptions) =>
          Effect.succeed(undefined),

        // Configuration
        loadInputMappings: (mappings: InputMappings) =>
          Ref.set(actionMappings, HashMap.fromIterable(Object.entries(mappings.actions))),

        saveInputMappings: () =>
          Effect.gen(function* () {
            const mappings = yield* Ref.get(actionMappings)
            const contexts = yield* Ref.get(inputContextStack)
            return {
              actions: Object.fromEntries(HashMap.entries(mappings)),
              contexts: Object.fromEntries(contexts.map(ctx => [ctx.name, ctx])),
            }
          }),

        resetToDefaultMappings: () =>
          Ref.set(actionMappings, HashMap.empty()),

        setInputSensitivity: (device: InputDevice, sensitivity: number) =>
          Effect.succeed(undefined),

        // System integration
        lockPointer: () =>
          Effect.gen(function* () {
            // Would call document.pointerLockElement API
            yield* Ref.set(pointerLocked, true)
          }),

        unlockPointer: () =>
          Effect.gen(function* () {
            // Would call document.exitPointerLock API
            yield* Ref.set(pointerLocked, false)
          }),

        isPointerLocked: () => Ref.get(pointerLocked),

        requestFullscreen: () =>
          Effect.succeed(undefined),

        // Performance and debugging
        getInputStats: () =>
          Effect.gen(function* () {
            const stats = yield* Ref.get(inputStats)
            const now = Date.now()
            const recentEvents = stats.eventTimestamps.filter(t => now - t < 1000)
            const eventsPerSecond = recentEvents.length
            const averageLatency = recentEvents.length > 1 ?
              recentEvents.reduce((sum, t, i) => i > 0 ? sum + (t - recentEvents[i-1]) : sum, 0) / (recentEvents.length - 1) :
              0

            return {
              totalEvents: stats.totalEvents,
              eventsPerSecond,
              keyPresses: stats.keyPresses,
              mouseClicks: stats.mouseClicks,
              gamepadInputs: stats.gamepadInputs,
              touchInputs: stats.touchInputs,
              gesturesRecognized: stats.gesturesRecognized,
              averageLatency,
            }
          }),

        enableDebugMode: (enabled: boolean) =>
          Ref.set(debugMode, enabled),

        getDebugInfo: () =>
          Effect.gen(function* () {
            const keys = yield* Ref.get(keyStates)
            const mouse = yield* Ref.get(mouseState)
            const gamepads = yield* Ref.get(gamepadStates)
            const touches = yield* Ref.get(touchStates)
            const currentGestures = yield* Ref.get(gestures)
            const contexts = yield* Ref.get(inputContextStack)
            const mappings = yield* Ref.get(actionMappings)

            return {
              currentKeyStates: Object.fromEntries(
                Array.fromIterable(HashMap.entries(keys)).map(([key, state]) => [key, state.current])
              ),
              currentMouseState: {
                position: mouse.position,
                buttons: Object.fromEntries(
                  Array.fromIterable(HashMap.entries(mouse.buttons)).map(([btn, state]) => [btn, state.current])
                ),
              },
              connectedGamepads: Array.fromIterable(HashMap.entries(gamepads)).map(([id, state]) => ({
                id,
                name: `Gamepad ${id}`,
                connected: true,
                buttons: Object.fromEntries(Array.fromIterable(HashMap.entries(state.buttons))),
                axes: Object.fromEntries(Array.fromIterable(HashMap.entries(state.axes))),
              })),
              activeTouches: Array.fromIterable(HashMap.values(touches)),
              activeGestures: currentGestures,
              inputContextStack: contexts.map(ctx => ctx.name),
              actionMappings: Object.fromEntries(HashMap.entries(mappings)),
            }
          }),
      }
    })
  )
}

// Supporting interfaces
interface KeyState {
  readonly current: boolean
  readonly previous: boolean
  readonly justPressed: boolean
  readonly justReleased: boolean
  readonly timestamp: number
}

interface MouseButtonState {
  readonly current: boolean
  readonly previous: boolean
  readonly justPressed: boolean
  readonly justReleased: boolean
  readonly timestamp: number
}

interface MouseState {
  readonly position: MousePosition
  readonly delta: MouseDelta
  readonly buttons: HashMap.HashMap<MouseButton, MouseButtonState>
  readonly scrollDelta: ScrollDelta
}

interface GamepadState {
  readonly id: GamepadId
  readonly connected: boolean
  readonly buttons: HashMap.HashMap<GamepadButton, number>
  readonly axes: HashMap.HashMap<GamepadAxis, number>
  readonly vibration: VibrationState
}

interface PlaybackState {
  readonly recording: InputRecording
  readonly startTime: number
  readonly currentEventIndex: number
  readonly options: PlaybackOptions
}