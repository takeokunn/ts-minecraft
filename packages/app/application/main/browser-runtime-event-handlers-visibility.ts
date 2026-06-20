import { Effect, MutableRef } from 'effect'
import type { FrameHandler, GameLoopService } from '@ts-minecraft/game'

type BrowserVisibilityChangeHandlerDeps = {
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gameLoopService?: GameLoopService
  readonly frameHandler?: FrameHandler
  readonly isDocumentHidden: () => boolean
  readonly bestEffortSave?: Effect.Effect<void, never>
}

export const createBrowserVisibilityChangeHandler = ({
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
  isDocumentHidden,
  bestEffortSave,
}: BrowserVisibilityChangeHandlerDeps): (() => void) => {
  return () => {
    if (isDocumentHidden()) {
      MutableRef.set(pendingSaveDirtyChunksRef, true)
      if (bestEffortSave) Effect.runFork(bestEffortSave)
      if (gameLoopService) Effect.runFork(gameLoopService.pause())
    } else if (gameLoopService && frameHandler) {
      Effect.runFork(gameLoopService.resume(frameHandler))
    }
  }
}
