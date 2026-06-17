import { Effect, Ref } from 'effect'

type BrowserCanvasMouseDownHandlerDeps = {
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly inputPointerLock: Effect.Effect<void, never>
}

export const createBrowserCanvasMouseDownHandler = ({
  gamePausedRef,
  inputPointerLock,
}: BrowserCanvasMouseDownHandlerDeps): (() => void) => {
  return () => {
    // Only (re)acquire pointer lock during active gameplay. When a menu is open
    // (gamePausedRef=true), a click on the canvas/overlay must NOT re-lock.
    if (!Effect.runSync(Ref.get(gamePausedRef))) {
      Effect.runFork(inputPointerLock)
    }
  }
}
