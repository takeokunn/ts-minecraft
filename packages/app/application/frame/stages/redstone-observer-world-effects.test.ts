import { describe, it, beforeEach } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import {
  applyObserverWorldEffects,
  resetObserverWatchState,
  type RedstoneObserverWorldServices,
} from './redstone-observer-world-effects'

const observerAt = (
  position: Position,
  pistonFacing: NonNullable<RedstoneComponent['state']['pistonFacing']> = 'east',
): RedstoneComponent => ({
  type: RedstoneComponentType.Observer,
  position,
  state: { active: false, buttonTicksRemaining: 0, pistonExtended: false, pistonFacing },
})

const positionKey = (position: Position): string => `${position.x},${position.y},${position.z}`

const makeHarness = (entries: ReadonlyArray<readonly [Position, BlockType]>) => {
  const blocks = new Map<string, BlockType>()
  for (const [position, blockType] of entries) {
    blocks.set(positionKey(position), blockType)
  }
  const getBlock = vi.fn((position: Position) =>
    Effect.succeed(blocks.get(positionKey(position)) ?? 'AIR'))
  const pulseObserver = vi.fn(() => Effect.succeedNone)
  return {
    blocks,
    pulseObserver,
    services: {
      blockService: { getBlock },
      redstoneService: { pulseObserver },
    } as unknown as RedstoneObserverWorldServices,
  }
}

describe('redstone observer world effects', () => {
  beforeEach(() => {
    resetObserverWatchState()
  })

  it.effect('first sighting arms the detector without pulsing', () => {
    const observer = observerAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness([[{ x: 1, y: 64, z: 0 }, 'STONE']])

    return applyObserverWorldEffects(harness.services, [observer]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.pulseObserver).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('pulses when the watched block changes', () => {
    const observer = observerAt({ x: 0, y: 64, z: 0 })
    const watched = { x: 1, y: 64, z: 0 }
    const harness = makeHarness([[watched, 'STONE']])

    return applyObserverWorldEffects(harness.services, [observer]).pipe(
      Effect.flatMap(() => Effect.sync(() => {
        harness.blocks.set(positionKey(watched), 'AIR')
      })),
      Effect.flatMap(() => applyObserverWorldEffects(harness.services, [observer])),
      Effect.tap(() => Effect.sync(() => {
        expect(harness.pulseObserver).toHaveBeenCalledWith(observer.position, 2)
      })),
    )
  })

  it.effect('steady watched block never pulses', () => {
    const observer = observerAt({ x: 0, y: 64, z: 0 })
    const harness = makeHarness([[{ x: 1, y: 64, z: 0 }, 'STONE']])

    return applyObserverWorldEffects(harness.services, [observer]).pipe(
      Effect.flatMap(() => applyObserverWorldEffects(harness.services, [observer])),
      Effect.flatMap(() => applyObserverWorldEffects(harness.services, [observer])),
      Effect.tap(() => Effect.sync(() => {
        expect(harness.pulseObserver).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('watches along the stored facing (up = +y)', () => {
    const observer = observerAt({ x: 0, y: 64, z: 0 }, 'up')
    const watched = { x: 0, y: 65, z: 0 }
    const harness = makeHarness([[watched, 'AIR']])

    return applyObserverWorldEffects(harness.services, [observer]).pipe(
      Effect.flatMap(() => Effect.sync(() => {
        harness.blocks.set(positionKey(watched), 'DIRT')
      })),
      Effect.flatMap(() => applyObserverWorldEffects(harness.services, [observer])),
      Effect.tap(() => Effect.sync(() => {
        expect(harness.pulseObserver).toHaveBeenCalledWith(observer.position, 2)
      })),
    )
  })

  it.effect('non-observer components are ignored', () => {
    const lever: RedstoneComponent = {
      type: RedstoneComponentType.Lever,
      position: { x: 0, y: 64, z: 0 },
      state: { active: true, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const harness = makeHarness([])

    return applyObserverWorldEffects(harness.services, [lever]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.pulseObserver).not.toHaveBeenCalled()
      })),
    )
  })
})
