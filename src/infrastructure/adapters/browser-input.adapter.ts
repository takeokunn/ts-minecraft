/**
 * Browser Input Adapter - Implements input operations using browser DOM events
 *
 * This adapter provides concrete implementation for input handling
 * using browser DOM events, implementing the IInputPort interface
 * to isolate the domain layer from browser-specific input details.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Match from 'effect/Match'
import { IInputPort, MouseState, KeyboardState } from '@/domain/ports/input.port'

/**
 * DOM event types for input processing
 */
export type DomEvent =
  | { readonly _tag: 'keydown'; readonly event: KeyboardEvent }
  | { readonly _tag: 'keyup'; readonly event: KeyboardEvent }
  | { readonly _tag: 'mousedown'; readonly event: MouseEvent }
  | { readonly _tag: 'mouseup'; readonly event: MouseEvent }
  | { readonly _tag: 'mousemove'; readonly event: MouseEvent }
  | { readonly _tag: 'pointerlockchange' }
  | { readonly _tag: 'contextmenu'; readonly event: Event }

/**
 * Internal input state management
 */
interface InternalInputState {
  readonly keysPressed: Set<string>
  readonly keysJustPressed: Set<string>
  readonly keysJustReleased: Set<string>
  readonly mouseButtons: Set<number>
  readonly mousePosition: { readonly x: number; readonly y: number }
  readonly mouseDelta: { readonly dx: number; readonly dy: number }
  readonly isPointerLocked: boolean
}

/**
 * Browser Input Adapter implementation
 */
export interface IBrowserInputAdapter extends IInputPort {
  readonly eventQueue: Queue.Queue<DomEvent>
  readonly processEvents: () => Effect.Effect<void, never, never>
}

export class BrowserInputAdapter extends Context.GenericTag('BrowserInputAdapter')<BrowserInputAdapter, IBrowserInputAdapter>() {}

/**
 * Browser Input Adapter Layer
 */
export const BrowserInputAdapterLive = Layer.scoped(
  BrowserInputAdapter,
  Effect.gen(function* (_) {
    const eventQueue = yield* _(Queue.unbounded<DomEvent>())
    const inputState = yield* _(
      Ref.make<InternalInputState>({
        keysPressed: new Set(),
        keysJustPressed: new Set(),
        keysJustReleased: new Set(),
        mouseButtons: new Set(),
        mousePosition: { x: 0, y: 0 },
        mouseDelta: { dx: 0, dy: 0 },
        isPointerLocked: false,
      }),
    )

    // Set up DOM event listeners
    yield* _(
      Effect.acquireRelease(
        Effect.sync(() => {
          const keydownListener = (event: KeyboardEvent) => {
            event.preventDefault()
            Queue.unsafeOffer(eventQueue, { _tag: 'keydown', event })
          }

          const keyupListener = (event: KeyboardEvent) => {
            event.preventDefault()
            Queue.unsafeOffer(eventQueue, { _tag: 'keyup', event })
          }

          const mousedownListener = (event: MouseEvent) => {
            event.preventDefault()
            Queue.unsafeOffer(eventQueue, { _tag: 'mousedown', event })
          }

          const mouseupListener = (event: MouseEvent) => {
            event.preventDefault()
            Queue.unsafeOffer(eventQueue, { _tag: 'mouseup', event })
          }

          const mousemoveListener = (event: MouseEvent) => {
            Queue.unsafeOffer(eventQueue, { _tag: 'mousemove', event })
          }

          const pointerlockchangeListener = () => {
            Queue.unsafeOffer(eventQueue, { _tag: 'pointerlockchange' })
          }

          const contextmenuListener = (event: Event) => {
            event.preventDefault()
            Queue.unsafeOffer(eventQueue, { _tag: 'contextmenu', event })
          }

          document.addEventListener('keydown', keydownListener)
          document.addEventListener('keyup', keyupListener)
          document.addEventListener('mousedown', mousedownListener)
          document.addEventListener('mouseup', mouseupListener)
          document.addEventListener('mousemove', mousemoveListener)
          document.addEventListener('pointerlockchange', pointerlockchangeListener)
          document.addEventListener('contextmenu', contextmenuListener)

          return {
            keydownListener,
            keyupListener,
            mousedownListener,
            mouseupListener,
            mousemoveListener,
            pointerlockchangeListener,
            contextmenuListener,
          }
        }),
        (listeners) =>
          Effect.sync(() => {
            document.removeEventListener('keydown', listeners.keydownListener)
            document.removeEventListener('keyup', listeners.keyupListener)
            document.removeEventListener('mousedown', listeners.mousedownListener)
            document.removeEventListener('mouseup', listeners.mouseupListener)
            document.removeEventListener('mousemove', listeners.mousemoveListener)
            document.removeEventListener('pointerlockchange', listeners.pointerlockchangeListener)
            document.removeEventListener('contextmenu', listeners.contextmenuListener)
          }),
      ),
    )

    const handleEvent = (event: DomEvent) =>
      Match.value(event).pipe(
        Match.when({ _tag: 'keydown' }, ({ event }) =>
          Ref.update(inputState, (state) => ({
            ...state,
            keysPressed: new Set([...state.keysPressed, event.code]),
            keysJustPressed: new Set([...state.keysJustPressed, event.code]),
          })),
        ),
        Match.when({ _tag: 'keyup' }, ({ event }) =>
          Ref.update(inputState, (state) => {
            const newKeysPressed = new Set(state.keysPressed)
            newKeysPressed.delete(event.code)
            return {
              ...state,
              keysPressed: newKeysPressed,
              keysJustReleased: new Set([...state.keysJustReleased, event.code]),
            }
          }),
        ),
        Match.when({ _tag: 'mousedown' }, ({ event }) =>
          Ref.update(inputState, (state) => ({
            ...state,
            mouseButtons: new Set([...state.mouseButtons, event.button]),
            mousePosition: { x: event.clientX, y: event.clientY },
          })),
        ),
        Match.when({ _tag: 'mouseup' }, ({ event }) =>
          Ref.update(inputState, (state) => {
            const newMouseButtons = new Set(state.mouseButtons)
            newMouseButtons.delete(event.button)
            return {
              ...state,
              mouseButtons: newMouseButtons,
              mousePosition: { x: event.clientX, y: event.clientY },
            }
          }),
        ),
        Match.when({ _tag: 'mousemove' }, ({ event }) =>
          Ref.update(inputState, (state) => ({
            ...state,
            mousePosition: { x: event.clientX, y: event.clientY },
            mouseDelta: state.isPointerLocked ? { dx: event.movementX, dy: event.movementY } : { dx: 0, dy: 0 },
          })),
        ),
        Match.when({ _tag: 'pointerlockchange' }, () =>
          Ref.update(inputState, (state) => ({
            ...state,
            isPointerLocked: document.pointerLockElement !== null,
          })),
        ),
        Match.when({ _tag: 'contextmenu' }, () => Effect.void),
        Match.exhaustive,
      )

    const processEvents = () =>
      Queue.take(eventQueue).pipe(
        Effect.flatMap(handleEvent),
        Effect.catchAll((error) => Effect.logError('Error processing input event', error)),
      )

    // Start processing events in background
    yield* _(processEvents().pipe(Effect.forever, Effect.forkScoped))

    const getMouseState = (): Effect.Effect<MouseState, never, never> =>
      Ref.get(inputState).pipe(
        Effect.map((state) => ({
          dx: state.mouseDelta.dx,
          dy: state.mouseDelta.dy,
          x: state.mousePosition.x,
          y: state.mousePosition.y,
          leftPressed: state.mouseButtons.has(0),
          rightPressed: state.mouseButtons.has(2),
          middlePressed: state.mouseButtons.has(1),
        })),
      )

    const resetMouseDelta = (): Effect.Effect<void, never, never> =>
      Ref.update(inputState, (state) => ({
        ...state,
        mouseDelta: { dx: 0, dy: 0 },
      }))

    const getKeyboardState = (): Effect.Effect<KeyboardState, never, never> =>
      Ref.get(inputState).pipe(
        Effect.map((state) => ({
          keysPressed: state.keysPressed,
          keysJustPressed: state.keysJustPressed,
          keysJustReleased: state.keysJustReleased,
        })),
      )

    const isKeyPressed = (key: string): Effect.Effect<boolean, never, never> => Ref.get(inputState).pipe(Effect.map((state) => state.keysPressed.has(key)))

    const isKeyJustPressed = (key: string): Effect.Effect<boolean, never, never> => Ref.get(inputState).pipe(Effect.map((state) => state.keysJustPressed.has(key)))

    const isKeyJustReleased = (key: string): Effect.Effect<boolean, never, never> => Ref.get(inputState).pipe(Effect.map((state) => state.keysJustReleased.has(key)))

    const update = (): Effect.Effect<void, never, never> =>
      Ref.update(inputState, (state) => ({
        ...state,
        keysJustPressed: new Set(),
        keysJustReleased: new Set(),
      }))

    const lockPointer = (): Effect.Effect<void, never, never> =>
      Effect.sync(() => {
        const canvas = document.querySelector('canvas')
        if (canvas) {
          canvas.requestPointerLock()
        }
      })

    const unlockPointer = (): Effect.Effect<void, never, never> =>
      Effect.sync(() => {
        document.exitPointerLock()
      })

    const isPointerLocked = (): Effect.Effect<boolean, never, never> => Ref.get(inputState).pipe(Effect.map((state) => state.isPointerLocked))

    return BrowserInputAdapter.of({
      eventQueue,
      processEvents,
      getMouseState,
      resetMouseDelta,
      getKeyboardState,
      isKeyPressed,
      isKeyJustPressed,
      isKeyJustReleased,
      update,
      lockPointer,
      unlockPointer,
      isPointerLocked,
    })
  }),
)
