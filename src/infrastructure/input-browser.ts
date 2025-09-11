import { InputManager } from '@/infrastructure/services/input-manager.service'
import { Context, Effect, Layer, Ref, Queue } from 'effect'

export type DomEvent =
  | { _tag: 'keydown'; event: KeyboardEvent }
  | { _tag: 'keyup'; event: KeyboardEvent }
  | { _tag: 'mousedown'; event: MouseEvent }
  | { _tag: 'mouseup'; event: MouseEvent }
  | { _tag: 'mousemove'; event: MouseEvent }
  | { _tag: 'pointerlockchange' }

export const DomEventQueue = Context.Tag<Queue.Queue<DomEvent>>('DomEventQueue')

export const InputManagerLiveRaw = Layer.scoped(
  InputManager,
  Effect.gen(function* (_) {
    const isLocked = yield* _(Ref.make(false))
    const keyboardState = yield* _(Ref.make(new Set<string>()))
    const mouseButtonState = yield* _(Ref.make(new Set<number>()))
    const mouseState = yield* _(Ref.make({ dx: 0, dy: 0 }))
    const eventQueue = yield* _(DomEventQueue)

    yield* _(
      Effect.acquireRelease(
        Effect.sync(() => {
          const keydownListener = (event: KeyboardEvent) =>
            Queue.unsafeOffer(eventQueue, { _tag: 'keydown', event })
          const keyupListener = (event: KeyboardEvent) =>
            Queue.unsafeOffer(eventQueue, { _tag: 'keyup', event })
          const mousedownListener = (event: MouseEvent) =>
            Queue.unsafeOffer(eventQueue, { _tag: 'mousedown', event })
          const mouseupListener = (event: MouseEvent) =>
            Queue.unsafeOffer(eventQueue, { _tag: 'mouseup', event })
          const mousemoveListener = (event: MouseEvent) =>
            Queue.unsafeOffer(eventQueue, { _tag: 'mousemove', event })
          const pointerlockchangeListener = () =>
            Queue.unsafeOffer(eventQueue, { _tag: 'pointerlockchange' })

          document.addEventListener('keydown', keydownListener)
          document.addEventListener('keyup', keyupListener)
          document.addEventListener('mousedown', mousedownListener)
          document.addEventListener('mouseup', mouseupListener)
          document.addEventListener('mousemove', mousemoveListener)
          document.addEventListener('pointerlockchange', pointerlockchangeListener)

          return {
            keydownListener,
            keyupListener,
            mousedownListener,
            mouseupListener,
            mousemoveListener,
            pointerlockchangeListener,
          }
        }),
        (listeners) =>
          Effect.sync(() => {
            document.removeEventListener('keydown', listeners.keydownListener)
            document.removeEventListener('keyup', listeners.keyupListener)
            document.removeEventListener('mousedown', listeners.mousedownListener)
            document.removeEventListener('mouseup', listeners.mouseupListener)
            document.removeEventListener('mousemove', listeners.mousemoveListener)
            document.removeEventListener(
              'pointerlockchange',
              listeners.pointerlockchangeListener,
            )
          }),
      ),
    )

    const handleEvent = (event: DomEvent) => {
      switch (event._tag) {
        case 'keydown':
          return Ref.update(keyboardState, (s) => s.add(event.event.code))
        case 'keyup':
          return Ref.update(keyboardState, (s) => {
            s.delete(event.event.code)
            return s
          })
        case 'mousedown':
          return Ref.update(mouseButtonState, (s) => s.add(event.event.button))
        case 'mouseup':
          return Ref.update(mouseButtonState, (s) => {
            s.delete(event.event.button)
            return s
          })
        case 'mousemove':
          return Ref.get(isLocked).pipe(
            Effect.if({
              onTrue: Ref.set(mouseState, {
                dx: event.event.movementX,
                dy: event.event.movementY,
              }),
              onFalse: Effect.void,
            }),
          )
        case 'pointerlockchange':
          return Ref.set(isLocked, document.pointerLockElement !== null)
      }
    }

    yield* _(
      Queue.take(eventQueue).pipe(
        Effect.flatMap(handleEvent),
        Effect.forever,
        Effect.forkScoped,
      ),
    )

    const getState = () =>
      Effect.all([Ref.get(keyboardState), Ref.get(mouseButtonState)]).pipe(
        Effect.map(([keyboard, mouse]) => ({
          forward: keyboard.has('KeyW'),
          backward: keyboard.has('KeyS'),
          left: keyboard.has('KeyA'),
          right: keyboard.has('KeyD'),
          jump: keyboard.has('Space'),
          sprint: keyboard.has('ShiftLeft'),
          place: mouse.has(2), // Right click
          destroy: mouse.has(0), // Left click
        })),
      )

    const getMouseState = () => Ref.getAndSet(mouseState, { dx: 0, dy: 0 })

    return {
      isLocked,
      getState,
      getMouseState,
    }
  }),
)

export const InputManagerLive = InputManagerLiveRaw.pipe(
  Layer.provide(Layer.effect(DomEventQueue, Queue.unbounded<DomEvent>())),
)