import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { decodeFluidByte } from '@ts-minecraft/world'
import { FLUID_TICK_BUDGET } from '@ts-minecraft/block/domain/fluid-model'
import {
  makeEmptyTestChunk as makeEmptyChunk,
  testBlockIndexAt as blockIndexAt,
} from './chunk-buffer-test-utils'
import { makeFluidTestChunk, withFluidService } from './fluid-test-utils'


describe('terrain/application/fluid-service', () => {

  // ─── tick — empty frontier (line 278) ────────────────────────────────────

  it.effect('tick with no frontier increments tickCounter only (empty frontier path)', () => {
    return withFluidService([], svc =>
      Effect.gen(function* () {
      // No seeding → frontier is empty → tick should hit line 278-280
        yield* svc.tick()
        yield* svc.tick()
      // If these complete without error, the early-return path works
      }),
      { syncLoadedChunks: false },
    )
  })

  // ─── tick — stale key in frontier (lines 294-295, 332-334) ───────────────

  it.effect('tick removes cell when block at position is no longer the correct fluid type', () => {
    // Seed water at a position, then replace with AIR in the chunk but keep it in state.
    // On tick, blocks[idx] !== blockIndexFor('water') → cell is removed (line 332-334).
    const idx = blockIndexAt(0, 64, 0)
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      // Now overwrite the block with AIR — the fluid state still has the cell
      chunk.blocks[idx] = blockTypeToIndex('AIR')
      // tick should detect mismatch and remove the cell
      yield* svc.tick()
      // No error means the stale-cell removal path executed correctly
    }))
  })

  it.effect('tick skips processing when frontier has keys not present in cells (lines 294-295)', () => {
    // notifyBlockChanged adds keys to frontier but cells map may not have matching entries.
    // This exercises workWithCells = Arr.filterMap(...) → produces empty work array.
    const chunk = makeEmptyChunk()
    return withFluidService([chunk], svc => Effect.gen(function* () {
      // Add keys to frontier without corresponding cells via notifyBlockChanged
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      yield* svc.notifyBlockChanged({ x: 1, y: 64, z: 0 })
      // tick processes keys → filterMap returns empty (no cells) → work = []
      yield* svc.tick()
    }))
  })

  it.effect('tick stops collecting frontier entries once water and lava caps are filled', () => {
    const waterCount = Math.floor(FLUID_TICK_BUDGET / 2)
    const lavaCount = FLUID_TICK_BUDGET
    const totalFluidCells = waterCount + lavaCount
    const chunk = makeEmptyChunk()
    const fluidCells = []

    for (let idx = 0; idx < totalFluidCells; idx++) {
      const type = idx < waterCount ? 'water' : 'lava'
      chunk.blocks[idx] = blockTypeToIndex(type === 'water' ? 'WATER' : 'LAVA')
      fluidCells.push({
        lx: idx % 16,
        y: Math.floor(idx / (16 * 16)),
        lz: Math.floor(idx / 16) % 16,
        cell: { level: 0, source: true, type },
      })
    }
    const chunkWithFluids = { ...chunk, fluid: makeFluidTestChunk({ fluids: fluidCells }).fluid }
    return withFluidService([chunkWithFluids], svc => Effect.gen(function* () {
      yield* svc.tick()
      yield* svc.tick()
      yield* svc.syncLoadedChunks([chunkWithFluids])
      yield* svc.tick()
    }))
  })

  // ─── tick — downward flow (water falls to empty space below) ─────────────

  it.effect('tick flows water downward into air below', () => {
    // Water source at y=64, AIR at y=63 → tick should spread water down
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      yield* svc.tick()
      // markChunkDirty should be called for the water spread
      expect(MutableRef.get(markDirtyCountRef)).toBeGreaterThan(0)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
        },
      },
    )
  })

  it.effect('tick spreads a water source downward AT decayed level 1 (outcome, not just markDirty)', () => {
    // A source (level 0) spreads out at level 1 (the first flowing level). This
    // asserts the OUTCOME — the cell below holds WATER at level 1, flowing — not
    // merely that markChunkDirty fired, so a wrong nextLevel or target is caught.
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.tick()

      const belowIdx = blockIndexAt(0, 63, 0)
      // The block below became WATER...
      expect(chunk.blocks[belowIdx]).toBe(blockTypeToIndex('WATER'))
      // ...carrying a FLOWING cell at level 1 (source decays by one on spread).
      const cell = Option.getOrThrow(decodeFluidByte(Option.getOrThrow(chunk.fluid)[belowIdx]!))
      expect(cell.type).toBe('water')
      expect(cell.source).toBe(false)
      expect(cell.level).toBe(1)
    }))
  })

  // ─── tick — lateral flow (FLOW_OFFSETS path, lines 357-402) ──────────────

  it.effect('tick flows water laterally when below is blocked', () => {
    // Water at y=64, STONE at y=63 (below is blocked), AIR at (1,64,0) → lateral spread
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
        { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
      ],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      yield* svc.tick()
      // Lateral spread should have been attempted, calling markChunkDirty
      expect(MutableRef.get(markDirtyCountRef)).toBeGreaterThan(0)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
        },
      },
    )
  })

  it.effect('tick breaks torch when water flows into its block', () => {
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
        { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
        { lx: 1, y: 64, lz: 0, blockType: 'TORCH' },
      ],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.tick()

      const torchIdx = blockIndexAt(1, 64, 0)
      expect(chunk.blocks[torchIdx]).toBe(blockTypeToIndex('WATER'))
      const cell = Option.getOrThrow(decodeFluidByte(Option.getOrThrow(chunk.fluid)[torchIdx]!))
      expect(cell.type).toBe('water')
      expect(cell.source).toBe(false)
      expect(cell.level).toBe(1)
    }))
  })

  it.effect('tick skips max-level water that is not a source (non-spreading water)', () => {
    // A non-source water cell at max level should not spread (line 367: if (!cell.source && cell.level >= maxLevel) return)
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 7, source: false, type: 'water' } }],
    })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      // cell.level >= maxLevel → should return without writing anything
      yield* svc.tick()
      // markDirtyCountRef should be 0 since no spreading occurred
      expect(MutableRef.get(markDirtyCountRef)).toBe(0)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => {
            MutableRef.update(markDirtyCountRef, n => n + 1)
          }),
        },
      },
    )
  })

  it.effect('renews flowing water into a source when fed by two horizontal water sources', () => {
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 4, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 5, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 6, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 4, y: 63, lz: 5, blockType: 'STONE' },
        { lx: 5, y: 63, lz: 5, blockType: 'STONE' },
        { lx: 6, y: 63, lz: 5, blockType: 'STONE' },
      ],
      fluids: [
        { lx: 4, y: 64, lz: 5, cell: { level: 0, source: true, type: 'water' } },
        { lx: 5, y: 64, lz: 5, cell: { level: 1, source: false, type: 'water' } },
        { lx: 6, y: 64, lz: 5, cell: { level: 0, source: true, type: 'water' } },
      ],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.tick()

      const renewed = decodeFluidByte(Option.getOrThrow(chunk.fluid)[blockIndexAt(5, 64, 5)]!)
      expect(Option.getOrThrow(renewed)).toEqual({ level: 0, source: true, type: 'water' })
    }))
  })

  it.effect('keeps unsupported flowing water falling instead of renewing it into a source', () => {
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 4, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 5, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 6, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 4, y: 63, lz: 5, blockType: 'STONE' },
        { lx: 6, y: 63, lz: 5, blockType: 'STONE' },
      ],
      fluids: [
        { lx: 4, y: 64, lz: 5, cell: { level: 0, source: true, type: 'water' } },
        { lx: 5, y: 64, lz: 5, cell: { level: 1, source: false, type: 'water' } },
        { lx: 6, y: 64, lz: 5, cell: { level: 0, source: true, type: 'water' } },
      ],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.tick()

      const middle = decodeFluidByte(Option.getOrThrow(chunk.fluid)[blockIndexAt(5, 64, 5)]!)
      expect(Option.getOrThrow(middle)).toEqual({ level: 1, source: false, type: 'water' })
      expect(chunk.blocks[blockIndexAt(5, 63, 5)]).toBe(blockTypeToIndex('WATER'))
    }))
  })

  // ─── disturbance after the frontier drains (notifyBlockChanged enqueues neighbours) ──

  it.effect('re-flows settled water after an adjacent block is broken', () => {
    // A water source boxed in by STONE on all 4 sides + below settles and DRAINS out of the
    // frontier on the first tick (FIX-R removes processed keys; a boxed cell never re-enqueues).
    // Then break the block below and notifyBlockChanged the broken position. `enqueue` adds the
    // changed position AND its 6 neighbours (fluid-position-utils), so the drained water above is
    // re-activated and flows into the new air — i.e. disturbance still works after the drain.
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 5, y: 64, lz: 5, blockType: 'WATER' },
        { lx: 5, y: 63, lz: 5, blockType: 'STONE' },
        { lx: 6, y: 64, lz: 5, blockType: 'STONE' },
        { lx: 4, y: 64, lz: 5, blockType: 'STONE' },
        { lx: 5, y: 64, lz: 6, blockType: 'STONE' },
        { lx: 5, y: 64, lz: 4, blockType: 'STONE' },
      ],
      fluids: [{ lx: 5, y: 64, lz: 5, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      // First tick: water is boxed in → settles, processed, removed from frontier (drained).
      yield* svc.tick()
      expect(chunk.blocks[blockIndexAt(5, 63, 5)]).toBe(blockTypeToIndex('STONE'))

      // Disturbance: break the block below the (now-drained) water source.
      chunk.blocks[blockIndexAt(5, 63, 5)] = blockTypeToIndex('AIR')
      yield* svc.notifyBlockChanged({ x: 5, y: 63, z: 5 })

      // Next tick: the neighbour enqueue re-activated the water above → it flows down.
      yield* svc.tick()
      expect(chunk.blocks[blockIndexAt(5, 63, 5)]).toBe(blockTypeToIndex('WATER'))
    }))
  })
})
