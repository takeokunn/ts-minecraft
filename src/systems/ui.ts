import { Effect } from 'effect'
import { Hotbar } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { System } from '@/runtime/loop'
import { World } from '@/runtime/world'

export type HotbarUpdater = (hotbar: Hotbar) => Effect.Effect<void>

export const createUISystem = (updateHotbar: HotbarUpdater): System =>
  Effect.gen(function* () {
    const world = yield* World
    const player = (yield* world.query(playerQuery))[0]

    if (player?.hotbar) {
      yield* updateHotbar(player.hotbar)
    }
  })