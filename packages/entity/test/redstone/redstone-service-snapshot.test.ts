import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { RedstoneComponentType } from '@ts-minecraft/entity'
import { RedstoneService, RedstoneServiceLive } from '@ts-minecraft/entity'

describe('redstone/redstone-service', () => {
  it.effect('getPowerSnapshot: returns tick=0 and empty poweredPositions on fresh service', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const snapshot = yield* redstone.getPowerSnapshot()
      expect(snapshot.tick).toBe(0)
      expect(snapshot.poweredPositions).toHaveLength(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('getPowerSnapshot: contains lever position in poweredPositions after toggle and tick', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()

      const snapshot = yield* redstone.getPowerSnapshot()
      expect(snapshot.tick).toBe(1)

      const powered = Arr.map(snapshot.poweredPositions, e => e.position)
      const leverPowered = Arr.some(powered, p => p.x === 0 && p.y === 64 && p.z === 0)
      expect(leverPowered).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('tick: second tick with no changes reuses cached snapshot without corrupting power state', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      yield* redstone.tick()
      const firstPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      yield* redstone.tick()
      const secondPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      expect(firstPower).toBe(14)
      expect(secondPower).toBe(14)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('tick: snapshot tick counter increments on every tick regardless of cache', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      const snap1 = yield* redstone.tick()
      const snap2 = yield* redstone.tick()
      const snap3 = yield* redstone.tick()

      expect(snap1.tick).toBe(1)
      expect(snap2.tick).toBe(2)
      expect(snap3.tick).toBe(3)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('tick: button that just expired clears power on subsequent tick', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Button)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)

      yield* redstone.pressButton({ x: 0, y: 64, z: 0 }, 1)

      yield* redstone.tick()
      const powerAfterFirstTick = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      yield* redstone.tick()
      const powerAfterSecondTick = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      yield* redstone.tick()
      const powerAfterThirdTick = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      expect(powerAfterFirstTick).toBe(14)
      expect(powerAfterSecondTick).toBe(0)
      expect(powerAfterThirdTick).toBe(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('setComponent: re-placing the same Lever type at an occupied position preserves existing state', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      const afterToggle = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })
      expect(Option.getOrThrow(afterToggle).state.active).toBe(true)

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      const afterReplacement = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })

      expect(Option.getOrThrow(afterReplacement).state.active).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('setComponent: placing a different type at an occupied position resets to new type default state', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Wire)
      const comp = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })

      expect(Option.getOrThrow(comp).type).toBe(RedstoneComponentType.Wire)
      expect(Option.getOrThrow(comp).state.active).toBe(false)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('torch: active torch powers adjacent wire; toggling off removes power', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Torch)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)

      yield* redstone.tick()
      const powerWhileActive = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      yield* redstone.toggleTorch({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()
      const powerAfterToggleOff = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      expect(powerWhileActive).toBe(14)
      expect(powerAfterToggleOff).toBe(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )
})
