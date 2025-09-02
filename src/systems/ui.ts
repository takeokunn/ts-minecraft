import { Effect } from 'effect'
import { Hotbar } from '@/domain/components'
import { GameStateService } from '@/runtime/services'

export type HotbarUpdater = (hotbar: Hotbar) => Effect.Effect<void>

export const createUISystem = (updateHotbar: HotbarUpdater) =>
  Effect.gen(function* (_) {
    const gameState = yield* _(GameStateService)
    const hotbar = yield* _(gameState.getHotbar)
    yield* _(updateHotbar(hotbar))
  }).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in UISystem', cause)))
