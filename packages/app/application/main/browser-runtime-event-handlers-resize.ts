import { MutableRef, Option } from 'effect'

import type { PendingResize } from './browser-runtime-event-handlers'

type BrowserResizeHandlerDeps = {
  readonly canvas: HTMLCanvasElement
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
}

export const createBrowserResizeHandler = ({
  canvas,
  pendingResizeRef,
}: BrowserResizeHandlerDeps): (() => void) => {
  return () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    MutableRef.set(pendingResizeRef, Option.some({ width, height }))
  }
}
