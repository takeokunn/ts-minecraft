import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import {
  applyHopperWorldEffects,
  type RedstoneHopperWorldServices,
} from './redstone-hopper-world-effects'

const hopperAt = (position: Position): RedstoneComponent => ({
  type: RedstoneComponentType.Hopper,
  position,
  state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
})

type DropStub = { readonly itemType: string; readonly count: number; readonly position: Position }

const makeHarness = (options: {
  readonly belowBlock: BlockType
  readonly drops: ReadonlyArray<DropStub>
  readonly depositCapacity?: number
}) => {
  const getBlock = vi.fn(() => Effect.succeed(options.belowBlock))
  const collectWithin = vi.fn(() => Effect.succeed(options.drops))
  const spawn = vi.fn(() => Effect.succeed({} as never))
  let capacity = options.depositCapacity ?? Number.POSITIVE_INFINITY
  const depositIntoChestAt = vi.fn((_pos: Position, _item: string, count: number) =>
    Effect.sync(() => {
      const deposited = Math.min(capacity, count)
      capacity -= deposited
      return deposited
    }))
  return {
    getBlock,
    collectWithin,
    spawn,
    depositIntoChestAt,
    services: {
      blockService: { getBlock },
      chestService: { depositIntoChestAt },
      droppedItemService: { collectWithin, spawn },
    } as unknown as RedstoneHopperWorldServices,
  }
}

describe('redstone hopper world effects', () => {
  it.effect('transfers resting drops into the chest below', () => {
    const hopper = hopperAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness({
      belowBlock: 'CHEST',
      drops: [{ itemType: 'COBBLESTONE', count: 5, position: { x: 0.5, y: 64.25, z: 0.5 } }],
    })

    return applyHopperWorldEffects(harness.services, [hopper]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.collectWithin).toHaveBeenCalledWith({ x: 0.5, y: 64.5, z: 0.5 })
        expect(harness.depositIntoChestAt).toHaveBeenCalledWith({ x: 0, y: 63, z: 0 }, 'COBBLESTONE', 5)
        expect(harness.spawn).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('leaves drops untouched when no chest sits below', () => {
    const hopper = hopperAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness({ belowBlock: 'STONE', drops: [] })

    return applyHopperWorldEffects(harness.services, [hopper]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.collectWithin).not.toHaveBeenCalled()
        expect(harness.depositIntoChestAt).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('re-spawns the overflow when the chest cannot fit everything', () => {
    const hopper = hopperAt({ x: 0, y: 64, z: 0 })
    const dropPos = { x: 0.5, y: 64.25, z: 0.5 }
    const harness = makeHarness({
      belowBlock: 'CHEST',
      drops: [{ itemType: 'DIRT', count: 10, position: dropPos }],
      depositCapacity: 4,
    })

    return applyHopperWorldEffects(harness.services, [hopper]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.spawn).toHaveBeenCalledWith({ itemType: 'DIRT', count: 6, position: dropPos })
      })),
    )
  })

  it.effect('ignores non-hopper components', () => {
    const lever: RedstoneComponent = {
      type: RedstoneComponentType.Lever,
      position: { x: 0, y: 64, z: 0 },
      state: { active: true, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const harness = makeHarness({ belowBlock: 'CHEST', drops: [] })

    return applyHopperWorldEffects(harness.services, [lever]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.getBlock).not.toHaveBeenCalled()
      })),
    )
  })
})
