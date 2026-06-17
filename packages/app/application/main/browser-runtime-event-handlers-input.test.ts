import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, Ref } from 'effect'

import { createBrowserCanvasMouseDownHandler } from './browser-runtime-event-handlers-input'

const restoreGlobals = () => {
  Reflect.deleteProperty(globalThis as object, 'window')
  Reflect.deleteProperty(globalThis as object, 'document')
}

afterEach(() => {
  restoreGlobals()
})

describe('browser-runtime-event-handlers-input', () => {
  it('acquires pointer lock only while gameplay is active', async () => {
    const pointerLockSpy = vi.fn()
    const gamePausedRef = Effect.runSync(Ref.make(false))
    const handleCanvasMouseDown = createBrowserCanvasMouseDownHandler({
      gamePausedRef,
      inputPointerLock: Effect.sync(() => {
        pointerLockSpy()
      }),
    })

    handleCanvasMouseDown()
    await Effect.runPromise(Effect.yieldNow())
    expect(pointerLockSpy).toHaveBeenCalledOnce()

    await Effect.runPromise(Ref.set(gamePausedRef, true))
    handleCanvasMouseDown()
    await Effect.runPromise(Effect.yieldNow())
    expect(pointerLockSpy).toHaveBeenCalledOnce()
  })
})
