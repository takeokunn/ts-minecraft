import { describe, it, beforeEach } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import {
  applyDispenserWorldEffects,
  resetDispenserState,
  type RedstoneDispenserWorldServices,
} from './redstone-dispenser-world-effects'

const dispenserAt = (
  position: Position,
  pistonFacing: NonNullable<RedstoneComponent['state']['pistonFacing']> = 'east',
): RedstoneComponent => ({
  type: RedstoneComponentType.Dispenser,
  position,
  state: { active: false, buttonTicksRemaining: 0, pistonExtended: false, pistonFacing },
})

const makeHarness = (options: { readonly power: number; readonly chestItem: string | null }) => {
  let power = options.power
  const getPowerAt = vi.fn(() => Effect.sync(() => power))
  const withdrawOneFromChestAt = vi.fn(() =>
    Effect.succeed(options.chestItem === null ? Option.none() : Option.some(options.chestItem)))
  const spawn = vi.fn(() => Effect.succeed({} as never))
  return {
    setPower: (value: number) => { power = value },
    getPowerAt,
    withdrawOneFromChestAt,
    spawn,
    services: {
      redstoneService: { getPowerAt },
      chestService: { withdrawOneFromChestAt },
      droppedItemService: { spawn },
    } as unknown as RedstoneDispenserWorldServices,
  }
}

describe('redstone dispenser world effects', () => {
  beforeEach(() => {
    resetDispenserState()
  })

  it.effect('ejects one item toward its facing on the power rising edge', () => {
    const dispenser = dispenserAt({ x: 0, y: 64, z: 0 }, 'east')
    const harness = makeHarness({ power: 15, chestItem: 'ARROW' })

    return applyDispenserWorldEffects(harness.services, [dispenser]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.withdrawOneFromChestAt).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 })
        expect(harness.spawn).toHaveBeenCalledTimes(1)
        const call = harness.spawn.mock.calls[0]![0] as { position: Position; velocity: Position; itemType: string }
        expect(call.itemType).toBe('ARROW')
        expect(call.position.x).toBeGreaterThan(1)
        expect(call.velocity.x).toBeGreaterThan(0)
      })),
    )
  })

  it.effect('does not eject again while power stays high (edge, not level)', () => {
    const dispenser = dispenserAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness({ power: 15, chestItem: 'ARROW' })

    return applyDispenserWorldEffects(harness.services, [dispenser]).pipe(
      Effect.flatMap(() => applyDispenserWorldEffects(harness.services, [dispenser])),
      Effect.flatMap(() => applyDispenserWorldEffects(harness.services, [dispenser])),
      Effect.tap(() => Effect.sync(() => {
        expect(harness.spawn).toHaveBeenCalledTimes(1)
      })),
    )
  })

  it.effect('re-arms after power drops and rises again', () => {
    const dispenser = dispenserAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness({ power: 15, chestItem: 'ARROW' })

    return applyDispenserWorldEffects(harness.services, [dispenser]).pipe(
      Effect.flatMap(() => Effect.sync(() => harness.setPower(0))),
      Effect.flatMap(() => applyDispenserWorldEffects(harness.services, [dispenser])),
      Effect.flatMap(() => Effect.sync(() => harness.setPower(12))),
      Effect.flatMap(() => applyDispenserWorldEffects(harness.services, [dispenser])),
      Effect.tap(() => Effect.sync(() => {
        expect(harness.spawn).toHaveBeenCalledTimes(2)
      })),
    )
  })

  it.effect('empty or absent chest above consumes the edge with no drop', () => {
    const dispenser = dispenserAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness({ power: 15, chestItem: null })

    return applyDispenserWorldEffects(harness.services, [dispenser]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.withdrawOneFromChestAt).toHaveBeenCalled()
        expect(harness.spawn).not.toHaveBeenCalled()
      })),
    )
  })
})
