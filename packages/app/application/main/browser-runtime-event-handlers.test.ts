import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, MutableRef, Option, Ref } from 'effect'

import { createBrowserEventBridgeHandlers } from './browser-runtime-event-handlers'

const restoreGlobals = () => {
  Reflect.deleteProperty(globalThis as object, 'window')
  Reflect.deleteProperty(globalThis as object, 'document')
}

afterEach(() => {
  restoreGlobals()
})

describe('browser-runtime-event-handlers', () => {
  it('builds handlers that bridge browser events into refs and effects', async () => {
    const pendingResizeRef = MutableRef.make(Option.none<{ width: number; height: number }>())
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const pointerLockSpy = vi.fn()
    const pauseSpy = vi.fn()
    const resumeSpy = vi.fn()
    const saveSpy = vi.fn()
    const gamePausedRef = Effect.runSync(Ref.make(false))
    let hidden = true

    const handlers = createBrowserEventBridgeHandlers({
      canvas: {
        clientWidth: 1024,
        clientHeight: 576,
      } as HTMLCanvasElement,
      inputPointerLock: Effect.sync(() => {
        pointerLockSpy()
      }),
      gamePausedRef,
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      gameLoopService: {
        pause: () => Effect.sync(() => {
          pauseSpy()
        }),
        resume: () => Effect.sync(() => {
          resumeSpy()
        }),
      } as never,
      frameHandler: (() => Effect.void) as never,
      bestEffortSave: Effect.sync(() => {
        saveSpy()
      }),
      isDocumentHidden: () => hidden,
    })

    handlers.handleResize()
    expect(Option.getOrNull(MutableRef.get(pendingResizeRef))).toEqual({ width: 1024, height: 576 })

    handlers.handleBeforeUnload()
    await Effect.runPromise(Effect.yieldNow())
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(true)
    expect(saveSpy).toHaveBeenCalledOnce()

    handlers.handlePageHide()
    await Effect.runPromise(Effect.yieldNow())
    expect(saveSpy).toHaveBeenCalledTimes(2)

    handlers.handleVisibilityChange()
    await Effect.runPromise(Effect.yieldNow())
    expect(pauseSpy).toHaveBeenCalledOnce()
    expect(saveSpy).toHaveBeenCalledTimes(3)

    hidden = false
    handlers.handleVisibilityChange()
    await Effect.runPromise(Effect.yieldNow())
    expect(resumeSpy).toHaveBeenCalledOnce()
    expect(saveSpy).toHaveBeenCalledTimes(3)

    handlers.handleCanvasMouseDown()
    await Effect.runPromise(Effect.yieldNow())
    expect(pointerLockSpy).toHaveBeenCalledOnce()

    await Effect.runPromise(Ref.set(gamePausedRef, true))
    handlers.handleCanvasMouseDown()
    await Effect.runPromise(Effect.yieldNow())
    expect(pointerLockSpy).toHaveBeenCalledOnce()
  })
})
