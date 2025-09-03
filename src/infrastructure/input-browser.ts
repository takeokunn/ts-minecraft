import { InputManager } from '@/runtime/services'
import { Effect, Layer, Ref, Hub } from 'effect'

type DomEvent =
  | { _tag: 'keydown'; event: KeyboardEvent }
  | { _tag: 'keyup'; event: KeyboardEvent }
  | { _tag: 'mousedown'; event: MouseEvent }
  | { _tag: 'mouseup'; event: MouseEvent }
  | { _tag: 'mousemove'; event: MouseEvent }
  | { _tag: 'pointerlockchange' }

export const InputManagerLive = Layer.scoped(
  InputManager,
  Effect.gen(function* (_) {
    const isLocked = yield* _(Ref.make(false))
    const keyboardState = yield* _(Ref.make(new Set<string>()))
    const mouseButtonState = yield* _(Ref.make(new Set<number>()))
    const mouseState = yield* _(Ref.make({ dx: 0, dy: 0 }))
    const eventHub = yield* _(Hub.unbounded<DomEvent>())

    const registerEventListener = <K extends keyof DocumentEventMap>(
      type: K,
      listener: (this: Document, ev: DocumentEventMap[K]) => any,
    ) =>
      Effect.acquireRelease(
        Effect.sync(() => document.addEventListener(type, listener)),
        () => Effect.sync(() => document.removeEventListener(type, listener)),
      )

    yield* _(
      registerEventListener('keydown', (event) => Effect.runFork(Hub.publish(eventHub, { _tag: 'keydown', event }))),
    )
    yield* _(
      registerEventListener('keyup', (event) => Effect.runFork(Hub.publish(eventHub, { _tag: 'keyup', event }))),
    )
    yield* _(
      registerEventListener('mousedown', (event) =>
        Effect.runFork(Hub.publish(eventHub, { _tag: 'mousedown', event })),
      ),
    )
    yield* _(
      registerEventListener('mouseup', (event) => Effect.runFork(Hub.publish(eventHub, { _tag: 'mouseup', event }))),
    )
    yield* _(
      registerEventListener('mousemove', (event) =>
        Effect.runFork(Hub.publish(eventHub, { _tag: 'mousemove', event })),
      ),
    )
    yield* _(
      registerEventListener('pointerlockchange', () => Effect.runFork(Hub.publish(eventHub, { _tag: 'pointerlockchange' }))),
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
      Hub.subscribe(eventHub).pipe(
        Effect.flatMap((subscription) => Effect.forever(subscription.take.pipe(Effect.flatMap(handleEvent)))),
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

    return InputManager.of({
      isLocked,
      getState,
      getMouseState,
    })
  }),
)