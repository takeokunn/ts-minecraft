import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { MutableRef } from 'effect'

import { createBrowserPageLifecycleHandlers } from './browser-runtime-event-handlers-page-lifecycle'

describe('browser-runtime-event-handlers-page-lifecycle', () => {
  it('wires visibility, beforeunload, and pagehide handlers', () => {
    const pendingSaveDirtyChunksRef = MutableRef.make(false)

    const { handleVisibilityChange, handleBeforeUnload, handlePageHide } = createBrowserPageLifecycleHandlers({
      pendingSaveDirtyChunksRef,
      isDocumentHidden: () => false,
    })

    expect(handleVisibilityChange).toBeTypeOf('function')
    expect(handleBeforeUnload).toBeTypeOf('function')
    expect(handlePageHide).toBeTypeOf('function')
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })

  it('marks dirty chunks on pagehide', () => {
    const pendingSaveDirtyChunksRef = MutableRef.make(false)

    const { handlePageHide } = createBrowserPageLifecycleHandlers({
      pendingSaveDirtyChunksRef,
      isDocumentHidden: () => false,
    })

    handlePageHide()

    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(true)
  })
})
