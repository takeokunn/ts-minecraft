import { Effect, Layer, Option, HashMap, HashSet, Schema, MutableRef } from 'effect'
import { PlayerInputService } from '@ts-minecraft/entity'
import type { MouseDelta } from '@ts-minecraft/entity'
export type { MouseDelta } from '@ts-minecraft/entity'
export { MouseDeltaSchema } from '@ts-minecraft/entity'

export const MouseButtonSchema = Schema.Literal(0, 1, 2)
export type MouseButton = Schema.Schema.Type<typeof MouseButtonSchema>
export const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const

const GAMEPAD_STICK_DEADZONE = 0.15
const GAMEPAD_TRIGGER_DEADZONE = 0.1
const GAMEPAD_LOOK_SENSITIVITY = 14
const GAMEPAD_WHEEL_STEP = 120

const GAMEPAD_KEY_BINDINGS = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sneak: 'ShiftLeft',
  sprint: 'ControlLeft',
  inventory: 'KeyE',
  drop: 'KeyQ',
  menu: 'Escape',
  hud: 'F1',
  camera: 'F5',
} as const

const normalizeAxis = (value: number, deadzone: number): number => {
  const magnitude = Math.abs(value)
  if (magnitude < deadzone) return 0
  const scaled = (magnitude - deadzone) / (1 - deadzone)
  return Math.sign(value) * scaled
}

const isButtonPressed = (button: GamepadButton | undefined, deadzone = 0.5): boolean =>
  button !== undefined && (button.pressed || button.value >= deadzone)

const cloneSet = <T>(values: Set<T>): Set<T> => new Set(values)
const cloneMap = <K, V>(values: Map<K, V>): Map<K, V> => new Map(values)

const readConnectedGamepads = (): Gamepad[] => {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return []
  }

  const gamepads = navigator.getGamepads()
  const connectedGamepads: Gamepad[] = []

  for (let index = 0; index < gamepads.length; index += 1) {
    const gamepad = gamepads[index]
    if (gamepad !== null && gamepad !== undefined && gamepad.connected) {
      connectedGamepads.push(gamepad)
    }
  }

  return connectedGamepads
}

const collectGamepadState = () => {
  const pressedKeys = new Set<string>()
  const mouseButtons = new Map<number, boolean>()
  const wheelButtons = new Set<number>()
  let mouseDeltaX = 0
  let mouseDeltaY = 0

  for (const gamepad of readConnectedGamepads()) {
    const leftX = normalizeAxis(gamepad.axes[0] ?? 0, GAMEPAD_STICK_DEADZONE)
    const leftY = normalizeAxis(gamepad.axes[1] ?? 0, GAMEPAD_STICK_DEADZONE)
    const rightX = normalizeAxis(gamepad.axes[2] ?? 0, GAMEPAD_STICK_DEADZONE)
    const rightY = normalizeAxis(gamepad.axes[3] ?? 0, GAMEPAD_STICK_DEADZONE)

    if (leftY < 0) pressedKeys.add(GAMEPAD_KEY_BINDINGS.forward)
    if (leftY > 0) pressedKeys.add(GAMEPAD_KEY_BINDINGS.backward)
    if (leftX < 0) pressedKeys.add(GAMEPAD_KEY_BINDINGS.left)
    if (leftX > 0) pressedKeys.add(GAMEPAD_KEY_BINDINGS.right)
    if (isButtonPressed(gamepad.buttons[12])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.forward)
    if (isButtonPressed(gamepad.buttons[13])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.backward)
    if (isButtonPressed(gamepad.buttons[14])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.left)
    if (isButtonPressed(gamepad.buttons[15])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.right)

    if (isButtonPressed(gamepad.buttons[0])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.jump)
    if (isButtonPressed(gamepad.buttons[1])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.sneak)
    if (isButtonPressed(gamepad.buttons[10])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.sprint)
    if (isButtonPressed(gamepad.buttons[2])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.drop)
    if (isButtonPressed(gamepad.buttons[3])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.inventory)
    if (isButtonPressed(gamepad.buttons[8])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.hud)
    if (isButtonPressed(gamepad.buttons[9])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.menu)
    if (isButtonPressed(gamepad.buttons[11])) pressedKeys.add(GAMEPAD_KEY_BINDINGS.camera)

    if (isButtonPressed(gamepad.buttons[6], GAMEPAD_TRIGGER_DEADZONE)) {
      mouseButtons.set(MouseButton.RIGHT, true)
    }

    if (isButtonPressed(gamepad.buttons[7], GAMEPAD_TRIGGER_DEADZONE)) {
      mouseButtons.set(MouseButton.LEFT, true)
    }

    if (isButtonPressed(gamepad.buttons[4])) {
      wheelButtons.add(4)
    }

    if (isButtonPressed(gamepad.buttons[5])) {
      wheelButtons.add(5)
    }

    mouseDeltaX += rightX * GAMEPAD_LOOK_SENSITIVITY
    mouseDeltaY += rightY * GAMEPAD_LOOK_SENSITIVITY
  }

  return { pressedKeys, mouseButtons, wheelButtons, mouseDelta: { x: mouseDeltaX, y: mouseDeltaY } }
}

// Scoped: DOM event listeners removed when the scope closes (HMR, test teardown).
export class InputService extends Effect.Service<InputService>()(
  '@minecraft/presentation/InputService',
  {
    scoped: Effect.gen(function* () {
      // Refs for all mutable input state — DOM handlers use Effect.runSync for synchronous access
      const pressedKeysRef = yield* Effect.sync(() => MutableRef.make(HashSet.empty<string>()))
      // Track keys that were just pressed this frame (for consumeKeyPress)
      const justPressedKeysRef = yield* Effect.sync(() => MutableRef.make(HashSet.empty<string>()))
      const mouseDeltaRef = yield* Effect.sync(() => MutableRef.make({ x: 0, y: 0 }))
      // Track mouse button state (0=left, 1=middle, 2=right)
      const mouseButtonsRef = yield* Effect.sync(() => MutableRef.make(HashMap.empty<number, boolean>()))
      // Track mouse buttons that were just clicked this frame (for consumeMouseClick)
      const justClickedButtonsRef = yield* Effect.sync(() => MutableRef.make(HashSet.empty<number>()))
      // Accumulated mouse wheel delta (positive = scroll down)
      const wheelDeltaRef = yield* Effect.sync(() => MutableRef.make(0))
      // Fallback pointer-lock state for environments that deny the browser API (eg. MCP)
      const pointerLockFallbackRef = yield* Effect.sync(() => MutableRef.make(false))
      const gamepadPressedKeysRef = yield* Effect.sync(() => MutableRef.make(new Set<string>()))
      const gamepadJustPressedKeysRef = yield* Effect.sync(() => MutableRef.make(new Set<string>()))
      const gamepadMouseButtonsRef = yield* Effect.sync(() => MutableRef.make(new Map<number, boolean>()))
      const gamepadJustClickedButtonsRef = yield* Effect.sync(() => MutableRef.make(new Set<number>()))
      const gamepadPreviousPressedKeysRef = yield* Effect.sync(() => MutableRef.make(new Set<string>()))
      const gamepadPreviousMouseButtonsRef = yield* Effect.sync(() => MutableRef.make(new Map<number, boolean>()))
      const gamepadPreviousWheelButtonsRef = yield* Effect.sync(() => MutableRef.make(new Set<number>()))

      const syncGamepadState = () => {
        const { pressedKeys, mouseButtons, wheelButtons } = collectGamepadState()
        const previousPressedKeys = MutableRef.get(gamepadPreviousPressedKeysRef)
        const previousMouseButtons = MutableRef.get(gamepadPreviousMouseButtonsRef)
        const previousWheelButtons = MutableRef.get(gamepadPreviousWheelButtonsRef)

        const nextJustPressedKeys = cloneSet(MutableRef.get(gamepadJustPressedKeysRef))
        for (const key of pressedKeys) {
          if (!previousPressedKeys.has(key)) {
            nextJustPressedKeys.add(key)
          }
        }

        const nextJustClickedButtons = cloneSet(MutableRef.get(gamepadJustClickedButtonsRef))
        for (const [button, pressed] of mouseButtons.entries()) {
          if (pressed && previousMouseButtons.get(button) !== true) {
            nextJustClickedButtons.add(button)
          }
        }

        for (const wheelButton of wheelButtons) {
          if (!previousWheelButtons.has(wheelButton)) {
            MutableRef.set(
              wheelDeltaRef,
              MutableRef.get(wheelDeltaRef) + (wheelButton === 4 ? -GAMEPAD_WHEEL_STEP : GAMEPAD_WHEEL_STEP),
            )
          }
        }

        MutableRef.set(gamepadPressedKeysRef, cloneSet(pressedKeys))
        MutableRef.set(gamepadJustPressedKeysRef, nextJustPressedKeys)
        MutableRef.set(gamepadMouseButtonsRef, cloneMap(mouseButtons))
        MutableRef.set(gamepadJustClickedButtonsRef, nextJustClickedButtons)
        MutableRef.set(gamepadPreviousPressedKeysRef, cloneSet(pressedKeys))
        MutableRef.set(gamepadPreviousMouseButtonsRef, cloneMap(mouseButtons))
        MutableRef.set(gamepadPreviousWheelButtonsRef, cloneSet(wheelButtons))
      }

      // Keys whose browser default action interferes with gameplay: arrows and
      // PageUp/Down scroll the page; Space scrolls AND activates a focused button
      // (e.g. the menu button just clicked to start the world) — which silently
      // eats the jump. We preventDefault these during play, but NOT while a text
      // field is focused (world-name entry still needs space/arrows).
      const GAME_DEFAULT_BLOCKED = new Set([
        'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown',
      ])
      const isEditableTarget = (target: EventTarget | null): boolean => {
        const el = target as HTMLElement | null
        if (el === null) return false
        const tag = el.tagName
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
      }

      // Keyboard event handlers
      const handleKeyDown = (event: KeyboardEvent) => {
        if (GAME_DEFAULT_BLOCKED.has(event.code) && !isEditableTarget(event.target)) {
          event.preventDefault()
        }
        if (!event.repeat) {
          MutableRef.set(pressedKeysRef, HashSet.add(MutableRef.get(pressedKeysRef), event.code))
          // Mark as just pressed (for consumeKeyPress)
          MutableRef.set(justPressedKeysRef, HashSet.add(MutableRef.get(justPressedKeysRef), event.code))
        }
      }

      const handleKeyUp = (event: KeyboardEvent) => {
        MutableRef.set(pressedKeysRef, HashSet.remove(MutableRef.get(pressedKeysRef), event.code))
        // NOTE: do NOT remove from justPressedKeys here.
        // consumeKeyPress() is responsible for clearing entries after they are read.
        // Removing on keyup would cause the press to be missed when keydown and keyup
        // arrive before the next frame handler runs (e.g. Playwright keyboard.press()).
      }

      // Mouse event handler for pointer movement
      const handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement instanceof HTMLCanvasElement || MutableRef.get(pointerLockFallbackRef)) {
          const delta = MutableRef.get(mouseDeltaRef)
          MutableRef.set(mouseDeltaRef, { x: delta.x + event.movementX, y: delta.y + event.movementY })
        }
      }

      // Mouse button event handlers
      const handleMouseDown = (event: MouseEvent) => {
        MutableRef.set(mouseButtonsRef, HashMap.set(MutableRef.get(mouseButtonsRef), event.button, true))
        // Mark as just clicked (for consumeMouseClick)
        MutableRef.set(justClickedButtonsRef, HashSet.add(MutableRef.get(justClickedButtonsRef), event.button))
      }

      const handleMouseUp = (event: MouseEvent) => {
        MutableRef.set(mouseButtonsRef, HashMap.set(MutableRef.get(mouseButtonsRef), event.button, false))
      }

      // Mouse wheel handler for hotbar slot cycling
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        MutableRef.set(wheelDeltaRef, MutableRef.get(wheelDeltaRef) + event.deltaY)
      }

      // Suppress browser context menu so right-click can be used for block placement.
      // Named so it can be removed during cleanup.
      // Do NOT add to justClickedButtons here — handleMouseDown already captures button 2.
      // Adding it here would cause a spurious second right-click if consumeMouseClick(2)
      // is called between the mousedown and contextmenu events.
      const handleContextMenu = (e: Event) => {
        e.preventDefault()
      }

      const handlePointerLockChange = () => {
        if (!(document.pointerLockElement instanceof HTMLCanvasElement)) {
          MutableRef.set(pointerLockFallbackRef, false)
        }
      }

      const handlePointerLockError = () => {
        MutableRef.set(pointerLockFallbackRef, false)
        console.warn('Pointer Lock request failed')
      }

      // Clear all held input when the window loses focus. The browser does NOT
      // deliver keyup/mouseup for keys/buttons still held when focus leaves, so
      // without this a key held during a tab/window switch stays "pressed" forever
      // and the player keeps walking/acting on return (user report: stuck controls).
      const handleBlur = () => {
        MutableRef.set(pressedKeysRef, HashSet.empty<string>())
        MutableRef.set(justPressedKeysRef, HashSet.empty<string>())
        MutableRef.set(mouseButtonsRef, HashMap.empty<number, boolean>())
        MutableRef.set(justClickedButtonsRef, HashSet.empty<number>())
        MutableRef.set(gamepadPressedKeysRef, new Set<string>())
        MutableRef.set(gamepadJustPressedKeysRef, new Set<string>())
        MutableRef.set(gamepadMouseButtonsRef, new Map<number, boolean>())
        MutableRef.set(gamepadJustClickedButtonsRef, new Set<number>())
        MutableRef.set(gamepadPreviousPressedKeysRef, new Set<string>())
        MutableRef.set(gamepadPreviousMouseButtonsRef, new Map<number, boolean>())
        MutableRef.set(gamepadPreviousWheelButtonsRef, new Set<number>())
        MutableRef.set(wheelDeltaRef, 0)
      }

      // Register all event listeners and schedule cleanup via finalizer
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        yield* Effect.sync(() => {
          document.addEventListener('keydown', handleKeyDown)
          document.addEventListener('keyup', handleKeyUp)
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mousedown', handleMouseDown)
          document.addEventListener('mouseup', handleMouseUp)
          document.addEventListener('contextmenu', handleContextMenu)
          document.addEventListener('pointerlockchange', handlePointerLockChange)
          document.addEventListener('pointerlockerror', handlePointerLockError)
          // Wheel event for hotbar cycling; passive:false required to allow preventDefault
          document.addEventListener('wheel', handleWheel, { passive: false })
          // Clear held input when the window loses focus (prevents stuck keys
          // on tab/window switch — the browser sends no keyup while unfocused).
          window.addEventListener('blur', handleBlur)
        })
        yield* Effect.addFinalizer(() => Effect.sync(() => {
          document.removeEventListener('keydown', handleKeyDown)
          document.removeEventListener('keyup', handleKeyUp)
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mousedown', handleMouseDown)
          document.removeEventListener('mouseup', handleMouseUp)
          document.removeEventListener('contextmenu', handleContextMenu)
          document.removeEventListener('pointerlockchange', handlePointerLockChange)
          document.removeEventListener('pointerlockerror', handlePointerLockError)
          document.removeEventListener('wheel', handleWheel)
          window.removeEventListener('blur', handleBlur)
        }))
      }

      return {
        isKeyPressed: (key: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            return HashSet.has(MutableRef.get(pressedKeysRef), key) || MutableRef.get(gamepadPressedKeysRef).has(key)
          }),

        consumeKeyPress: (key: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const state = MutableRef.get(justPressedKeysRef)
            const next = HashSet.remove(state, key)
            MutableRef.set(justPressedKeysRef, next)
            const gamepadState = cloneSet(MutableRef.get(gamepadJustPressedKeysRef))
            const gamepadConsumed = gamepadState.has(key)
            if (gamepadConsumed) {
              gamepadState.delete(key)
              MutableRef.set(gamepadJustPressedKeysRef, gamepadState)
            }
            return HashSet.has(state, key) || gamepadConsumed
          }),

        getMouseDelta: (): Effect.Effect<MouseDelta, never> =>
          Effect.sync(() => {
            const { mouseDelta } = collectGamepadState()
            if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
              const delta = MutableRef.get(mouseDeltaRef)
              MutableRef.set(mouseDeltaRef, { x: delta.x + mouseDelta.x, y: delta.y + mouseDelta.y })
            }
            const delta = MutableRef.get(mouseDeltaRef)
            MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
            return delta
          }),

        isMouseDown: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            return Option.getOrElse(HashMap.get(MutableRef.get(mouseButtonsRef), button), () => false) ||
              MutableRef.get(gamepadMouseButtonsRef).get(button) === true
          }),

        requestPointerLock: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const canvas = document.getElementById('game-canvas')
            const featurePolicy = (document as Document & {
              featurePolicy?: { allowsFeature: (feature: string) => boolean }
            }).featurePolicy
            const pointerLockAllowed =
              typeof featurePolicy?.allowsFeature === 'function'
                ? featurePolicy.allowsFeature('pointer-lock')
                : true

            if (!pointerLockAllowed) {
              MutableRef.set(pointerLockFallbackRef, true)
              return
            }

            if (canvas instanceof HTMLCanvasElement && typeof canvas.requestPointerLock === 'function') {
              canvas.requestPointerLock()
              MutableRef.set(pointerLockFallbackRef, true)
            }
          }),

        exitPointerLock: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            MutableRef.set(pointerLockFallbackRef, false)
            if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
              document.exitPointerLock()
            }
          }),

        isPointerLocked: (): Effect.Effect<boolean, never> =>
          Effect.sync(() => document.pointerLockElement instanceof HTMLCanvasElement || MutableRef.get(pointerLockFallbackRef)),

        consumeMouseClick: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const state = MutableRef.get(justClickedButtonsRef)
            const next = HashSet.remove(state, button)
            MutableRef.set(justClickedButtonsRef, next)
            const gamepadState = cloneSet(MutableRef.get(gamepadJustClickedButtonsRef))
            const gamepadConsumed = gamepadState.has(button)
            if (gamepadConsumed) {
              gamepadState.delete(button)
              MutableRef.set(gamepadJustClickedButtonsRef, gamepadState)
            }
            return HashSet.has(state, button) || gamepadConsumed
          }),

        consumeWheelDelta: (): Effect.Effect<number, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const delta = MutableRef.get(wheelDeltaRef)
            MutableRef.set(wheelDeltaRef, 0)
            return delta
          }),
      }
    }),
  }
) {}
export const PlayerInputServiceLayer: Layer.Layer<PlayerInputService, never, InputService> =
  Layer.effect(
    PlayerInputService,
    Effect.map(InputService, (input) => ({
      _tag: '@minecraft/application/PlayerInputService' as const,
      isKeyPressed: (key: string) => input.isKeyPressed(key),
      consumeKeyPress: (key: string) => input.consumeKeyPress(key),
      consumeWheelDelta: () => input.consumeWheelDelta(),
      getMouseDelta: () => input.getMouseDelta(),
      isPointerLocked: () => input.isPointerLocked(),
    }))
  )
