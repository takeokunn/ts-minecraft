import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import {
  applyLampWorldEffects,
  type RedstoneLampWorldRefs,
  type RedstoneLampWorldServices,
} from './redstone-lamp-world-effects'

const positionKey = (position: Position): string =>
  `${position.x},${position.y},${position.z}`

const lampAt = (position: Position): RedstoneComponent => ({
  type: RedstoneComponentType.Lamp,
  position,
  state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
})

const makeHarness = (
  entries: ReadonlyArray<readonly [Position, BlockType]>,
  powerAt: ReadonlyArray<readonly [Position, number]> = [],
) => {
  const blocks = new Map<string, BlockType>()
  for (const [position, blockType] of entries) {
    blocks.set(positionKey(position), blockType)
  }
  const power = new Map<string, number>()
  for (const [position, level] of powerAt) {
    power.set(positionKey(position), level)
  }

  const getBlock = vi.fn((position: Position) =>
    Effect.succeed(blocks.get(positionKey(position)) ?? 'AIR'))
  const forceSetBlock = vi.fn((position: Position, blockType: BlockType) =>
    Effect.sync(() => {
      blocks.set(positionKey(position), blockType)
    }))
  const getPowerAt = vi.fn((position: Position) =>
    Effect.succeed(power.get(positionKey(position)) ?? 0))
  const getChunk = vi.fn((coord: { readonly x: number; readonly z: number }) =>
    Effect.succeed({ coord, blocks: new Uint8Array(16 * 16 * 256), fluid: Option.none() }))
  const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())

  return {
    blocks,
    forceSetBlock,
    dirtyChunksRef,
    refs: { dirtyChunksRef } as unknown as RedstoneLampWorldRefs,
    services: {
      blockService: { getBlock, forceSetBlock },
      chunkManagerService: { getChunk },
      redstoneService: { getPowerAt },
    } as unknown as RedstoneLampWorldServices,
  }
}

describe('redstone lamp world effects', () => {
  it.effect('lights an unlit lamp when an ADJACENT cell is powered', () => {
    const lamp = { x: 3, y: 64, z: 2 }
    const neighbor = { x: 4, y: 64, z: 2 }
    // Power lives on the neighbouring conductor, never on the lamp's own
    // (non-conducting) cell — matches how the real sim fills powerByPosition.
    const harness = makeHarness([[lamp, 'REDSTONE_LAMP']], [[neighbor, 15]])

    return applyLampWorldEffects(harness.services, harness.refs, [lampAt(lamp)]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(lamp))).toBe('REDSTONE_LAMP_LIT')
        expect(HashMap.size(MutableRef.get(harness.dirtyChunksRef))).toBe(1)
      })),
    )
  })

  it.effect('does NOT light from power at the lamp\'s own cell (regression: lamps are non-conductors, getPowerAt(lampPos) is always 0)', () => {
    const lamp = { x: 3, y: 64, z: 2 }
    const harness = makeHarness([[lamp, 'REDSTONE_LAMP']], [[lamp, 15]])

    return applyLampWorldEffects(harness.services, harness.refs, [lampAt(lamp)]).pipe(
      Effect.tap(() => Effect.sync(() => {
        // Before the fix this read getPowerAt(lampPos)=15 and lit the lamp; the
        // real sim never powers the lamp's own cell, so it must stay unlit.
        expect(harness.blocks.get(positionKey(lamp))).toBe('REDSTONE_LAMP')
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('reverts a lit lamp when power drops to zero', () => {
    const lamp = { x: 3, y: 64, z: 2 }
    const harness = makeHarness([[lamp, 'REDSTONE_LAMP_LIT']])

    return applyLampWorldEffects(harness.services, harness.refs, [lampAt(lamp)]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(lamp))).toBe('REDSTONE_LAMP')
      })),
    )
  })

  it.effect('leaves a lamp alone when its lit state already matches the power', () => {
    const lamp = { x: 3, y: 64, z: 2 }
    const neighbor = { x: 4, y: 64, z: 2 }
    const harness = makeHarness([[lamp, 'REDSTONE_LAMP_LIT']], [[neighbor, 9]])

    return applyLampWorldEffects(harness.services, harness.refs, [lampAt(lamp)]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
        expect(HashMap.size(MutableRef.get(harness.dirtyChunksRef))).toBe(0)
      })),
    )
  })

  it.effect('does not touch positions whose block is no longer a lamp', () => {
    const lamp = { x: 3, y: 64, z: 2 }
    const harness = makeHarness([[lamp, 'STONE']], [[lamp, 15]])

    return applyLampWorldEffects(harness.services, harness.refs, [lampAt(lamp)]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('ignores non-lamp components entirely', () => {
    const wire = { x: 1, y: 64, z: 1 }
    const harness = makeHarness([[wire, 'REDSTONE_WIRE']], [[wire, 15]])
    const wireComponent: RedstoneComponent = {
      type: RedstoneComponentType.Wire,
      position: wire,
      state: { active: true, buttonTicksRemaining: 0, pistonExtended: false },
    }

    return applyLampWorldEffects(harness.services, harness.refs, [wireComponent]).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })
})
