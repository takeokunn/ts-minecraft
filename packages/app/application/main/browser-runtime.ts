import { createBrowserEventBridgeHandlers, type BrowserEventBridgeDeps } from './browser-runtime-event-handlers'
import { installBrowserEventBridgeListeners } from './browser-runtime-event-bridge-listeners'
export { wrapFrameHandlerWithBrowserEffects } from './browser-runtime-effects'
export type { PendingResize } from './browser-runtime-event-handlers'

export const installBrowserEventBridge = ({
  canvas,
  inputPointerLock,
  gamePausedRef,
  pendingResizeRef,
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
}: BrowserEventBridgeDeps) => {
  const handlerDeps = {
    canvas,
    inputPointerLock,
    gamePausedRef,
    pendingResizeRef,
    pendingSaveDirtyChunksRef,
    isDocumentHidden: () => document.hidden,
    ...(gameLoopService ? { gameLoopService } : {}),
    ...(frameHandler ? { frameHandler } : {}),
  }

  const { handleResize, handleVisibilityChange, handleBeforeUnload, handleCanvasMouseDown } = createBrowserEventBridgeHandlers(handlerDeps)

  return installBrowserEventBridgeListeners({
    canvas,
    handleResize,
    handleVisibilityChange,
    handleBeforeUnload,
    handleCanvasMouseDown,
  })
}
