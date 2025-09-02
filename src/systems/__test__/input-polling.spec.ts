import { Effect, Layer, Option } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { InputManagerService } from '@/runtime/services'
import { World, WorldLive } from '@/runtime/world'
import { inputPollingSystem } from '../input-polling'

const MockInputManager = (keyboard: Set<string>, isLocked: boolean) =>
  Layer.succeed(
    InputManagerService,
    InputManagerService.of({
      getState: Effect.succeed({ keyboard, isLocked, mouse: { dx: 0, dy: 0 } }),
      getMouseDelta: Effect.succeed({ dx: 0, dy: 0 }),
      registerListeners: Effect.void,
      cleanup: Effect.void,
      lock: Effect.void,
      unlock: Effect.void,
    }),
  )

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)
  const playerArchetype = createArchetype({
    type: 'player',
    pos: { x: 0, y: 1, z: 0 },
  })
  const playerId = yield* _(world.addArchetype(playerArchetype))
  return { playerId }
})

describe('inputPollingSystem', () => {
  it('should update input state based on keyboard input', async () => {
    const keyboard = new Set(['KeyW', 'Space'])
    const isLocked = true
    const mockInput = MockInputManager(keyboard, isLocked)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId } = yield* _(setupWorld)

      yield* _(inputPollingSystem)

      const inputState = yield* _(world.getComponent(playerId, 'inputState'))
      expect(Option.isSome(inputState)).toBe(true)
      const state = Option.getOrThrow(inputState)

      expect(state.forward).toBe(true)
      expect(state.jump).toBe(true)
      expect(state.backward).toBe(false)
      expect(state.isLocked).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, mockInput)))
  })
})