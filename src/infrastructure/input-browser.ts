import { Context, Effect, Layer, Ref, Scope } from 'effect'
import { match } from 'ts-pattern'
import type { BrowserInputState } from '@/domain/types'

// --- Type Definitions ---

export type LockableControls = {
  readonly isLocked: boolean
  lock: () => void
  unlock: () => void
  addEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
  removeEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
}

// --- Service Definition ---

export interface InputManager {
  readonly getState: Effect.Effect<BrowserInputState>
  readonly getMouseDelta: Effect.Effect<{ dx: number; dy: number }>
  readonly registerListeners: (controls: LockableControls) => Effect.Effect<void, never, Scope.Scope>
}

export const InputManagerService = Context.GenericTag<InputManager>('app/InputManager')

// --- Live Implementation ---

const makeEventListener = <K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  listener: (ev: DocumentEventMap[K]) => Effect.Effect<void>,
) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      import { Context, Effect, Layer, Ref, Scope, Match } from 'effect'
import type { BrowserInputState } from '@/domain/types'

// --- Type Definitions ---

export type LockableControls = {
  readonly isLocked: boolean
  lock: () => void
  unlock: () => void
  addEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
  removeEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
}

// --- Service Definition ---

export interface InputManager {
  readonly getState: Effect.Effect<BrowserInputState>
  readonly getMouseDelta: Effect.Effect<{ dx: number; dy: number }>
  readonly registerListeners: (controls: LockableControls) => Effect.Effect<void, never, Scope.Scope>
}

export const InputManagerService = Context.GenericTag<InputManager>('app/InputManager')

// --- Live Implementation ---

const makeEventListener = <K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  listener: (ev: DocumentEventMap[K]) => Effect.Effect<void>,
) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const handler = (ev: DocumentEventMap[K]) => Effect.runFork(listener(ev))
      target.addEventListener(type, handler)
      return handler
    }),
    (handler) => Effect.sync(() => target.removeEventListener(type, handler)),
  )

const makeControlsEventListener = (
  controls: LockableControls,
  type: 'lock' | 'unlock',
  listener: () => Effect.Effect<void>,
) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const handler = () => Effect.runFork(listener())
      controls.addEventListener(type, handler)
      return handler
    }),
    (handler) => Effect.sync(() => controls.removeEventListener(type, handler)),
  )

export const InputManagerLive = Layer.effect(
  InputManagerService,
  Effect.gen(function* ($) {
    const stateRef = yield* $(
      Ref.make<BrowserInputState>({
        keyboard: new Set<string>(),
        mouse: { dx: 0, dy: 0 },
        isLocked: false,
      }),
    )

    const registerListeners = (controls: LockableControls) =>
      Effect.gen(function* ($) {
        const getMouseButtonKey = (button: number) =>
          Match.value(button).pipe(
            Match.when(0, () => 'Mouse0' as const),
            Match.when(2, () => 'Mouse2' as const),
            Match.orElse(() => null),
          )

        const handleMouseButton = (event: MouseEvent, action: 'add' | 'delete') =>
          Effect.flatMap(Ref.get(stateRef), (s) => {
            if (s.isLocked) {
              const key = getMouseButtonKey(event.button)
              if (key) {
                const newKeyboard = new Set(s.keyboard)
                newKeyboard[action](key)
                return Ref.update(stateRef, (s) => ({ ...s, keyboard: newKeyboard }))
              }
            }
            return Effect.void
          })

        const onKeyDown = (event: KeyboardEvent) => Ref.update(stateRef, (s) => ({ ...s, keyboard: new Set(s.keyboard).add(event.code) }))
        const onKeyUp = (event: KeyboardEvent) =>
          Ref.update(stateRef, (s) => {
            const newKeyboard = new Set(s.keyboard)
            newKeyboard.delete(event.code)
            return { ...s, keyboard: newKeyboard }
          })
        const onMouseMove = (event: MouseEvent) =>
          Ref.update(stateRef, (s) =>
            s.isLocked
              ? {
                  ...s,
                  mouse: {
                    dx: s.mouse.dx + (event.movementX ?? 0),
                    dy: s.mouse.dy + (event.movementY ?? 0),
                  },
                }
              : s,
          )
        const onMouseDown = (event: MouseEvent) =>
          Effect.flatMap(Ref.get(stateRef), (s) =>
            s.isLocked
              ? handleMouseButton(event, 'add')
              : Effect.sync(() => controls.lock()))
        const onMouseUp = (event: MouseEvent) => handleMouseButton(event, 'delete')
        const onLock = () => Ref.update(stateRef, (s) => ({ ...s, isLocked: true }))
        const onUnlock = () => Ref.update(stateRef, (s) => ({ ...s, isLocked: false }))

        yield* $(
          Effect.all(
            [
              makeEventListener(document, 'keydown', onKeyDown),
              makeEventListener(document, 'keyup', onKeyUp),
              makeEventListener(document, 'mousemove', onMouseMove),
              makeEventListener(document, 'mousedown', onMouseDown),
              makeEventListener(document, 'mouseup', onMouseUp),
              makeControlsEventListener(controls, 'lock', onLock),
              makeControlsEventListener(controls, 'unlock', onUnlock),
              Effect.acquireRelease(
                Effect.void,
                () => Effect.sync(() => {
                  if (controls.isLocked)
                    controls.unlock()
                }),
              ),
            ],
            { discard: true },
          ),
        )
      }).pipe(Effect.scoped)

    const getState = Ref.get(stateRef)

    const getMouseDelta = Ref.modify(stateRef, (s) => {
      const delta = { dx: s.mouse.dx, dy: s.mouse.dy }
      const newState = { ...s, mouse: { dx: 0, dy: 0 } }
      const result: readonly [typeof delta, typeof newState] = [delta, newState]
      return result
    })

    return {
      getState,
      getMouseDelta,
      registerListeners,
    }
  }),
)

      target.addEventListener(type, handler)
      return handler
    }),
    (handler) => Effect.sync(() => target.removeEventListener(type, handler)),
  )

const makeControlsEventListener = (
  controls: LockableControls,
  type: 'lock' | 'unlock',
  listener: () => Effect.Effect<void>,
) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const handler = () => Effect.runFork(listener())
      controls.addEventListener(type, handler)
      return handler
    }),
    (handler) => Effect.sync(() => controls.removeEventListener(type, handler)),
  )

export const InputManagerLive = Layer.effect(
  InputManagerService,
  Effect.gen(function* ($) {
    const stateRef = yield* $(
      Ref.make<BrowserInputState>({
        keyboard: new Set<string>(),
        mouse: { dx: 0, dy: 0 },
        isLocked: false,
      }),
    )

    const registerListeners = (controls: LockableControls) =>
      Effect.gen(function* ($) {
        const getMouseButtonKey = (button: number) =>
          match(button)
            .with(0, () => 'Mouse0' as const)
            .with(2, () => 'Mouse2' as const)
            .otherwise(() => null)

        const handleMouseButton = (event: MouseEvent, action: 'add' | 'delete') =>
          Effect.flatMap(Ref.get(stateRef), (s) => {
            if (s.isLocked) {
              const key = getMouseButtonKey(event.button)
              if (key) {
                const newKeyboard = new Set(s.keyboard)
                newKeyboard[action](key)
                return Ref.update(stateRef, (s) => ({ ...s, keyboard: newKeyboard }))
              }
            }
            return Effect.void
          })

        const onKeyDown = (event: KeyboardEvent) => Ref.update(stateRef, (s) => ({ ...s, keyboard: new Set(s.keyboard).add(event.code) }))
        const onKeyUp = (event: KeyboardEvent) =>
          Ref.update(stateRef, (s) => {
            const newKeyboard = new Set(s.keyboard)
            newKeyboard.delete(event.code)
            return { ...s, keyboard: newKeyboard }
          })
        const onMouseMove = (event: MouseEvent) =>
          Ref.update(stateRef, (s) =>
            s.isLocked
              ? {
                  ...s,
                  mouse: {
                    dx: s.mouse.dx + (event.movementX ?? 0),
                    dy: s.mouse.dy + (event.movementY ?? 0),
                  },
                }
              : s,
          )
        const onMouseDown = (event: MouseEvent) =>
          Effect.flatMap(Ref.get(stateRef), (s) =>
            s.isLocked
              ? handleMouseButton(event, 'add')
              : Effect.sync(() => controls.lock()))
        const onMouseUp = (event: MouseEvent) => handleMouseButton(event, 'delete')
        const onLock = () => Ref.update(stateRef, (s) => ({ ...s, isLocked: true }))
        const onUnlock = () => Ref.update(stateRef, (s) => ({ ...s, isLocked: false }))

        yield* $(
          Effect.all(
            [
              makeEventListener(document, 'keydown', onKeyDown),
              makeEventListener(document, 'keyup', onKeyUp),
              makeEventListener(document, 'mousemove', onMouseMove),
              makeEventListener(document, 'mousedown', onMouseDown),
              makeEventListener(document, 'mouseup', onMouseUp),
              makeControlsEventListener(controls, 'lock', onLock),
              makeControlsEventListener(controls, 'unlock', onUnlock),
              Effect.acquireRelease(
                Effect.void,
                () => Effect.sync(() => {
                  if (controls.isLocked)
                    controls.unlock()
                }),
              ),
            ],
            { discard: true },
          ),
        )
      }).pipe(Effect.scoped)

    const getState = Ref.get(stateRef)

    const getMouseDelta = Ref.modify(stateRef, (s) => {
      const delta = { dx: s.mouse.dx, dy: s.mouse.dy }
      const newState = { ...s, mouse: { dx: 0, dy: 0 } }
      const result: readonly [typeof delta, typeof newState] = [delta, newState]
      return result
    })

    return {
      getState,
      getMouseDelta,
      registerListeners,
    }
  }),
)