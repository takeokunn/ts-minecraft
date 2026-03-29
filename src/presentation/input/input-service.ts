import { Effect, Layer, Option, Ref, HashMap, HashSet, Schema } from 'effect'
import { PlayerInputService } from '@/application/input/player-input-service'
import type { MouseDelta } from '@/application/input/player-input-service'
export type { MouseDelta } from '@/application/input/player-input-service'
export { MouseDeltaSchema } from '@/application/input/player-input-service'

/**
 * Mouse button constants (standard MouseEvent.button values)
 */
export const MouseButtonSchema = Schema.Literal(0, 1, 2)
export type MouseButton = Schema.Schema.Type<typeof MouseButtonSchema>
export const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const


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
    scoped: Effect.all([
      // Refs for all mutable input state — DOM handlers use Effect.runSync for synchronous access
      Ref.make(HashSet.empty<string>()),
      // Track keys that were just pressed this frame (for consumeKeyPress)
      Ref.make(HashSet.empty<string>()),
      Ref.make({ x: 0, y: 0 }),
      // Track mouse button state (0=left, 1=middle, 2=right)
      Ref.make(HashMap.empty<number, boolean>()),
      // Track mouse buttons that were just clicked this frame (for consumeMouseClick)
      Ref.make(HashSet.empty<number>()),
      // Accumulated mouse wheel delta (positive = scroll down)
      Ref.make(0),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([pressedKeysRef, justPressedKeysRef, mouseDeltaRef, mouseButtonsRef, justClickedButtonsRef, wheelDeltaRef]) => {

      // Keyboard event handlers
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!event.repeat) {
          Effect.runSync(Ref.update(pressedKeysRef, (s) => HashSet.add(s, event.code)))
          // Mark as just pressed (for consumeKeyPress)
          Effect.runSync(Ref.update(justPressedKeysRef, (s) => HashSet.add(s, event.code)))
        }
      }

      const handleKeyUp = (event: KeyboardEvent) => {
        Effect.runSync(Ref.update(pressedKeysRef, (s) => HashSet.remove(s, event.code)))
        // NOTE: do NOT remove from justPressedKeys here.
        // consumeKeyPress() is responsible for clearing entries after they are read.
        // Removing on keyup would cause the press to be missed when keydown and keyup
        // arrive before the next frame handler runs (e.g. Playwright keyboard.press()).
      }

      // Mouse event handler for pointer movement
      const getPointerLockTarget = (): HTMLCanvasElement | null => {
        const canvas = document.getElementById('game-canvas')
        return canvas instanceof HTMLCanvasElement ? canvas : null
      }

      const handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement === getPointerLockTarget()) {
          Effect.runSync(Ref.update(mouseDeltaRef, (d) => ({ x: d.x + event.movementX, y: d.y + event.movementY })))
        }
      }

      // Mouse button event handlers
      const handleMouseDown = (event: MouseEvent) => {
        Effect.runSync(Ref.update(mouseButtonsRef, (m) => HashMap.set(m, event.button, true)))
        // Mark as just clicked (for consumeMouseClick)
        Effect.runSync(Ref.update(justClickedButtonsRef, (s) => HashSet.add(s, event.button)))
      }

      const handleMouseUp = (event: MouseEvent) => {
        Effect.runSync(Ref.update(mouseButtonsRef, (m) => HashMap.set(m, event.button, false)))
      }

      // Mouse wheel handler for hotbar slot cycling
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        Effect.runSync(Ref.update(wheelDeltaRef, (d) => d + event.deltaY))
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
        const registerListeners = typeof window !== 'undefined' && typeof document !== 'undefined'
          ? Effect.acquireRelease(
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
          : Effect.void

        return registerListeners.pipe(Effect.as({
        isKeyPressed: (key: string): Effect.Effect<boolean, never> =>
          Ref.get(pressedKeysRef).pipe(Effect.map((s) => HashSet.has(s, key))),

        consumeKeyPress: (key: string): Effect.Effect<boolean, never> =>
          Ref.modify(justPressedKeysRef, (s) => [HashSet.has(s, key), HashSet.remove(s, key)]),

        getMouseDelta: (): Effect.Effect<MouseDelta, never> =>
          Ref.modify(mouseDeltaRef, (delta) => [delta, { x: 0, y: 0 }]),

        isMouseDown: (button: number): Effect.Effect<boolean, never> =>
          Ref.get(mouseButtonsRef).pipe(
            Effect.map((m) => {
              return Option.getOrElse(HashMap.get(m, button), () => false)
            })
          ),

        requestPointerLock: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const target = getPointerLockTarget()
            if (target?.requestPointerLock) {
              target.requestPointerLock()
            }
          }),

        exitPointerLock: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            if (document.exitPointerLock) {
              document.exitPointerLock()
            }
          }),

        isPointerLocked: (): Effect.Effect<boolean, never> =>
          Effect.sync(() => document.pointerLockElement === getPointerLockTarget()),

        consumeMouseClick: (button: number): Effect.Effect<boolean, never> =>
          Ref.modify(justClickedButtonsRef, (s) => [HashSet.has(s, button), HashSet.remove(s, button)]),

        consumeWheelDelta: (): Effect.Effect<number, never> =>
          Ref.modify(wheelDeltaRef, (delta) => [delta, 0]),
        }))
      })
    ),
  }
) {}
export const InputServiceLive = InputService.Default

export const PlayerInputServiceLive: Layer.Layer<PlayerInputService, never, InputService> =
  Layer.effect(
    PlayerInputService,
    // Effect.Service adds a `_tag` discriminant to every instance type, so plain objects
    // cannot satisfy InstanceType<typeof PlayerInputService> without a cast.
    // The double cast is intentional and safe: the layer graph provides this object
    // via Layer.effect(PlayerInputService, ...) which only accesses the 5 declared methods.
    Effect.map(InputService, (input) => ({
      isKeyPressed: (key: string) => input.isKeyPressed(key),
      consumeKeyPress: (key: string) => input.consumeKeyPress(key),
      consumeWheelDelta: () => input.consumeWheelDelta(),
      getMouseDelta: () => input.getMouseDelta(),
      isPointerLocked: () => input.isPointerLocked(),
    } as unknown as PlayerInputService))
  )
