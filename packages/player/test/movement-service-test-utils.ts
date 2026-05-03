import { Effect, Layer, MutableHashMap, MutableHashSet, Option } from 'effect'
import { InputServicePort, PlayerInputService } from '@ts-minecraft/player'
import type { MovementInput } from '@ts-minecraft/player'

type MutableMovementInputService = InputServicePort & {
  readonly setKeyPressed: (key: string, pressed: boolean) => void
}

const makePlayerInputService = (inputService: InputServicePort): PlayerInputService =>
  PlayerInputService.of({
    _tag: '@minecraft/application/PlayerInputService' as const,
    isKeyPressed: inputService.isKeyPressed,
    consumeKeyPress: inputService.consumeKeyPress,
    consumeWheelDelta: inputService.consumeWheelDelta,
    getMouseDelta: inputService.getMouseDelta,
    isPointerLocked: inputService.isPointerLocked,
  })

export const createTestInputService = (
  initialState: Partial<MovementInput> = {}
): MutableMovementInputService => {
  const pressedKeys = MutableHashMap.make(
    ['KeyW', Option.getOrElse(Option.fromNullable(initialState.forward), () => false)],
    ['KeyS', Option.getOrElse(Option.fromNullable(initialState.backward), () => false)],
    ['KeyA', Option.getOrElse(Option.fromNullable(initialState.left), () => false)],
    ['KeyD', Option.getOrElse(Option.fromNullable(initialState.right), () => false)],
    ['Space', Option.getOrElse(Option.fromNullable(initialState.jump), () => false)],
    ['ControlLeft', Option.getOrElse(Option.fromNullable(initialState.sprint), () => false)],
  )
  // For consumeKeyPress, track "just pressed" keys
  // In tests, jump=true means Space was just pressed
  const justPressedKeys = MutableHashSet.empty<string>()
  if (initialState.jump) {
    MutableHashSet.add(justPressedKeys, 'Space')
  }

  return Object.assign(InputServicePort.of({
    _tag: '@minecraft/application/InputServicePort' as const,
    isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
          return true
        }
        return false
      }),
    getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
    isMouseDown: () => Effect.sync(() => false),
    requestPointerLock: () => Effect.sync(() => {}),
    exitPointerLock: () => Effect.sync(() => {}),
    isPointerLocked: () => Effect.sync(() => true),
    consumeMouseClick: () => Effect.sync(() => false),
    consumeWheelDelta: () => Effect.sync(() => 0),
  }), {
    setKeyPressed: (key: string, pressed: boolean) => {
      MutableHashMap.set(pressedKeys, key, pressed)
    },
  })
}

export const createTestLayers = (inputService: InputServicePort) =>
  Layer.succeed(PlayerInputService, makePlayerInputService(inputService))
