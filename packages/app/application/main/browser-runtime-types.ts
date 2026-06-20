import type { Effect, MutableRef, Option, Ref } from 'effect'
import type { FrameHandler, GameLoopService } from '@ts-minecraft/game'

export type PendingResize = { readonly width: number; readonly height: number }

export type BrowserEventBridgeDeps = {
  readonly canvas: HTMLCanvasElement
  readonly inputPointerLock: Effect.Effect<void, never>
  // Pause state: while a menu is open we must NOT re-acquire pointer lock on a
  // canvas click, or pressing ESC would free the cursor only for the next click
  // to immediately re-capture it (focus feels stuck).
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gameLoopService?: GameLoopService
  readonly frameHandler?: FrameHandler
}
