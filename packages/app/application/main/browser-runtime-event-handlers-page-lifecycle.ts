import { Effect, MutableRef } from 'effect'
import type { FrameHandler, GameLoopService } from '@ts-minecraft/game'

import { createBrowserBeforeUnloadHandler } from './browser-runtime-event-handlers-before-unload'
import { createBrowserVisibilityChangeHandler } from './browser-runtime-event-handlers-visibility'

type BrowserPageLifecycleHandlerDeps = {
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gameLoopService?: GameLoopService
  readonly frameHandler?: FrameHandler
  readonly isDocumentHidden: () => boolean
  readonly bestEffortSave?: Effect.Effect<void, never>
}

export const createBrowserPageLifecycleHandlers = ({
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
  isDocumentHidden,
  bestEffortSave,
}: BrowserPageLifecycleHandlerDeps): {
  readonly handleVisibilityChange: () => void
  readonly handleBeforeUnload: () => void
  readonly handlePageHide: () => void
} => {
  const visibilityHandlerDeps = {
    pendingSaveDirtyChunksRef,
    isDocumentHidden,
    ...(bestEffortSave ? { bestEffortSave } : {}),
    ...(gameLoopService ? { gameLoopService } : {}),
    ...(frameHandler ? { frameHandler } : {}),
  }
  const handleVisibilityChange = createBrowserVisibilityChangeHandler(visibilityHandlerDeps)
  const handleBeforeUnload = createBrowserBeforeUnloadHandler({
    pendingSaveDirtyChunksRef,
    ...(bestEffortSave ? { bestEffortSave } : {}),
  })
  const handlePageHide = createBrowserBeforeUnloadHandler({
    pendingSaveDirtyChunksRef,
    ...(bestEffortSave ? { bestEffortSave } : {}),
  })

  return {
    handleVisibilityChange,
    handleBeforeUnload,
    handlePageHide,
  }
}
