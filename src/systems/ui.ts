import { Effect } from 'effect'
import { Hotbar } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { World } from '@/runtime/world'

export type HotbarUpdater = (hotbar: Hotbar) => Effect.Effect<void>

export const createUISystem = (updateHotbar: HotbarUpdater) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const players = yield* _(world.querySoA(playerQuery))

    if (players.entities.length > 0) {
      const i = 0
      const slots = players.hotbar.slots[i]
      const selectedIndex = players.hotbar.selectedIndex[i]

      if (slots === undefined || selectedIndex === undefined) {
        return
      }

      const hotbar = new Hotbar({
        slots,
        selectedIndex,
      })
      yield* _(updateHotbar(hotbar))
    }
  })
