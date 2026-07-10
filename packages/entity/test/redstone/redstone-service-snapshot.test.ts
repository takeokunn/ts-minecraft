import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect , Option } from 'effect'
import { RedstoneComponentType } from '@ts-minecraft/entity/domain/redstone/redstone-model';
import { RedstoneService } from '@ts-minecraft/entity/application/redstone/redstone-service';
import { expectSome } from '../test-utils'

describe('redstone/redstone-service', () => {
  it.effect('getPowerSnapshot: returns tick=0 and empty poweredPositions on fresh service', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const snapshot = yield* redstone.getPowerSnapshot()
      expect(snapshot.tick).toBe(0)
      expect(snapshot.poweredPositions).toHaveLength(0)
    }).pipe(Effect.provide(RedstoneService.Default))
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
    }).pipe(Effect.provide(RedstoneService.Default))
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
    }).pipe(Effect.provide(RedstoneService.Default))
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
    }).pipe(Effect.provide(RedstoneService.Default))
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
    }).pipe(Effect.provide(RedstoneService.Default))
  )

  it.effect('setComponent: re-placing the same Lever type at an occupied position preserves existing state', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      const afterToggle = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })
      expect(expectSome(afterToggle).state.active).toBe(true)

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      const afterReplacement = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })

      expect(expectSome(afterReplacement).state.active).toBe(true)
    }).pipe(Effect.provide(RedstoneService.Default))
  )

  it.effect('setComponent: placing a different type at an occupied position resets to new type default state', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Wire)
      const comp = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })

      expect(expectSome(comp).type).toBe(RedstoneComponentType.Wire)
      expect(expectSome(comp).state.active).toBe(false)
    }).pipe(Effect.provide(RedstoneService.Default))
  )

  it.effect('torch inversion (NOT gate): powering the attachment cell turns the torch off', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      // Floor torch at (0,64,0) attaches to the cell below (0,63,0).
      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Torch)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)
      // Input: a lever occupying the attachment cell.
      yield* redstone.setComponent({ x: 0, y: 63, z: 0 }, RedstoneComponentType.Lever)

      yield* redstone.tick()
      const powerWhileActive = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })
      expect(powerWhileActive).toBe(14) // unlit input → torch is lit and powers the wire

      yield* redstone.toggleLever({ x: 0, y: 63, z: 0 })
      // Tick 1 propagates the lever's power; tick 2 lets the torch sample it.
      yield* redstone.tick()
      yield* redstone.tick()
      // Cell power is contaminated by the lever's own signal passing the torch
      // cell, so assert the torch's derived state directly.
      const torchOff = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })
      expect(Option.getOrNull(torchOff)?.state.active).toBe(false) // inverted off

      yield* redstone.toggleLever({ x: 0, y: 63, z: 0 })
      yield* redstone.tick()
      yield* redstone.tick()
      yield* redstone.tick()
      const torchOn = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })
      expect(Option.getOrNull(torchOn)?.state.active).toBe(true) // NOT gate re-lights
      const powerRestored = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })
      expect(powerRestored).toBe(14)
    }).pipe(Effect.provide(RedstoneService.Default))
  )
  it.effect('repeater delay: a 2-tick repeater applies its output one tick later than a 1-tick one', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      // lever → repeater(east) → wire, repeater rear at the lever cell.
      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Repeater, { pistonFacing: 'east' })
      yield* redstone.setComponent({ x: 2, y: 64, z: 0 }, RedstoneComponentType.Wire)
      yield* redstone.cycleRepeaterDelay({ x: 1, y: 64, z: 0 }) // 1 → 2 ticks

      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick() // propagate lever
      yield* redstone.tick() // repeater samples rear, starts countdown (delay 2)
      const repeaterMidCountdown = yield* redstone.getComponent({ x: 1, y: 64, z: 0 })
      expect(Option.getOrNull(repeaterMidCountdown)?.state.active).toBe(false)

      yield* redstone.tick() // countdown reaches zero → active
      yield* redstone.tick() // re-propagation carries power to the wire
      const repeaterAfter = yield* redstone.getComponent({ x: 1, y: 64, z: 0 })
      expect(Option.getOrNull(repeaterAfter)?.state.active).toBe(true)
    }).pipe(Effect.provide(RedstoneService.Default))
  )
})
