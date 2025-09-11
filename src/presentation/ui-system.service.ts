import { Effect, Option } from 'effect'
import { queries } from '@/domain/queries'
import { UIService } from '@/presentation/services/ui-system.service'
import { WorldService as World } from '@/application/services/world.service'

export const uiSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const uiService = yield* $(UIService)
  const { components } = yield* $(world.querySoA(queries.player))

  yield* $(
    Option.fromNullable(components.hotbar[0]).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: (hotbar) => uiService.updateHotbar(hotbar),
      }),
    ),
  )
})

/**
 * Create UI system factory function to maintain compatibility
 */
export const createUISystem = () => uiSystem