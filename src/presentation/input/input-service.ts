import { Effect, Layer } from 'effect'
import { PlayerInputService } from '@/application/input/player-input-service'
import type { MouseDelta } from '@/application/input/player-input-service'
export type { MouseDelta } from '@/application/input/player-input-service'
export { MouseDeltaSchema } from '@/application/input/player-input-service'

/**
 * Mouse button constants (standard MouseEvent.button values)
 */
export const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const

export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton]


/**
 * Input service for player controls
 *
 * Provides keyboard state tracking and mouse movement detection
 * for player movement and camera control.
 *
 * Sets up DOM event listeners for keyboard and mouse input.
 * Uses direct JavaScript state for event handlers (synchronous access required).
 * Uses scoped: so all listeners are removed when the scope is closed.
 */
export class InputService extends Effect.Service<InputService>()(
  '@minecraft/presentation/InputService',
  {
    scoped: Effect.gen(function* () {
      // Track key state outside of Effect for direct event handler access
      let pressedKeys = new Set<string>()
      // Track keys that were just pressed this frame (for consumeKeyPress)
      let justPressedKeys = new Set<string>()
      let mouseDelta = { x: 0, y: 0 }
      // Track mouse button state (0=left, 1=middle, 2=right)
      const mouseButtons = new Map<number, boolean>()
      // Track mouse buttons that were just clicked this frame (for consumeMouseClick)
      const justClickedButtons = new Set<number>()
      // Accumulated mouse wheel delta (positive = scroll down)
      let wheelDelta = 0

      // Keyboard event handlers
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!event.repeat) {
          pressedKeys.add(event.code)
          // Mark as just pressed (for consumeKeyPress)
          justPressedKeys.add(event.code)
        }
      }

      const handleKeyUp = (event: KeyboardEvent) => {
        pressedKeys.delete(event.code)
        // NOTE: do NOT remove from justPressedKeys here.
        // consumeKeyPress() is responsible for clearing entries after they are read.
        // Removing on keyup would cause the press to be missed when keydown and keyup
        // arrive before the next frame handler runs (e.g. Playwright keyboard.press()).
      }

      // Mouse event handler for pointer movement
      const handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement === document.body) {
          mouseDelta.x += event.movementX
          mouseDelta.y += event.movementY
        }
      }

      // Mouse button event handlers
      const handleMouseDown = (event: MouseEvent) => {
        mouseButtons.set(event.button, true)
        // Mark as just clicked (for consumeMouseClick)
        justClickedButtons.add(event.button)
      }

      const handleMouseUp = (event: MouseEvent) => {
        mouseButtons.set(event.button, false)
      }

      // Mouse wheel handler for hotbar slot cycling
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        wheelDelta += event.deltaY
      }

      // Suppress browser context menu so right-click can be used for block placement.
      // Named so it can be removed during cleanup.
      // Do NOT add to justClickedButtons here — handleMouseDown already captures button 2.
      // Adding it here would cause a spurious second right-click if consumeMouseClick(2)
      // is called between the mousedown and contextmenu events.
      const handleContextMenu = (e: Event) => {
        e.preventDefault()
      }

      // Register all event listeners and schedule cleanup via finalizer
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            document.addEventListener('keydown', handleKeyDown)
            document.addEventListener('keyup', handleKeyUp)
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mousedown', handleMouseDown)
            document.addEventListener('mouseup', handleMouseUp)
            document.addEventListener('contextmenu', handleContextMenu)
            // Wheel event for hotbar cycling; passive:false required to allow preventDefault
            document.addEventListener('wheel', handleWheel, { passive: false })
          }),
          () =>
            Effect.sync(() => {
              document.removeEventListener('keydown', handleKeyDown)
              document.removeEventListener('keyup', handleKeyUp)
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mousedown', handleMouseDown)
              document.removeEventListener('mouseup', handleMouseUp)
              document.removeEventListener('contextmenu', handleContextMenu)
              document.removeEventListener('wheel', handleWheel)
            }),
        )
      }

      return {
        isKeyPressed: (key: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => pressedKeys.has(key)),

        consumeKeyPress: (key: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            if (justPressedKeys.has(key)) {
              // Consume the key press - it won't be reported again until released and re-pressed
              justPressedKeys.delete(key)
              return true
            }
            return false
          }),

        getMouseDelta: (): Effect.Effect<MouseDelta, never> =>
          Effect.sync(() => {
            const delta = { ...mouseDelta }
            // Reset delta after reading
            mouseDelta = { x: 0, y: 0 }
            return delta
          }),

        isMouseDown: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => mouseButtons.get(button) ?? false),

        requestPointerLock: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (document.body.requestPointerLock) {
              document.body.requestPointerLock()
            }
          }),

        exitPointerLock: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (document.exitPointerLock) {
              document.exitPointerLock()
            }
          }),

        isPointerLocked: (): Effect.Effect<boolean, never> =>
          Effect.sync(() => document.pointerLockElement === document.body),

        consumeMouseClick: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            if (justClickedButtons.has(button)) {
              justClickedButtons.delete(button)
              return true
            }
            return false
          }),

        consumeWheelDelta: (): Effect.Effect<number, never> =>
          Effect.sync(() => {
            const delta = wheelDelta
            wheelDelta = 0
            return delta
          }),
      }
    }),
  }
) {}
export const InputServiceLive = InputService.Default

export const PlayerInputServiceLive: Layer.Layer<PlayerInputService, never, InputService> =
  Layer.effect(
    PlayerInputService,
    Effect.gen(function* () {
      const input = yield* InputService
      const impl: {
        isKeyPressed: (key: string) => Effect.Effect<boolean>
        consumeKeyPress: (key: string) => Effect.Effect<boolean>
        consumeWheelDelta: () => Effect.Effect<number>
        getMouseDelta: () => Effect.Effect<MouseDelta>
        isPointerLocked: () => Effect.Effect<boolean>
      } = {
        isKeyPressed: (key: string) => input.isKeyPressed(key),
        consumeKeyPress: (key: string) => input.consumeKeyPress(key),
        consumeWheelDelta: () => input.consumeWheelDelta(),
        getMouseDelta: () => input.getMouseDelta(),
        isPointerLocked: () => input.isPointerLocked(),
      }
      return impl as unknown as PlayerInputService
    })
  )
