import { Effect, Option } from 'effect'
import { playerQuery } from '@/domain/queries'
import { UIService, World } from '@/runtime/services'

export const uiSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const uiService = yield* $(UIService)
  const { components } = yield* $(world.querySoA(playerQuery))

  yield* $(
    Option.fromNullable(components.hotbar[0]).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: (hotbar) => uiService.updateHotbar(hotbar),
      }),
    ),
  )
})
