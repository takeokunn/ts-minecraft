import { Effect, MutableRef, Option, Ref } from 'effect'

import type { PendingResize } from '@ts-minecraft/app/main/browser-runtime-event-handlers'
import { readSessionHudElements, type SessionHudElements } from '@ts-minecraft/app/main/session-runtime-deps'

export type SessionRuntimeBootstrapState = {
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly hudElements: SessionHudElements
}

export const createSessionRuntimeBootstrapState = Effect.gen(function* () {
  const pendingResizeRef = MutableRef.make<Option.Option<PendingResize>>(Option.none())
  const pendingSaveDirtyChunksRef = MutableRef.make(false)
  const hudElements = yield* Effect.sync(readSessionHudElements)
  const gamePausedRef = yield* Ref.make(false)

  return {
    pendingResizeRef,
    pendingSaveDirtyChunksRef,
    gamePausedRef,
    hudElements,
  }
})
