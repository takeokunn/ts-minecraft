import { describe, it } from '@effect/vitest'
import { afterEach, expect } from 'vitest'
import { MutableRef, Option } from 'effect'

import { createBrowserResizeHandler } from './browser-runtime-event-handlers-resize'

const restoreGlobals = () => {
  Reflect.deleteProperty(globalThis as object, 'window')
  Reflect.deleteProperty(globalThis as object, 'document')
}

afterEach(() => {
  restoreGlobals()
})

describe('browser-runtime-event-handlers-resize', () => {
  it('stores pending resize dimensions only when the canvas has a size', () => {
    const pendingResizeRef = MutableRef.make(Option.none<{ width: number; height: number }>())
    const handleResize = createBrowserResizeHandler({
      canvas: {
        clientWidth: 1024,
        clientHeight: 576,
      } as HTMLCanvasElement,
      pendingResizeRef,
    })

    handleResize()
    expect(Option.getOrNull(MutableRef.get(pendingResizeRef))).toEqual({ width: 1024, height: 576 })

    const skipResizeRef = MutableRef.make(Option.none<{ width: number; height: number }>())
    const skipHandleResize = createBrowserResizeHandler({
      canvas: {
        clientWidth: 0,
        clientHeight: 576,
      } as HTMLCanvasElement,
      pendingResizeRef: skipResizeRef,
    })

    skipHandleResize()
    expect(MutableRef.get(skipResizeRef)).toEqual(Option.none())
  })
})
