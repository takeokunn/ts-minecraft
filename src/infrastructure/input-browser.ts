import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { match } from 'ts-pattern'
import type { BrowserInputState } from '@/domain/types'

// --- Type Definitions ---

type LockableControls = {
  readonly isLocked: boolean
  lock: () => void
  unlock: () => void
  addEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
  removeEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
}

// --- Service Definition ---

export interface InputManager {
  readonly getState: Effect.Effect<BrowserInputState>
  readonly getMouseDelta: Effect.Effect<{ dx: number; dy: number }>
  readonly registerListeners: (controls: LockableControls) => Effect.Effect<void>
  readonly cleanup: Effect.Effect<void>
}

export const InputManager = Context.Tag<InputManager>()

// --- Live Implementation ---

export const InputManagerLive = Layer.effect(
  InputManager,
  Effect.sync(() => {
    const state = {
      keyboard: new Set<string>(),
      mouse: { dx: 0, dy: 0 },
      isLocked: false,
    }
    let cleanupListeners: (() => void) | null = null

    const registerListeners = (controls: LockableControls) =>
      Effect.sync(() => {
        if (cleanupListeners) {
          cleanupListeners()
        }

        const getMouseButtonKey = (button: number) =>
          match(button)
            .with(0, () => 'Mouse0' as const)
            .with(2, () => 'Mouse2' as const)
            .otherwise(() => null)

        const handleMouseButton = (event: MouseEvent, action: 'add' | 'delete') => {
          if (controls.isLocked) {
            const key = getMouseButtonKey(event.button)
            if (key) {
              state.keyboard[action](key)
            }
          }
        }

        const onKeyDown = (event: KeyboardEvent) => state.keyboard.add(event.code)
        const onKeyUp = (event: KeyboardEvent) => state.keyboard.delete(event.code)
        const onMouseMove = (event: MouseEvent) => {
          if (controls.isLocked) {
            state.mouse.dx += event.movementX
            state.mouse.dy += event.movementY
          }
        }
        const onMouseDown = (event: MouseEvent) => {
          if (controls.isLocked) {
            handleMouseButton(event, 'add')
          } else {
            controls.lock()
          }
        }
        const onMouseUp = (event: MouseEvent) => handleMouseButton(event, 'delete')
        const onLock = () => (state.isLocked = true)
        const onUnlock = () => (state.isLocked = false)

        const listeners: { [K in keyof DocumentEventMap]?: (event: DocumentEventMap[K]) => void } = {
          keydown: onKeyDown,
          keyup: onKeyUp,
          mousemove: onMouseMove,
          mousedown: onMouseDown,
          mouseup: onMouseUp,
        }

        for (const [event, listener] of Object.entries(listeners)) {
          document.addEventListener(event, listener as EventListener)
        }
        controls.addEventListener('lock', onLock)
        controls.addEventListener('unlock', onUnlock)

        cleanupListeners = () => {
          for (const [event, listener] of Object.entries(listeners)) {
            document.removeEventListener(event, listener as EventListener)
          }
          controls.removeEventListener('lock', onLock)
          controls.removeEventListener('unlock', onUnlock)
          if (controls.isLocked) controls.unlock()
          cleanupListeners = null
        }
      })

    const cleanup = Effect.sync(() => {
      if (cleanupListeners) {
        cleanupListeners()
      }
    })

    const getState = Effect.sync(() => state)

    const getMouseDelta = Effect.sync(() => {
      const delta = { dx: state.mouse.dx, dy: state.mouse.dy }
      state.mouse.dx = 0
      state.mouse.dy = 0
      return delta
    })

    return InputManager.of({
      getState,
      getMouseDelta,
      registerListeners,
      cleanup,
    })
  }),
)
