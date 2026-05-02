import { Effect, Layer, Option, HashMap, HashSet, Schema, MutableRef } from 'effect'
import { PlayerInputService } from '@ts-minecraft/input-handler'
import type { MouseDelta } from '@ts-minecraft/input-handler'
export type { MouseDelta } from '@ts-minecraft/input-handler'
export { MouseDeltaSchema } from '@ts-minecraft/input-handler'

export const MouseButtonSchema = Schema.Literal(0, 1, 2)
export type MouseButton = Schema.Schema.Type<typeof MouseButtonSchema>
export const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const


// Scoped: DOM event listeners removed when the scope closes (HMR, test teardown).
export class InputService extends Effect.Service<InputService>()(
  '@minecraft/presentation/InputService',
  {
    scoped: Effect.all([
      // Refs for all mutable input state — DOM handlers use Effect.runSync for synchronous access
      Effect.sync(() => MutableRef.make(HashSet.empty<string>())),
      // Track keys that were just pressed this frame (for consumeKeyPress)
      Effect.sync(() => MutableRef.make(HashSet.empty<string>())),
      Effect.sync(() => MutableRef.make({ x: 0, y: 0 })),
      // Track mouse button state (0=left, 1=middle, 2=right)
      Effect.sync(() => MutableRef.make(HashMap.empty<number, boolean>())),
      // Track mouse buttons that were just clicked this frame (for consumeMouseClick)
      Effect.sync(() => MutableRef.make(HashSet.empty<number>())),
      // Accumulated mouse wheel delta (positive = scroll down)
      Effect.sync(() => MutableRef.make(0)),
      // Fallback pointer-lock state for environments that deny the browser API (eg. MCP)
      Effect.sync(() => MutableRef.make(false)),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([pressedKeysRef, justPressedKeysRef, mouseDeltaRef, mouseButtonsRef, justClickedButtonsRef, wheelDeltaRef, pointerLockFallbackRef]) => {
      // Keyboard event handlers
      const handleKeyDown = (event: KeyboardEvent) => {
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
          Effect.sync(() => HashSet.has(MutableRef.get(pressedKeysRef), key)),

        consumeKeyPress: (key: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            const state = MutableRef.get(justPressedKeysRef)
            const next = HashSet.remove(state, key)
            MutableRef.set(justPressedKeysRef, next)
            return HashSet.has(state, key)
          }),

        getMouseDelta: (): Effect.Effect<MouseDelta, never> =>
          Effect.sync(() => {
            const delta = MutableRef.get(mouseDeltaRef)
            MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
            return delta
          }),

        isMouseDown: (button: number): Effect.Effect<boolean, never> =>
          Effect.sync(() => Option.getOrElse(HashMap.get(MutableRef.get(mouseButtonsRef), button), () => false)),

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
            const state = MutableRef.get(justClickedButtonsRef)
            const next = HashSet.remove(state, button)
            MutableRef.set(justClickedButtonsRef, next)
            return HashSet.has(state, button)
          }),

        consumeWheelDelta: (): Effect.Effect<number, never> =>
          Effect.sync(() => {
            const delta = MutableRef.get(wheelDeltaRef)
            MutableRef.set(wheelDeltaRef, 0)
            return delta
          }),
        }))
      })
    ),
  }
) {}
export const InputServiceLive = InputService.Default

export const PlayerInputServiceLive: Layer.Layer<PlayerInputService, never, InputService> =
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
