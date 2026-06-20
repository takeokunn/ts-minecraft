import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef } from 'effect'

import { createBrowserBeforeUnloadHandler } from './browser-runtime-event-handlers-before-unload'

describe('browser-runtime-event-handlers-before-unload', () => {
  it('marks dirty chunks before unload', () => {
    const pendingSaveDirtyChunksRef = MutableRef.make(false)

    const handleBeforeUnload = createBrowserBeforeUnloadHandler({
      pendingSaveDirtyChunksRef,
    })

    handleBeforeUnload()
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(true)
  })

  it('forks the best effort save after marking dirty chunks', async () => {
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const saveSpy = vi.fn()

    const handleBeforeUnload = createBrowserBeforeUnloadHandler({
      pendingSaveDirtyChunksRef,
      bestEffortSave: Effect.sync(() => {
        saveSpy()
      }),
    })

    handleBeforeUnload()
    await Effect.runPromise(Effect.yieldNow())

    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(true)
    expect(saveSpy).toHaveBeenCalledOnce()
  })
})
