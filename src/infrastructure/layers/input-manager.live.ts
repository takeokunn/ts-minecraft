import { Layer, Effect, Ref } from 'effect'
import { InputManager } from '@/application/services/input-manager.service'

/**
 * Production implementation of InputManager service
 */
export const InputManagerLive = Layer.effect(
  InputManager,
  Effect.gen(function* () {
    const isLocked = yield* Ref.make(false)
    const inputState = yield* Ref.make({
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false
    })
    const mouseState = yield* Ref.make({ dx: 0, dy: 0 })
    const hotbarSelection = yield* Ref.make(0)
    
    return InputManager.of({
      isLocked,
      getState: () => Ref.get(inputState),
      getMouseState: () => Ref.get(mouseState),
      getHotbarSelection: () => Ref.get(hotbarSelection)
    })
  })
)