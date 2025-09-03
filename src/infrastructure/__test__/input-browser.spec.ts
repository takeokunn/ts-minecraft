import { Effect, Layer, Queue, ReadonlyArray } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { InputManager } from '@/runtime/services'
import { InputManagerLiveRaw, DomEventQueue, DomEvent } from '../input-browser'

const TestInputManager = InputManagerLiveRaw.pipe(
  Layer.provide(Layer.effect(DomEventQueue, Queue.unbounded<DomEvent>())),
)

const keyEvent = (type: 'keydown' | 'keyup', code: string): DomEvent => ({
  _tag: type,
  event: new KeyboardEvent(type, { code }),
})

const mouseEvent = (type: 'mousedown' | 'mouseup', button: number): DomEvent => ({
  _tag: type,
  event: new MouseEvent(type, { button }),
})

const domEventArb: fc.Arbitrary<DomEvent> = fc.oneof(
  fc.record({ _tag: fc.constant('keydown'), event: fc.record({ code: fc.string() }) }),
  fc.record({ _tag: fc.constant('keyup'), event: fc.record({ code: fc.string() }) }),
  fc.record({ _tag: fc.constant('mousedown'), event: fc.record({ button: fc.integer() }) }),
  fc.record({ _tag: fc.constant('mouseup'), event: fc.record({ button: fc.integer() }) }),
  fc.record({
    _tag: fc.constant('mousemove'),
    event: fc.record({ movementX: fc.float(), movementY: fc.float() }),
  }),
  fc.record({ _tag: fc.constant('pointerlockchange') }),
) as fc.Arbitrary<DomEvent>

describe('InputManager', () => {
  it.effect('should update keyboard state on keydown and keyup', () =>
    Effect.gen(function* (_) {
      const input = yield* _(InputManager)
      const queue = yield* _(DomEventQueue)

      yield* _(queue.offer(keyEvent('keydown', 'KeyW')))
      yield* _(Effect.yieldNow())
      let state = yield* _(input.getState())
      assert.isTrue(state.forward)

      yield* _(queue.offer(keyEvent('keyup', 'KeyW')))
      yield* _(Effect.yieldNow())
      state = yield* _(input.getState())
      assert.isFalse(state.forward)
    }).pipe(Effect.provide(TestInputManager)))

  it.effect('should correctly reflect the state after a sequence of events', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(fc.array(domEventArb), async (events) =>
              Effect.gen(function* (_) {
                const input = yield* _(InputManager)
                const queue = yield* _(DomEventQueue)

                const finalKeyboardState = new Set<string>()
                const finalMouseState = new Set<number>()

                for (const event of events) {
                  yield* _(queue.offer(event))
                  switch (event._tag) {
                    case 'keydown':
                      finalKeyboardState.add(event.event.code)
                      break
                    case 'keyup':
                      finalKeyboardState.delete(event.event.code)
                      break
                    case 'mousedown':
                      finalMouseState.add(event.event.button)
                      break
                    case 'mouseup':
                      finalMouseState.delete(event.event.button)
                      break
                  }
                }
                yield* _(Effect.yieldNow())

                const state = yield* _(input.getState())

                assert.strictEqual(state.forward, finalKeyboardState.has('KeyW'))
                assert.strictEqual(state.backward, finalKeyboardState.has('KeyS'))
                assert.strictEqual(state.left, finalKeyboardState.has('KeyA'))
                assert.strictEqual(state.right, finalKeyboardState.has('KeyD'))
                assert.strictEqual(state.jump, finalKeyboardState.has('Space'))
                assert.strictEqual(state.sprint, finalKeyboardState.has('ShiftLeft'))
                assert.strictEqual(state.destroy, finalMouseState.has(0))
                assert.strictEqual(state.place, finalMouseState.has(2))
              }).pipe(Effect.provide(TestInputManager), Effect.runPromise),
            ),
          ),
        ),
      )
    }))
})
