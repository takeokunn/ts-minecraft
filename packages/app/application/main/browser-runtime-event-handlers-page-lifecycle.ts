import { MutableRef } from 'effect'
import type { FrameHandler, GameLoopService } from '@ts-minecraft/game'

import { createBrowserBeforeUnloadHandler } from './browser-runtime-event-handlers-before-unload'
import { createBrowserVisibilityChangeHandler } from './browser-runtime-event-handlers-visibility'

type BrowserPageLifecycleHandlerDeps = {
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gameLoopService?: GameLoopService
  readonly frameHandler?: FrameHandler
  readonly isDocumentHidden: () => boolean
}

export const createBrowserPageLifecycleHandlers = ({
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
  isDocumentHidden,
}: BrowserPageLifecycleHandlerDeps): {
  readonly handleVisibilityChange: () => void
  readonly handleBeforeUnload: () => void
} => {
  const visibilityHandlerDeps = {
    pendingSaveDirtyChunksRef,
    isDocumentHidden,
    ...(gameLoopService ? { gameLoopService } : {}),
    ...(frameHandler ? { frameHandler } : {}),
  }
  const handleVisibilityChange = createBrowserVisibilityChangeHandler(visibilityHandlerDeps)
  const handleBeforeUnload = createBrowserBeforeUnloadHandler({
    pendingSaveDirtyChunksRef,
  })

  return {
    handleVisibilityChange,
    handleBeforeUnload,
  }
}
