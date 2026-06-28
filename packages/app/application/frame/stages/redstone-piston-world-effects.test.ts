import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import {
  applyPistonWorldEffects,
  isPistonMovableBlock,
  type RedstonePistonWorldRefs,
  type RedstonePistonWorldServices,
} from './redstone-piston-world-effects'

const positionKey = (position: Position): string =>
  `${position.x},${position.y},${position.z}`

const pistonAt = (position: Position, pistonExtended: boolean): RedstoneComponent => ({
  type: RedstoneComponentType.Piston,
  position,
  state: {
    active: pistonExtended,
    buttonTicksRemaining: 0,
    pistonExtended,
  },
})

const makeHarness = (entries: ReadonlyArray<readonly [Position, BlockType]>) => {
  const blocks = new Map<string, BlockType>()
  for (const [position, blockType] of entries) {
    blocks.set(positionKey(position), blockType)
  }

  const getBlock = vi.fn((position: Position) =>
    Effect.succeed(blocks.get(positionKey(position)) ?? 'AIR'))
  const forceSetBlock = vi.fn((position: Position, blockType: BlockType) =>
    Effect.sync(() => {
      blocks.set(positionKey(position), blockType)
    }))
  const getChunk = vi.fn((coord: { readonly x: number; readonly z: number }) =>
    Effect.succeed({ coord, blocks: new Uint8Array(16 * 16 * 256), fluid: Option.none() }))
  const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())

  return {
    blocks,
    forceSetBlock,
    dirtyChunksRef,
    refs: { dirtyChunksRef } as unknown as RedstonePistonWorldRefs,
    services: {
      blockService: { getBlock, forceSetBlock },
      chunkManagerService: { getChunk },
    } as unknown as RedstonePistonWorldServices,
  }
}

describe('redstone piston world effects', () => {
  it.effect('moves one movable block east when a piston newly extends', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const source = { x: 1, y: 64, z: 0 }
    const destination = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([[source, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(source))).toBe('AIR')
        expect(harness.blocks.get(positionKey(destination))).toBe('STONE')
        expect(harness.forceSetBlock).toHaveBeenCalledWith(destination, 'STONE')
        expect(harness.forceSetBlock).toHaveBeenCalledWith(source, 'AIR')
      })),
    )
  })

  it.effect('does not push when destination is occupied', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const source = { x: 1, y: 64, z: 0 }
    const destination = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([
      [source, 'STONE'],
      [destination, 'DIRT'],
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(source))).toBe('STONE')
        expect(harness.blocks.get(positionKey(destination))).toBe('DIRT')
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('does not push again while a piston remains extended', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const source = { x: 1, y: 64, z: 0 }
    const harness = makeHarness([[source, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, true)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(source))).toBe('STONE')
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it('treats unsafe world blocks as immovable', () => {
    expect(isPistonMovableBlock('BEDROCK')).toBe(false)
    expect(isPistonMovableBlock('PISTON')).toBe(false)
    expect(isPistonMovableBlock('STONE')).toBe(true)
  })
})
