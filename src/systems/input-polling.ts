import { Effect } from 'effect'
import { InputState } from '@/domain/components'
import { playerInputQuery } from '@/domain/queries'
import { InputManagerService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

export const inputPollingSystem = Effect.gen(function* ($) {
  const inputManager = yield* $(InputManagerService)
  const { keyboard, isLocked } = yield* $(inputManager.getState)
  const players = yield* $(World.query(playerInputQuery))

  const newInputState = new InputState({
    forward: keyboard.has('KeyW'),
    backward: keyboard.has('KeyS'),
    left: keyboard.has('KeyA'),
    right: keyboard.has('KeyD'),
    jump: keyboard.has('Space'),
    sprint: keyboard.has('ShiftLeft'),
    destroy: keyboard.has('Mouse0'), // Left-click
    place: keyboard.has('Mouse2'), // Right-click
    isLocked: isLocked,
  })

  // TODO: Check if the input state has actually changed before updating
  yield* $(
    Effect.forEach(
      players,
      (player) => World.updateComponent(player.entityId, 'inputState', newInputState),
      { discard: true, concurrency: 'unbounded' },
    ),
  )
})