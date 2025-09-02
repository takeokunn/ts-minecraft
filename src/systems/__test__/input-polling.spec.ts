import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { InputState } from '@/domain/components'
import { InputManagerService } from '@/runtime/services'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
import { inputPollingSystem } from '../input-polling'

const mockInput = Layer.succeed(
  InputManagerService,
  InputManagerService.of({
    getMouseDelta: Effect.succeed({ dx: 0, dy: 0 }),
    getState: Effect.succeed({
      keyboard: new Set(['KeyW', 'Space']),
      isLocked: true,
      mouse: { dx: 0, dy: 0 },
    }),
    registerListeners: () => Effect.void,
    cleanup: Effect.void,
  }),
)

const setupWorld = () =>
  Effect.gen(function* ($) {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* $(World.addArchetype(playerArchetype))
    return { playerId }
  })

describe('inputPollingSystem', () => {
  it('should update inputState based on input manager', () =>
    Effect.gen(function* ($) {
      const { playerId } = yield* $(setupWorld())
      yield* $(inputPollingSystem)
      const inputState = yield* $(World.getComponent(playerId, 'inputState'))
      const state = new InputState(inputState)
      expect(state.forward).toBe(true)
      expect(state.jump).toBe(true)
      expect(state.backward).toBe(false)
      expect(state.isLocked).toBe(true)
    }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(mockInput)))))
})
