import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option, Ref } from 'effect'

import { createSessionRuntimeBootstrapState } from '@ts-minecraft/app/main/session-bootstrap-runtime-state'

describe('session-bootstrap-runtime-state', () => {
  it.effect('creates the runtime bootstrap refs and reads the hud elements once', () =>
    Effect.gen(function* () {
      const getElementById = vi.fn().mockReturnValue(null)
      vi.stubGlobal('document', { getElementById })

      const state = yield* createSessionRuntimeBootstrapState

      expect(Option.isNone(MutableRef.get(state.pendingResizeRef))).toBe(true)
      expect(MutableRef.get(state.pendingSaveDirtyChunksRef)).toBe(false)
      expect(yield* Ref.get(state.gamePausedRef)).toBe(false)
      expect(state.hudElements.fpsElement).toBeNull()
      expect(getElementById).toHaveBeenCalledWith('fps-value')
      expect(getElementById).toHaveBeenCalledWith('break-progress')
    })
  )
})
