import { Effect, Option } from 'effect'
import { queries } from '@/core/queries'
import { UIService, World } from '@/runtime/services'

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
