import { Effect } from 'effect'
import { InputState } from '@/domain/components'
import { playerInputQuery } from '@/domain/queries'
import { InputManagerService } from '@/runtime/services'
import { World } from '@/runtime/world'

export const inputPollingSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManagerService)
  const { keyboard, isLocked } = yield* _(inputManager.getState)

  const players = yield* _(world.query(playerInputQuery))

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

  yield* _(Effect.forEach(players, (player) => world.updateComponent(player.entityId, 'inputState', newInputState), { discard: true }))
})
