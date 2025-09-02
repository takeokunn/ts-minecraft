import { Effect, Layer, Ref, Scope } from 'effect'
import { LockableControls } from './types'
import { InputManagerService } from '@/runtime/services'

export interface InputState {
  readonly isLocked: boolean
  readonly keyboard: Set<string>
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

export const InputManager = Effect.Tag<InputManager>()

const makeInputManager = Effect.gen(function* ($) {
  const stateRef = yield* $(
    Ref.make<InputState>({
      isLocked: false,
      keyboard: new Set(),
      mouse: { dx: 0, dy: 0 },
    }),
  )

  const handleKeyDown = (e: KeyboardEvent) => Ref.update(stateRef, (s) => ({ ...s, keyboard: s.keyboard.add(e.code) }))
  const handleKeyUp = (e: KeyboardEvent) =>
    Ref.update(stateRef, (s) => {
      s.keyboard.delete(e.code)
      return { ...s, keyboard: s.keyboard }
    })

  const handleMouseMove = (e: MouseEvent) =>
    Ref.update(stateRef, (s) => ({
      ...s,
      mouse: { dx: e.movementX, dy: e.movementY },
    }))

  const handleLockChange = (controls: LockableControls) =>
    Ref.update(stateRef, (s) => ({ ...s, isLocked: !!controls.isLocked }))

  const registerListeners = (controls: LockableControls) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const onKeyDown = (e: KeyboardEvent) => Effect.runSync(handleKeyDown(e))
        const onKeyUp = (e: KeyboardEvent) => Effect.runSync(handleKeyUp(e))
        const onMouseMove = (e: MouseEvent) => Effect.runSync(handleMouseMove(e))
        const onLock = () => Effect.runSync(handleLockChange(controls))
        const onUnlock = () => Effect.runSync(handleLockChange(controls))

        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)
        document.addEventListener('mousemove', onMouseMove)
        controls.addEventListener('lock', onLock)
        controls.addEventListener('unlock', onUnlock)

        return { onKeyDown, onKeyUp, onMouseMove, onLock, onUnlock }
      }),
      ({ onKeyDown, onKeyUp, onMouseMove, onLock, onUnlock }) =>
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

export const InputManagerLive = Layer.scoped(InputManagerService, makeInputManager)