import { Effect } from 'effect'

type BrowserEventBridgeListenerHandlers = {
  readonly handleResize: () => void
  readonly handleVisibilityChange: () => void
  readonly handleBeforeUnload: () => void
  readonly handleCanvasMouseDown: () => void
}

export const installBrowserEventBridgeListeners = ({
  canvas,
  handleResize,
  handleVisibilityChange,
  handleBeforeUnload,
  handleCanvasMouseDown,
}: BrowserEventBridgeListenerHandlers & {
  readonly canvas: HTMLCanvasElement
}) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      window.addEventListener('resize', handleResize)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)
      canvas.addEventListener('mousedown', handleCanvasMouseDown)
    }),
    () =>
      Effect.sync(() => {
        window.removeEventListener('resize', handleResize)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('beforeunload', handleBeforeUnload)
        canvas.removeEventListener('mousedown', handleCanvasMouseDown)
      }),
  )
