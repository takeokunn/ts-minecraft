import { Effect, Ref } from 'effect'
import { InputState } from '@/core/components'
import { playerInputQuery } from '@/domain/queries'
import { InputManager, World } from '@/runtime/services'

export const inputPollingSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManager)
  const state = yield* _(inputManager.getState())
  const isLocked = yield* _(Ref.get(inputManager.isLocked))
  const newInputState: InputState = { ...state, isLocked }

  const { entities } = yield* _(world.querySoA(playerInputQuery))

  yield* _(
    Effect.forEach(
      entities,
      (entityId) => {
        return world.updateComponent(entityId, 'inputState', newInputState)
      },
      { concurrency: 'inherit', discard: true },
    ),
  )
})

