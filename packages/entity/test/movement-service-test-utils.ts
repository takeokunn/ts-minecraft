import { Effect, Layer, MutableHashMap, MutableHashSet, MutableRef, Option } from 'effect'
import { HungerService } from '@ts-minecraft/entity/application/hunger-service';
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service';
import { PlayerHunger } from '@ts-minecraft/entity/domain/player-hunger';
import type { MovementInput } from '@ts-minecraft/entity/application/movement-service';
import type { MouseDelta } from '@ts-minecraft/entity/application/player-input-service';

type TestInputService = PlayerInputService & {
  readonly setKeyPressed: (key: string, pressed: boolean) => void
  readonly setMouseDelta: (delta: MouseDelta) => void
  readonly setPointerLocked: (locked: boolean) => void
}

export const createTestInputService = (
  initialState: Partial<MovementInput & { mouseDelta?: MouseDelta; pointerLocked?: boolean }> = {}
): TestInputService => {
  const pressedKeys = MutableHashMap.make(
    ['KeyW', initialState.forward ?? false],
    ['KeyS', initialState.backward ?? false],
    ['KeyA', initialState.left ?? false],
    ['KeyD', initialState.right ?? false],
    ['Space', initialState.jump ?? false],
    ['ControlLeft', initialState.sprint ?? false],
    ['ShiftLeft', initialState.sneak ?? false],
  )
  const justPressedKeys = MutableHashSet.empty<string>()
  if (initialState.jump) {
    MutableHashSet.add(justPressedKeys, 'Space')
  }
  const mouseDeltaRef = MutableRef.make(initialState.mouseDelta ?? { x: 0, y: 0 })
  const pointerLockedRef = MutableRef.make(initialState.pointerLocked ?? true)

  return Object.assign(PlayerInputService.of({
    _tag: '@minecraft/application/PlayerInputService' as const,
    isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
          return true
        }
        return false
      }),
    getMouseDelta: () =>
      Effect.sync(() => {
        const delta = { ...MutableRef.get(mouseDeltaRef) }
        MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
        return delta
      }),
    isPointerLocked: () => Effect.sync(() => MutableRef.get(pointerLockedRef)),
    consumeWheelDelta: () => Effect.sync(() => 0),
  }), {
    setKeyPressed: (key: string, pressed: boolean) => {
      MutableHashMap.set(pressedKeys, key, pressed)
    },
    setMouseDelta: (delta: MouseDelta) => {
      MutableRef.set(mouseDeltaRef, delta)
    },
    setPointerLocked: (locked: boolean) => {
      MutableRef.set(pointerLockedRef, locked)
    },
  })
}

export const createTestLayers = (
  inputService: PlayerInputService,
  hunger: Partial<PlayerHunger> = {},
) => {
  const testHunger = new PlayerHunger({
    foodLevel: hunger.foodLevel ?? 20,
    saturation: hunger.saturation ?? 5,
    exhaustion: hunger.exhaustion ?? 0,
  })
  return Layer.mergeAll(
    Layer.succeed(PlayerInputService, inputService),
    Layer.succeed(HungerService, HungerService.of({
      _tag: '@minecraft/application/HungerService' as const,
      getHunger: () => Effect.succeed(testHunger),
      addExhaustion: () => Effect.void,
      eat: () => Effect.void,
      tick: () => Effect.succeed('none' as const),
      reset: () => Effect.void,
      restore: () => Effect.void,
    })),
  )
}
