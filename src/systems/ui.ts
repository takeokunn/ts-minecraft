import { Effect } from 'effect'
import { Hotbar } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { World } from '@/runtime/world'

export type HotbarUpdater = (hotbar: Hotbar) => Effect.Effect<void>

export const createUISystem = (updateHotbar: HotbarUpdater) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const players = yield* _(world.query(playerQuery))

    if (players.length > 0) {
      const player = players[0]
      if (player) {
        yield* _(updateHotbar(player.hotbar))
      }
    }
  })
