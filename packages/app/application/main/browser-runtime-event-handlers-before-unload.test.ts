import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { MutableRef } from 'effect'

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
})
