import { createBrowserCanvasMouseDownHandler } from './browser-runtime-event-handlers-input'
import { createBrowserPageLifecycleHandlers } from './browser-runtime-event-handlers-page-lifecycle'
import { createBrowserResizeHandler } from './browser-runtime-event-handlers-resize'
import type { BrowserEventBridgeDeps } from './browser-runtime-types'

type BrowserEventBridgeHandlers = {
  readonly handleResize: () => void
  readonly handleVisibilityChange: () => void
  readonly handleBeforeUnload: () => void
  readonly handlePageHide: () => void
  readonly handleCanvasMouseDown: () => void
}

type BrowserEventBridgeHandlerDeps = BrowserEventBridgeDeps & {
  readonly isDocumentHidden: () => boolean
}

export const createBrowserEventBridgeHandlers = ({
  canvas,
  inputPointerLock,
  gamePausedRef,
  pendingResizeRef,
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
  bestEffortSave,
  isDocumentHidden,
}: BrowserEventBridgeHandlerDeps): BrowserEventBridgeHandlers => {
  const handleResize = createBrowserResizeHandler({
    canvas,
    pendingResizeRef,
  })
  const pageLifecycleDeps = {
    pendingSaveDirtyChunksRef,
    isDocumentHidden,
    ...(bestEffortSave ? { bestEffortSave } : {}),
    ...(gameLoopService ? { gameLoopService } : {}),
    ...(frameHandler ? { frameHandler } : {}),
  }
  const { handleVisibilityChange, handleBeforeUnload, handlePageHide } = createBrowserPageLifecycleHandlers(
    pageLifecycleDeps,
  )
  const handleCanvasMouseDown = createBrowserCanvasMouseDownHandler({
    gamePausedRef,
    inputPointerLock,
  })

  return {
    handleResize,
    handleVisibilityChange,
    handleBeforeUnload,
    handlePageHide,
    handleCanvasMouseDown,
  }
}
