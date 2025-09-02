import { Context, Effect, Layer, Option, Ref } from 'effect'
import { match } from 'ts-pattern'
import type { BrowserInputState } from '@/domain/types'

// --- Type Definitions ---

export type LockableControls = {
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

export const InputManagerService = Context.GenericTag<InputManager>('app/InputManager')

// --- Live Implementation ---

export const InputManagerLive = Layer.effect(
  InputManagerService,
  Effect.gen(function* ($) {
    const stateRef = yield* $(
      Ref.make<BrowserInputState>({
        keyboard: new Set<string>(),
        mouse: { dx: 0, dy: 0 },
        isLocked: false,
      }),
    )
    const cleanupRef = yield* $(Ref.make<Option.Option<Effect.Effect<void>>>(Option.none()))

    const registerListeners = (controls: LockableControls) =>
      Effect.gen(function* ($) {
        yield* $(Effect.flatMap(Ref.get(cleanupRef), Option.match({ onNone: () => Effect.void, onSome: (e) => e })))

        const getMouseButtonKey = (button: number) =>
          match(button)
            .with(0, () => 'Mouse0' as const)
            .with(2, () => 'Mouse2' as const)
            .otherwise(() => null)

        const handleMouseButton = (event: MouseEvent, action: 'add' | 'delete') =>
          Effect.flatMap(Ref.get(stateRef), (s) => {
            if (s.isLocked) {
              const key = getMouseButtonKey(event.button)
              if (key) {
                const newKeyboard = new Set(s.keyboard)
                newKeyboard[action](key)
                return Ref.update(stateRef, (s) => ({ ...s, keyboard: newKeyboard }))
              }
            }
            return Effect.void
          })

        const onKeyDown = (event: KeyboardEvent) => Ref.update(stateRef, (s) => ({ ...s, keyboard: new Set(s.keyboard).add(event.code) }))
        const onKeyUp = (event: KeyboardEvent) =>
          Ref.update(stateRef, (s) => {
            const newKeyboard = new Set(s.keyboard)
            newKeyboard.delete(event.code)
            return { ...s, keyboard: newKeyboard }
          })
        const onMouseMove = (event: MouseEvent) =>
          Ref.update(stateRef, (s) => (s.isLocked ? { ...s, mouse: { dx: s.mouse.dx + (event.movementX ?? 0), dy: s.mouse.dy + (event.movementY ?? 0) } } : s))
        const onMouseDown = (event: MouseEvent) => Effect.flatMap(Ref.get(stateRef), (s) => (s.isLocked ? handleMouseButton(event, 'add') : Effect.sync(() => controls.lock())))
        const onMouseUp = (event: MouseEvent) => handleMouseButton(event, 'delete')
        const onLock = () => Ref.update(stateRef, (s) => ({ ...s, isLocked: true }))
        const onUnlock = () => Ref.update(stateRef, (s) => ({ ...s, isLocked: false }))

        const onKeyDownListener = (e: KeyboardEvent) => Effect.runFork(onKeyDown(e))
        const onKeyUpListener = (e: KeyboardEvent) => Effect.runFork(onKeyUp(e))
        const onMouseMoveListener = (e: MouseEvent) => Effect.runFork(onMouseMove(e))
        const onMouseDownListener = (e: MouseEvent) => Effect.runFork(onMouseDown(e))
        const onMouseUpListener = (e: MouseEvent) => Effect.runFork(onMouseUp(e))

        document.addEventListener('keydown', onKeyDownListener)
        document.addEventListener('keyup', onKeyUpListener)
        document.addEventListener('mousemove', onMouseMoveListener)
        document.addEventListener('mousedown', onMouseDownListener)
        document.addEventListener('mouseup', onMouseUpListener)

        const onLockListener = () => Effect.runFork(onLock())
        const onUnlockListener = () => Effect.runFork(onUnlock())

        controls.addEventListener('lock', onLockListener)
        controls.addEventListener('unlock', onUnlockListener)

        const cleanupEffect = Effect.sync(() => {
          document.removeEventListener('keydown', onKeyDownListener)
          document.removeEventListener('keyup', onKeyUpListener)
          document.removeEventListener('mousemove', onMouseMoveListener)
          document.removeEventListener('mousedown', onMouseDownListener)
          document.removeEventListener('mouseup', onMouseUpListener)
          controls.removeEventListener('lock', onLockListener)
          controls.removeEventListener('unlock', onUnlockListener)
          if (controls.isLocked) controls.unlock()
        })
        yield* $(Ref.set(cleanupRef, Option.some(cleanupEffect)))
      })

    const cleanup = Effect.flatMap(Ref.get(cleanupRef), (opt) =>
      Option.match(opt, {
        onNone: () => Effect.void,
        onSome: (e) => e,
      }),
    )

    const getState = Ref.get(stateRef)

    const getMouseDelta = Ref.modify(stateRef, (s) => {
      const delta = { dx: s.mouse.dx, dy: s.mouse.dy }
      const newState = { ...s, mouse: { dx: 0, dy: 0 } }
      const result: readonly [typeof delta, typeof newState] = [delta, newState]
      return result
    })

    return {
      getState,
      getMouseDelta,
      registerListeners,
      cleanup,
    }
  }),
)
