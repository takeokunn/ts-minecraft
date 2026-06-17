import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { MutableRef } from 'effect'

import { createBrowserPageLifecycleHandlers } from './browser-runtime-event-handlers-page-lifecycle'

describe('browser-runtime-event-handlers-page-lifecycle', () => {
  it('wires visibility and beforeunload handlers', () => {
    const pendingSaveDirtyChunksRef = MutableRef.make(false)

    const { handleVisibilityChange, handleBeforeUnload } = createBrowserPageLifecycleHandlers({
      pendingSaveDirtyChunksRef,
      isDocumentHidden: () => false,
    })

    expect(handleVisibilityChange).toBeTypeOf('function')
    expect(handleBeforeUnload).toBeTypeOf('function')
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })
})
