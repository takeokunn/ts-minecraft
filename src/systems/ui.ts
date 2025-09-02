import { Effect } from 'effect'
import { Hotbar } from '@/domain/components'
import { GameStateService } from '@/runtime/services'

export type HotbarUpdater = (hotbar: Hotbar) => Effect.Effect<void>

export const createUISystem = (updateHotbar: HotbarUpdater) =>
  Effect.gen(function* (_) {
    const gameState = yield* _(GameStateService)
    yield* _(updateHotbar(gameState.hotbar))
  })
