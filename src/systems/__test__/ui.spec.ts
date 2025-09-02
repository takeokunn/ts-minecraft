import { Effect } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { World, WorldLive } from '@/runtime/world'
import { createUISystem, HotbarUpdater } from '../ui'
import { playerQuery } from '@/domain/queries'

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)
  const playerArchetype = createArchetype({
    type: 'player',
    pos: { x: 0, y: 0, z: 0 },
  })
  yield* _(world.addArchetype(playerArchetype))
})

describe('uiSystem', () => {
  it('should call the hotbar updater with the player hotbar state', async () => {
    const hotbarUpdater: HotbarUpdater = vi.fn(() => Effect.void)
    const uiSystem = createUISystem(hotbarUpdater)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld)
      yield* _(uiSystem)

      const player = (yield* _(world.query(playerQuery)))[0]!
      expect(hotbarUpdater).toHaveBeenCalledWith(player.hotbar)
    })

    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should not call the hotbar updater if there are no players', async () => {
    const hotbarUpdater: HotbarUpdater = vi.fn(() => Effect.void)
    const uiSystem = createUISystem(hotbarUpdater)

    const program = Effect.gen(function* (_) {
      yield* _(uiSystem)
      expect(hotbarUpdater).not.toHaveBeenCalled()
    })

    await Effect.runPromise(Effect.provide(program, WorldLive))
  })
})