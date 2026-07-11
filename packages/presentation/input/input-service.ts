import { Effect, Layer, Option, HashMap, HashSet, Schema, MutableRef } from 'effect'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { PlayerInputService, type MouseDelta } from '@ts-minecraft/entity/application/player-input-service'
import { downloadCanvasScreenshot } from './screenshot-service'
import { createVirtualInputState } from './virtual-input-state'
import { collectGamepadSnapshot, createGamepadEdgeTracker } from './gamepad-input-state'

export type { MouseDelta } from '@ts-minecraft/entity/application/player-input-service'
export { MouseDeltaSchema } from '@ts-minecraft/entity/application/player-input-service'

export const MouseButtonSchema = Schema.Literal(0, 1, 2)
export type MouseButton = Schema.Schema.Type<typeof MouseButtonSchema>
export const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const

const readGamepads = (): readonly Gamepad[] => {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return []
  }

  const gamepads = navigator.getGamepads()
  const availableGamepads: Gamepad[] = []

  for (let index = 0; index < gamepads.length; index += 1) {
    const gamepad = gamepads[index]
    if (gamepad !== null && gamepad !== undefined) availableGamepads.push(gamepad)
  }

  return availableGamepads
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
      const gamepadInput = yield* Effect.sync(createGamepadEdgeTracker)
      const virtualInput = yield* Effect.sync(createVirtualInputState)

      const syncGamepadState = () => {
        gamepadInput.update(collectGamepadSnapshot(readGamepads()))
      }

      // Keys whose browser default action interferes with gameplay. Keep
      // editable targets untouched so menu/forms preserve normal typing behavior.
      const GAME_DEFAULT_BLOCKED = new Set([
        KeyMappings.JUMP,
        KeyMappings.MOVE_FORWARD_ALT,
        KeyMappings.MOVE_BACKWARD_ALT,
        KeyMappings.MOVE_LEFT_ALT,
        KeyMappings.MOVE_RIGHT_ALT,
        'PageUp',
        'PageDown',
        KeyMappings.HUD_TOGGLE,
        KeyMappings.SCREENSHOT,
        'F11',
      ])
      const isEditableTarget = (target: EventTarget | null): boolean => {
        const el = target as HTMLElement | null
        if (el === null) return false
        const tag = el.tagName
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
      }
      const isBrowserShortcutBlocked = (event: KeyboardEvent): boolean =>
        event.code === 'KeyW' && (event.ctrlKey || event.metaKey)
      const shouldPreventGameDefault = (event: KeyboardEvent): boolean =>
        !isEditableTarget(event.target) && (GAME_DEFAULT_BLOCKED.has(event.code) || isBrowserShortcutBlocked(event))

      // Keyboard event handlers
      const handleKeyDown = (event: KeyboardEvent) => {
        if (isEditableTarget(event.target)) return

        if (shouldPreventGameDefault(event)) {
          event.preventDefault()
        }
        if (!event.repeat) {
          if (event.code === KeyMappings.SCREENSHOT) {
            downloadCanvasScreenshot()
          }
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
        gamepadInput.clear()
        virtualInput.clear()
        MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
        MutableRef.set(wheelDeltaRef, 0)
      }

      // Register all event listeners and schedule cleanup via finalizer
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        yield* Effect.sync(() => {
          // Key listeners live on `window` (bubble phase) so modal overlays
          // (inventory/settings/pause/chat) that consume a key with
          // stopPropagation() on `document` shield it from gameplay input.
          // Otherwise the frame-pipeline sees the same Escape one frame after
          // the modal already handled it and acts on stale modal state.
          window.addEventListener('keydown', handleKeyDown)
          window.addEventListener('keyup', handleKeyUp)
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
          window.removeEventListener('keydown', handleKeyDown)
          window.removeEventListener('keyup', handleKeyUp)
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
            const gamepadState = gamepadInput.getState()
            return HashSet.has(MutableRef.get(pressedKeysRef), key) ||
              gamepadState.snapshot.pressedKeys.has(key) ||
              virtualInput.isKeyPressed(key)
          }),

        consumeKeyPress: (key: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const state = MutableRef.get(justPressedKeysRef)
            const next = HashSet.remove(state, key)
            MutableRef.set(justPressedKeysRef, next)
            const gamepadConsumed = gamepadInput.consumeKeyPress(key)
            const virtualConsumed = virtualInput.consumeKeyPress(key)
            return HashSet.has(state, key) || gamepadConsumed || virtualConsumed
          }),

        getMouseDelta: (): Effect.Effect<MouseDelta, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const { mouseDelta } = gamepadInput.getState().snapshot
            if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
              const delta = MutableRef.get(mouseDeltaRef)
              MutableRef.set(mouseDeltaRef, { x: delta.x + mouseDelta.x, y: delta.y + mouseDelta.y })
            }
            const delta = MutableRef.get(mouseDeltaRef)
            MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
            const virtualDelta = virtualInput.consumeLookDelta()
            return { x: delta.x + virtualDelta.x, y: delta.y + virtualDelta.y }
          }),

        isMouseDown: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const gamepadMouseDown = button === MouseButton.LEFT || button === MouseButton.RIGHT
              ? gamepadInput.getState().snapshot.mouseButtons.has(button)
              : false
            return Option.getOrElse(HashMap.get(MutableRef.get(mouseButtonsRef), button), () => false) ||
              gamepadMouseDown ||
              virtualInput.isMouseDown(button)
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
          Effect.sync(() => document.pointerLockElement instanceof HTMLCanvasElement ||
            MutableRef.get(pointerLockFallbackRef) || virtualInput.isLookActive()),

        consumeMouseClick: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const state = MutableRef.get(justClickedButtonsRef)
            const next = HashSet.remove(state, button)
            MutableRef.set(justClickedButtonsRef, next)
            const gamepadConsumed = gamepadInput.consumeMouseClick(button)
            const virtualConsumed = virtualInput.consumeMouseClick(button)
            return HashSet.has(state, button) || gamepadConsumed || virtualConsumed
          }),

        consumeWheelDelta: (): Effect.Effect<number, never> =>
          Effect.sync(() => {
            syncGamepadState()
            const delta = MutableRef.get(wheelDeltaRef) + gamepadInput.consumeWheelDelta()
            MutableRef.set(wheelDeltaRef, 0)
            return delta
          }),

        setVirtualKey: (key: string, pressed: boolean): Effect.Effect<void, never> =>
          Effect.sync(() => virtualInput.setKey(key, pressed)),

        pulseVirtualKey: (key: string): Effect.Effect<void, never> =>
          Effect.sync(() => virtualInput.pulseKey(key)),

        setVirtualMouseButton: (button: number, pressed: boolean): Effect.Effect<void, never> =>
          Effect.sync(() => virtualInput.setMouseButton(button, pressed)),

        addVirtualLookDelta: (x: number, y: number): Effect.Effect<void, never> =>
          Effect.sync(() => virtualInput.addLookDelta(x, y)),

        setVirtualLookActive: (active: boolean): Effect.Effect<void, never> =>
          Effect.sync(() => virtualInput.setLookActive(active)),

        clearVirtualInput: (): Effect.Effect<void, never> =>
          Effect.sync(() => virtualInput.clear()),
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
