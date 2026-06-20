import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, MutableRef } from 'effect'

import { createBrowserVisibilityChangeHandler } from './browser-runtime-event-handlers-visibility'

const restoreGlobals = () => {
  Reflect.deleteProperty(globalThis as object, 'window')
  Reflect.deleteProperty(globalThis as object, 'document')
}

afterEach(() => {
  restoreGlobals()
})

describe('browser-runtime-event-handlers-visibility', () => {
  it('marks dirty chunks and pauses or resumes the game loop', async () => {
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const pauseSpy = vi.fn()
    const resumeSpy = vi.fn()
    const saveSpy = vi.fn()
    let hidden = true

    const handleVisibilityChange = createBrowserVisibilityChangeHandler({
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
      isDocumentHidden: () => hidden,
      bestEffortSave: Effect.sync(() => {
        saveSpy()
      }),
    })

    handleVisibilityChange()
    await Effect.runPromise(Effect.yieldNow())
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(true)
    expect(saveSpy).toHaveBeenCalledOnce()
    expect(pauseSpy).toHaveBeenCalledOnce()

    hidden = false
    handleVisibilityChange()
    await Effect.runPromise(Effect.yieldNow())
    expect(resumeSpy).toHaveBeenCalledOnce()
    expect(saveSpy).toHaveBeenCalledOnce()
  })
})
