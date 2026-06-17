import { Effect, MutableRef, Option, Ref } from 'effect'
import type { FrameHandler, GameLoopService } from '@ts-minecraft/game'

import { createBrowserCanvasMouseDownHandler } from './browser-runtime-event-handlers-input'
import { createBrowserPageLifecycleHandlers } from './browser-runtime-event-handlers-page-lifecycle'
import { createBrowserResizeHandler } from './browser-runtime-event-handlers-resize'

export type PendingResize = { readonly width: number; readonly height: number }

export type BrowserEventBridgeDeps = {
  readonly canvas: HTMLCanvasElement
  readonly inputPointerLock: Effect.Effect<void, never>
  // Pause state: while a menu is open we must NOT re-acquire pointer lock on a
  // canvas click, or pressing ESC would free the cursor only for the next click
  // to immediately re-capture it (focus feels stuck).
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gameLoopService?: GameLoopService
  readonly frameHandler?: FrameHandler
}

type BrowserEventBridgeHandlers = {
  readonly handleResize: () => void
  readonly handleVisibilityChange: () => void
  readonly handleBeforeUnload: () => void
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
  isDocumentHidden,
}: BrowserEventBridgeHandlerDeps): BrowserEventBridgeHandlers => {
  const handleResize = createBrowserResizeHandler({
    canvas,
    pendingResizeRef,
  })
  const pageLifecycleDeps = {
    pendingSaveDirtyChunksRef,
    isDocumentHidden,
    ...(gameLoopService ? { gameLoopService } : {}),
    ...(frameHandler ? { frameHandler } : {}),
  }
  const { handleVisibilityChange, handleBeforeUnload } = createBrowserPageLifecycleHandlers(
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
    handleCanvasMouseDown,
  }
}
