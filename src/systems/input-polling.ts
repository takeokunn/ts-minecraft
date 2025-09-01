import { Effect } from 'effect'
import { setInputState } from '@/domain/components'
import { playerInputQuery } from '@/domain/queries'
import { InputManagerService, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

export const inputPollingSystem: System = Effect.gen(function* () {
  const world = yield* World
  const inputManager = yield* InputManagerService
  const { keyboard, isLocked } = yield* inputManager.getState

  const players = yield* world.query(playerInputQuery)

  yield* Effect.forEach(
    players,
    (player) => {
      const newPlayerInputState = setInputState(player.inputState, {
        forward: keyboard.has('KeyW'),
        backward: keyboard.has('KeyS'),
        left: keyboard.has('KeyA'),
        right: keyboard.has('KeyD'),
        jump: keyboard.has('Space'),
        sprint: keyboard.has('ShiftLeft'),
        destroy: keyboard.has('Mouse0'), // Left-click
        place: keyboard.has('Mouse2'), // Right-click
        isLocked,
      })
      return world.updateComponent(player.entityId, 'inputState', newPlayerInputState)
    },
    { discard: true },
  )
})