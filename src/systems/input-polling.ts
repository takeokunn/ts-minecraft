import { Effect } from 'effect'
import { playerInputQuery } from '@/domain/queries'
import { InputManagerService } from '@/runtime/services'
import { World } from '@/runtime/world'

export const inputPollingSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManagerService)
  const { keyboard, isLocked } = yield* _(inputManager.getState)

  const { entities, inputState } = yield* _(world.querySoA(playerInputQuery))

  for (let i = 0; i < entities.length; i++) {
    inputState.forward[i] = keyboard.has('KeyW')
    inputState.backward[i] = keyboard.has('KeyS')
    inputState.left[i] = keyboard.has('KeyA')
    inputState.right[i] = keyboard.has('KeyD')
    inputState.jump[i] = keyboard.has('Space')
    inputState.sprint[i] = keyboard.has('ShiftLeft')
    inputState.destroy[i] = keyboard.has('Mouse0') // Left-click
    inputState.place[i] = keyboard.has('Mouse2') // Right-click
    inputState.isLocked[i] = isLocked
  }
})
