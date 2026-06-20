import { createBrowserEventBridgeHandlers } from './browser-runtime-event-handlers'
import { installBrowserEventBridgeListeners } from './browser-runtime-event-bridge-listeners'
import type { BrowserEventBridgeDeps } from './browser-runtime-types'

export const installBrowserEventBridge = ({
  canvas,
  inputPointerLock,
  gamePausedRef,
  pendingResizeRef,
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
  bestEffortSave,
}: BrowserEventBridgeDeps) => {
  const handlerDeps = {
    canvas,
    inputPointerLock,
    gamePausedRef,
    pendingResizeRef,
    pendingSaveDirtyChunksRef,
    isDocumentHidden: () => document.hidden,
    ...(bestEffortSave ? { bestEffortSave } : {}),
    ...(gameLoopService ? { gameLoopService } : {}),
    ...(frameHandler ? { frameHandler } : {}),
  }

  const { handleResize, handleVisibilityChange, handleBeforeUnload, handlePageHide, handleCanvasMouseDown } = createBrowserEventBridgeHandlers(handlerDeps)

  return installBrowserEventBridgeListeners({
    canvas,
    handleResize,
    handleVisibilityChange,
    handleBeforeUnload,
    handlePageHide,
    handleCanvasMouseDown,
  })
}
