import { Effect } from 'effect'
import { playerQuery } from '@/domain/queries'
import { UIService, World } from '@/runtime/services'

export const uiSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const uiService = yield* $(UIService)
  const { entities, components } = yield* $(world.querySoA(playerQuery))

  if (entities.length === 0) {
    return
  }

  const hotbar = components.hotbar[0]
  if (!hotbar) {
    return
  }

  yield* $(uiService.updateHotbar(hotbar))
})