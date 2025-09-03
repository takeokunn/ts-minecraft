import { Effect } from 'effect'
import { InputState } from '@/domain/components'
import { playerInputQuery } from '@/domain/queries'
import { InputManager, World } from '@/runtime/services'

export const inputPollingSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManager)
  const inputState = yield* _(inputManager.getState())
  const newInputState = new InputState(inputState)

  const { entities } = yield* _(world.querySoA(playerInputQuery))

  yield* _(
    Effect.forEach(
      entities,
      (entityId) => {
        return world.updateComponent(entityId, 'inputState', newInputState)
      },
      { concurrency: 'inherit' },
    ),
  )
})

