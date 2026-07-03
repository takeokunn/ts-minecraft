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

const pistonAt = (
  position: Position,
  pistonExtended: boolean,
  pistonFacing?: RedstoneComponent['state']['pistonFacing'],
): RedstoneComponent => ({
  type: RedstoneComponentType.Piston,
  position,
  state: {
    active: pistonExtended,
    buttonTicksRemaining: 0,
    pistonExtended,
    ...(pistonFacing !== undefined ? { pistonFacing } : {}),
  },
})

const makeHarness = (
  entries: ReadonlyArray<readonly [Position, BlockType]>,
  entities: ReadonlyArray<{ entityId: string; position: Position }> = [],
  playerPos: Position | null = null,
) => {
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
  const getEntities = vi.fn(() => Effect.succeed(entities))
  const applyKnockback = vi.fn(() => Effect.void)
  const getPlayerPosition = vi.fn(() => Effect.succeed(playerPos ?? { x: 1000, y: 64, z: 1000 }))
  const setPlayerPosition = vi.fn(() => Effect.void)

  return {
    blocks,
    forceSetBlock,
    dirtyChunksRef,
    getEntities,
    applyKnockback,
    getPlayerPosition,
    setPlayerPosition,
    refs: { dirtyChunksRef } as unknown as RedstonePistonWorldRefs,
    services: {
      blockService: { getBlock, forceSetBlock },
      chunkManagerService: { getChunk },
      entityManager: { getEntities, applyKnockback },
      gameState: { getPlayerPosition, setPlayerPosition },
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
        // The freed head cell now holds the extended arm.
        expect(harness.blocks.get(positionKey(source))).toBe('PISTON_HEAD')
        expect(harness.blocks.get(positionKey(destination))).toBe('STONE')
        expect(harness.forceSetBlock).toHaveBeenCalledWith(destination, 'STONE')
        expect(harness.forceSetBlock).toHaveBeenCalledWith(source, 'AIR')
      })),
    )
  })

  it.effect('does not push when the run is capped by an immovable block', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const source = { x: 1, y: 64, z: 0 }
    const blocker = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([
      [source, 'STONE'],
      [blocker, 'BEDROCK'],
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(source))).toBe('STONE')
        expect(harness.blocks.get(positionKey(blocker))).toBe('BEDROCK')
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('pushes a contiguous train of blocks one cell (vanilla trains)', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const harness = makeHarness([
      [{ x: 1, y: 64, z: 0 }, 'STONE'],
      [{ x: 2, y: 64, z: 0 }, 'DIRT'],
      [{ x: 3, y: 64, z: 0 }, 'SAND'],
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey({ x: 1, y: 64, z: 0 }))).toBe('PISTON_HEAD')
        expect(harness.blocks.get(positionKey({ x: 2, y: 64, z: 0 }))).toBe('STONE')
        expect(harness.blocks.get(positionKey({ x: 3, y: 64, z: 0 }))).toBe('DIRT')
        expect(harness.blocks.get(positionKey({ x: 4, y: 64, z: 0 }))).toBe('SAND')
      })),
    )
  })

  it.effect('refuses trains longer than the 12-block vanilla limit', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const entries: Array<readonly [Position, BlockType]> = []
    for (let i = 1; i <= 13; i++) {
      entries.push([{ x: i, y: 64, z: 0 }, 'STONE'] as const)
    }
    const harness = makeHarness(entries)

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        // 13 movable blocks — over the limit, nothing moves, no arm placed
        // (the head cell is still occupied by the train's first block).
        expect(harness.blocks.get(positionKey({ x: 1, y: 64, z: 0 }))).toBe('STONE')
        expect(harness.blocks.get(positionKey({ x: 14, y: 64, z: 0 }))).toBeUndefined()
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

  it.effect('pushes along the stored facing (north = -z)', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const source = { x: 0, y: 64, z: -1 }
    const destination = { x: 0, y: 64, z: -2 }
    const harness = makeHarness([[source, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false, 'north')],
      [pistonAt(piston, true, 'north')],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(source))).toBe('PISTON_HEAD')
        expect(harness.blocks.get(positionKey(destination))).toBe('STONE')
      })),
    )
  })

  it.effect('pushes vertically when facing up', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const source = { x: 0, y: 65, z: 0 }
    const destination = { x: 0, y: 66, z: 0 }
    const harness = makeHarness([[source, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false, 'up')],
      [pistonAt(piston, true, 'up')],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(source))).toBe('PISTON_HEAD')
        expect(harness.blocks.get(positionKey(destination))).toBe('STONE')
      })),
    )
  })

  it.effect('pulls the pushed block back on the falling edge (sticky retraction)', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const head = { x: 1, y: 64, z: 0 }
    const pushedTo = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([[pushedTo, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, true)],
      [pistonAt(piston, false)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(pushedTo))).toBe('AIR')
        expect(harness.blocks.get(positionKey(head))).toBe('STONE')
      })),
    )
  })

  it.effect('retraction does not pull when the head cell is occupied', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const head = { x: 1, y: 64, z: 0 }
    const pushedTo = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([
      [head, 'DIRT'],
      [pushedTo, 'STONE'],
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, true)],
      [pistonAt(piston, false)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(head))).toBe('DIRT')
        expect(harness.blocks.get(positionKey(pushedTo))).toBe('STONE')
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('steady retracted state does not pull', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const pushedTo = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([[pushedTo, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, false)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(pushedTo))).toBe('STONE')
        expect(harness.forceSetBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('a facing-less legacy piston still pushes east', () => {
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
        expect(harness.blocks.get(positionKey(destination))).toBe('STONE')
      })),
    )
  })
})

describe('piston entity shove', () => {
  it.effect('an entity standing in the head cell is shoved along the facing', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const harness = makeHarness([], [
      { entityId: 'mob-in-cell', position: { x: 1.5, y: 64.9, z: 0.5 } },
      { entityId: 'mob-elsewhere', position: { x: 5.5, y: 64.9, z: 0.5 } },
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.applyKnockback).toHaveBeenCalledTimes(1)
        const [id, impulse] = harness.applyKnockback.mock.calls[0]! as unknown as [string, { x: number; y: number; z: number }]
        expect(id).toBe('mob-in-cell')
        expect(impulse.x).toBeGreaterThan(0)
      })),
    )
  })

  it.effect('the player standing in the head cell is shifted one cell', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const harness = makeHarness([], [], { x: 1.5, y: 64.9, z: 0.5 })

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.setPlayerPosition).toHaveBeenCalledWith({ x: 2.5, y: 64.9, z: 0.5 })
      })),
    )
  })

  it.effect('a distant player is not shifted', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const harness = makeHarness([], [], { x: 30, y: 64.9, z: 30 })

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.setPlayerPosition).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('retraction does not shove', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const harness = makeHarness([], [
      { entityId: 'mob-in-cell', position: { x: 1.5, y: 64.9, z: 0.5 } },
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, true)],
      [pistonAt(piston, false)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.applyKnockback).not.toHaveBeenCalled()
      })),
    )
  })
})

describe('piston arm visual', () => {
  it.effect('extension places PISTON_HEAD in the freed head cell', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const head = { x: 1, y: 64, z: 0 }
    const pushedTo = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([[head, 'STONE']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(pushedTo))).toBe('STONE')
        expect(harness.blocks.get(positionKey(head))).toBe('PISTON_HEAD')
      })),
    )
  })

  it.effect('retraction withdraws the arm before pulling the block back', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const head = { x: 1, y: 64, z: 0 }
    const beyond = { x: 2, y: 64, z: 0 }
    const harness = makeHarness([
      [head, 'PISTON_HEAD'],
      [beyond, 'STONE'],
    ])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, true)],
      [pistonAt(piston, false)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        expect(harness.blocks.get(positionKey(head))).toBe('STONE')
        expect(harness.blocks.get(positionKey(beyond))).toBe('AIR')
      })),
    )
  })

  it.effect('the arm itself is never pushed by another piston', () => {
    const piston = { x: 0, y: 64, z: 0 }
    const head = { x: 1, y: 64, z: 0 }
    const harness = makeHarness([[head, 'PISTON_HEAD']])

    return applyPistonWorldEffects(
      harness.services,
      harness.refs,
      [pistonAt(piston, false)],
      [pistonAt(piston, true)],
    ).pipe(
      Effect.tap(() => Effect.sync(() => {
        // push refused (immovable) — head cell keeps its arm, nothing beyond
        expect(harness.blocks.get(positionKey(head))).toBe('PISTON_HEAD')
        expect(harness.blocks.get(positionKey({ x: 2, y: 64, z: 0 }))).toBeUndefined()
      })),
    )
  })
})
