import { InputService, KeyCode } from '@domain/input'
import { Effect, Layer, Match } from 'effect'

import { MenuActionsService } from './menu-actions'
import { MenuControllerService } from './menu-controller'

const ESCAPE_KEY = KeyCode('ESCAPE')

const makeMenuInputLayer = Effect.gen(function* () {
  const input = yield* InputService
  const menuActions = yield* MenuActionsService
  const controller = yield* MenuControllerService

  yield* input.bindAction((event, _snapshot) =>
    Match.value(event).pipe(
      Match.when({ _tag: 'KeyPressed' }, (pressed) =>
        Match.value(pressed.key).pipe(
          Match.when(ESCAPE_KEY, () =>
            controller
              .model()
              .pipe(
                Effect.flatMap((model) =>
                  Match.value(model.route).pipe(
                    Match.when('none', () => menuActions.openPause()),
                    Match.when('settings', () => controller.back()),
                    Match.when('pause', () => menuActions.close()),
                    Match.when('main', () => menuActions.close()),
                    Match.orElse(() => menuActions.close())
                  )
                ),
                Effect.catchAll(() => Effect.void),
                Effect.asVoid
              )
          ),
          Match.orElse(() => Effect.void)
        )
      ),
      Match.orElse(() => Effect.void)
    )
  )

  return undefined
})

export const MenuInputLayer = Layer.scopedDiscard(makeMenuInputLayer)
