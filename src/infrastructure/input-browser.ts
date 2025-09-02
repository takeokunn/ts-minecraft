import { Context, Effect, Layer, Ref, Scope } from 'effect'
import { LockableControls } from './types'

export interface InputState {
  readonly isLocked: boolean
  readonly keyboard: ReadonlySet<string>
  readonly mouse: {
    readonly dx: number
    readonly dy: number
  }
}

export interface InputManager {
  readonly getState: Effect.Effect<InputState>
  readonly getMouseDelta: Effect.Effect<{ dx: number; dy: number }>
  readonly registerListeners: (controls: LockableControls) => Effect.Effect<void, never, Scope.Scope>
}

export const InputManager = Context.Tag<InputManager>('InputManager')

const makeInputManager = Effect.gen(function* (_) {
  const stateRef = yield* _(
    Ref.make<InputState>({
      isLocked: false,
      keyboard: new Set(),
      mouse: { dx: 0, dy: 0 },
    }),
  )

  const handleKeyDown = (e: KeyboardEvent) =>
    Ref.update(stateRef, (s) => ({ ...s, keyboard: new Set([...s.keyboard, e.code]) }))
  const handleKeyUp = (e: KeyboardEvent) =>
    Ref.update(stateRef, (s) => {
      const newKeyboard = new Set(s.keyboard)
      newKeyboard.delete(e.code)
      return { ...s, keyboard: newKeyboard }
    })

  const handleMouseMove = (e: MouseEvent) =>
    Ref.update(stateRef, (s) => ({
      ...s,
      mouse: { dx: e.movementX, dy: e.movementY },
    }))

  const handleLockChange = (controls: LockableControls) => Ref.update(stateRef, (s) => ({ ...s, isLocked: controls.isLocked }))

  const registerListeners = (controls: LockableControls) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const onKeyDown = (e: Event) => Effect.runSync(handleKeyDown(e as KeyboardEvent))
        const onKeyUp = (e: Event) => Effect.runSync(handleKeyUp(e as KeyboardEvent))
        const onMouseMove = (e: Event) => Effect.runSync(handleMouseMove(e as MouseEvent))
        const onLock = () => Effect.runSync(handleLockChange(controls))
        const onUnlock = () => Effect.runSync(handleLockChange(controls))

        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)
        document.addEventListener('mousemove', onMouseMove)
        controls.addEventListener('lock', onLock)
        controls.addEventListener('unlock', onUnlock)

        return { onKeyDown, onKeyUp, onMouseMove, onLock, onUnlock, controls }
      }),
      ({ onKeyDown, onKeyUp, onMouseMove, onLock, onUnlock, controls }) =>
        Effect.sync(() => {
          document.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('keyup', onKeyUp)
          document.removeEventListener('mousemove', onMouseMove)
          controls.removeEventListener('lock', onLock)
          controls.removeEventListener('unlock', onUnlock)
        }),
    )

  return {
    getState: Ref.get(stateRef),
    getMouseDelta: Ref.get(stateRef).pipe(Effect.map((s) => s.mouse)),
    registerListeners,
  }
})

export const InputManagerLive = Layer.scoped(InputManager, makeInputManager)
