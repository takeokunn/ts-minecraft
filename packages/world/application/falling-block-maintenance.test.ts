import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import {
  FALLING_BLOCK_SWEEP_CHUNKS_PER_TICK,
  makeFallingBlockMaintenanceState,
  runFallingBlockMaintenance,
} from './falling-block-maintenance'
import { makeGrowthChunk, setGrowthChunkBlock } from '../test/plant-growth-test-kit'

const NO_DIRTY: ReadonlySet<string> = new Set()

describe('runFallingBlockMaintenance', () => {
  it('moves unsupported sand one block down (chunk reached via the sweep)', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 3, 10, 4, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed([chunk]) },
    }, makeFallingBlockMaintenanceState(), NO_DIRTY))

    expect(forceSetBlock).toHaveBeenCalledTimes(2)
    expect(forceSetBlock).toHaveBeenNthCalledWith(1, { x: 35, y: 10, z: -12 }, 'AIR')
    expect(forceSetBlock).toHaveBeenNthCalledWith(2, { x: 35, y: 9, z: -12 }, 'SAND')
  })

  it('does not move gravel when it is supported', () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 1, 10, 1, 'GRAVEL')
    setGrowthChunkBlock(chunk, 1, 9, 1, 'STONE')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed([chunk]) },
    }, makeFallingBlockMaintenanceState(), NO_DIRTY))

    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('does not move sand at the bottom of the world', () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 1, 0, 1, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed([chunk]) },
    }, makeFallingBlockMaintenanceState(), NO_DIRTY))

    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('scans a dirty chunk immediately even when the sweep cursor is elsewhere', () => {
    // More chunks than the per-tick sweep so chunk index 5 is NOT swept on tick 1.
    const chunks = Array.from({ length: 8 }, (_, i) => makeGrowthChunk({ x: i, z: 0 }))
    const target = chunks[5]!
    setGrowthChunkBlock(target, 3, 10, 4, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed(chunks) },
    }, makeFallingBlockMaintenanceState(), new Set(['5,0'])))

    expect(forceSetBlock).toHaveBeenCalledTimes(2)
  })

  it('skips undisturbed chunks outside the sweep window (event-driven gating)', () => {
    const chunks = Array.from({ length: 8 }, (_, i) => makeGrowthChunk({ x: i, z: 0 }))
    // Floating sand in a chunk that is neither dirty nor within the first sweep window.
    setGrowthChunkBlock(chunks[5]!, 3, 10, 4, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed(chunks) },
    }, makeFallingBlockMaintenanceState(), NO_DIRTY))

    // Only chunks 0..SWEEP-1 were scanned this tick; chunk 5 waits for the sweep.
    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('re-queues a chunk whose blocks moved so a falling column cascades tick after tick', () => {
    const chunks = Array.from({ length: 8 }, (_, i) => makeGrowthChunk({ x: i, z: 0 }))
    const target = chunks[5]!
    // Floor at y=9; two floating sand blocks at y=11/12 with a gap at y=10.
    // Tick 1 can only move the lower one (the scan reads the pre-move buffer).
    setGrowthChunkBlock(target, 3, 9, 4, 'STONE')
    setGrowthChunkBlock(target, 3, 11, 4, 'SAND')
    setGrowthChunkBlock(target, 3, 12, 4, 'SAND')
    const state = makeFallingBlockMaintenanceState()
    const calls: Array<readonly [{ x: number; y: number; z: number }, string]> = []
    const services = {
      blockService: {
        forceSetBlock: (pos: { x: number; y: number; z: number }, blockType: string) =>
          Effect.sync(() => {
            calls.push([pos, blockType] as const)
            // Mirror the mutation into the chunk buffer so the next tick sees it.
            setGrowthChunkBlock(target, pos.x - 5 * 16, pos.y, pos.z, blockType as 'SAND')
          }),
      },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed(chunks) },
    }

    // Tick 1: dirty event reaches the chunk, lower sand falls (11 -> 10).
    Effect.runSync(runFallingBlockMaintenance(services, state, new Set(['5,0'])))
    expect(calls).toHaveLength(2)
    // Tick 2: no external dirty event — the pending re-queue must cascade the
    // upper sand (12 -> 11) on its own.
    Effect.runSync(runFallingBlockMaintenance(services, state, NO_DIRTY))
    expect(calls).toHaveLength(4)
    expect(calls[2]).toEqual([{ x: 83, y: 12, z: 4 }, 'AIR'])
    expect(calls[3]).toEqual([{ x: 83, y: 11, z: 4 }, 'SAND'])
  })

  it('advances the sweep cursor so all chunks are eventually scanned', () => {
    const chunkCount = FALLING_BLOCK_SWEEP_CHUNKS_PER_TICK * 3
    const chunks = Array.from({ length: chunkCount }, (_, i) => makeGrowthChunk({ x: i, z: 0 }))
    setGrowthChunkBlock(chunks[chunkCount - 1]!, 3, 10, 4, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)
    const state = makeFallingBlockMaintenanceState()
    const services = {
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed(chunks) },
    }

    for (let tick = 0; tick < 3; tick += 1) {
      Effect.runSync(runFallingBlockMaintenance(services, state, NO_DIRTY))
    }
    expect(forceSetBlock).toHaveBeenCalledTimes(2)
    expect(MutableRef.get(state.sweepCursorRef)).toBe(0)
  })
})
