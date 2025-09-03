import { Effect, Layer, Context, Queue } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { InputManager } from '@/runtime/services'
import { InputManagerLive } from '../input-browser'
import type { DomEvent } from '../input-browser'

const QueueTag = Context.Tag<Queue.Queue<DomEvent>>()

const TestInputManager = InputManagerLive.pipe(
  Layer.provide(Layer.effect(QueueTag, Queue.unbounded<DomEvent>()))
)

describe('InputManager', () => {
  it.effect('should update keyboard state on keydown and keyup', () =>
    Effect.gen(function* (_) {
      const input = yield* _(InputManager)
      const queue = yield* _(QueueTag)

      yield* _(queue.offer({ _tag: 'keydown', event: new KeyboardEvent('keydown', { code: 'KeyW' }) }))
      yield* _(Effect.sleep(50))
      let state = yield* _(input.getState())
      assert.isTrue(state.forward)

      yield* _(queue.offer({ _tag: 'keyup', event: new KeyboardEvent('keyup', { code: 'KeyW' }) }))
      yield* _(Effect.sleep(50))
      state = yield* _(input.getState())
      assert.isFalse(state.forward)
    }).pipe(Effect.provide(TestInputManager)))
})
