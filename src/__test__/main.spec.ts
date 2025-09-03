import { Archetype } from '@/domain/archetypes'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { main, gameSystems } from '../main'
import * as fc from 'effect/FastCheck'
import * as EffectVitest from '@effect/vitest'

// Mock dependencies
vi.mock('@/domain/archetypes', () => ({
  createArchetype: vi.fn(() => Effect.succeed({} as Archetype)),
}))

const createArchetype = vi.mocked(
  (await import('@/domain/archetypes')).createArchetype,
)

describe('main', () => {
  const addArchetypeMock = vi.fn(() => Effect.void)
  const gameLoopMock = vi.fn(() => Effect.void)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize the world and start the game loop', async () => {
    const playerArchetype: Archetype = {
      Position: { x: 0, y: 80, z: 0 },
      Player: { isGrounded: false },
    }
    createArchetype.mockReturnValue(Effect.succeed(playerArchetype))

    const program = main(addArchetypeMock, gameLoopMock)
    await Effect.runPromise(program)

    expect(createArchetype).toHaveBeenCalledTimes(1)
    expect(createArchetype).toHaveBeenCalledWith({
      type: 'player',
      pos: { x: 0, y: 80, z: 0 },
    })

    expect(addArchetypeMock).toHaveBeenCalledTimes(1)
    expect(addArchetypeMock).toHaveBeenCalledWith(playerArchetype)

    expect(gameLoopMock).toHaveBeenCalledTimes(1)
    expect(gameLoopMock).toHaveBeenCalledWith(gameSystems)
  })

  EffectVitest.it.effect('should always complete successfully', () =>
    Effect.gen(function* (_) {
      const program = main(addArchetypeMock, gameLoopMock)

      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(fc.void(), async () => {
              vi.clearAllMocks()
              await Effect.runPromise(program)

              expect(createArchetype).toHaveBeenCalledTimes(1)
              expect(addArchetypeMock).toHaveBeenCalledTimes(1)
              expect(gameLoopMock).toHaveBeenCalledTimes(1)
            }),
          ),
        ),
      )
    }),
  )
})
