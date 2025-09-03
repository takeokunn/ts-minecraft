import { Effect } from 'effect/Effect'
import { Layer } from 'effect/Layer'
import { Ref } from 'effect/Ref'
import { Hub } from 'effect/Hub'
import { Context } from 'effect/Context'
import { describe, it, assert } from '@effect/vitest'
import { InputManager } from '@/runtime/services'
import { InputManagerLive } from '../input-browser'
import type { DomEvent } from '../input-browser'

const HubTag = Context.Tag<Hub.Hub<DomEvent>>()

const TestHub = Layer.effect(HubTag, Hub.unbounded<DomEvent>())

const TestInputManager = Layer.provide(InputManagerLive, TestHub)

describe('InputManager', () => {
  it.effect('should update keyboard state on keydown and keyup', () =>
    Effect.gen(function* (_) {
      const input = yield* _(InputManager)
      const hub = yield* _(HubTag)

      yield* _(hub.publish({ _tag: 'keydown', event: new KeyboardEvent('keydown', { code: 'KeyW' }) }))
      let state = yield* _(input.getState())
      assert.isTrue(state.forward)

      yield* _(hub.publish({ _tag: 'keyup', event: new KeyboardEvent('keyup', { code: 'KeyW' }) }))
      state = yield* _(input.getState())
      assert.isFalse(state.forward)
    }).pipe(Effect.provide(TestInputManager)))
})