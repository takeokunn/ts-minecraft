import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, PLAYER_HALF_HEIGHT, SEA_LEVEL, blockIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'
import { candidateAt, clampAboveWater, findFallbackSurfaceY, keyOf, scoreSpawnCandidate, selectSurfaceSpawn } from '@ts-minecraft/app/main/spawn-selection-search'

const DIRT = blockTypeToIndex('DIRT')
const STONE = blockTypeToIndex('STONE')
const WATER = blockTypeToIndex('WATER')
const LEAVES = blockTypeToIndex('LEAVES')

const MIN_SPAWN_BODY_Y = SEA_LEVEL + 1 + PLAYER_HALF_HEIGHT

const emptyChunk = (x = 0, z = 0): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const setBlock = (chunk: Chunk, x: number, y: number, z: number, type: number) => {
  chunk.blocks[Option.getOrThrow(blockIndex(x, y, z))] = type
}

const fillColumn = (chunk: Chunk, x: number, z: number, fromY: number, toY: number, type: number) => {
  for (let y = fromY; y <= toY; y++) setBlock(chunk, x, y, z, type)
}

// ─── mountain-top spawns (regression: no surface height cap) ─────────────────
describe('selectSurfaceSpawn above the old y=96 cap', () => {
  it('prefers an open plateau above y=96 over a walled ravine floor', () => {
    // Regression: an old MAX_SURFACE_Y=+32 cap silently discarded every column
    // taller than y=96, so in mountainous regions the only sky-visible
    // candidates were ravine floors — players spawned at the bottom of a pit.
    const chunk = emptyChunk()
    // plateau: solid to y=100 across most of the chunk (surface ABOVE the old cap)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        fillColumn(chunk, x, z, 0, 100, STONE)
      }
    }
    // a narrow ravine slot: floor at y=70, walls all around (low openness)
    fillColumn(chunk, 8, 8, 0, CHUNK_HEIGHT - 1, 0 as never) // clear the column to air
    fillColumn(chunk, 8, 8, 0, 70, STONE) // ravine floor

    const spawn = selectSurfaceSpawn([chunk], { x: 8.5, y: 0, z: 8.5 })
    // must pick the open plateau surface (y=100 → feet 101), not the ravine floor (y=70)
    expect(spawn.position.y).toBeGreaterThan(100)
  })
})

// ─── keyOf ────────────────────────────────────────────────────────────────────
describe('keyOf', () => {
  it('formats positive chunk coords as "cx,cz"', () => {
    expect(keyOf(3, 7)).toBe('3,7')
  })

  it('formats negative chunk coords correctly', () => {
    expect(keyOf(-2, -5)).toBe('-2,-5')
  })

  it('formats origin as "0,0"', () => {
    expect(keyOf(0, 0)).toBe('0,0')
  })
})

// ─── scoreSpawnCandidate ──────────────────────────────────────────────────────
describe('scoreSpawnCandidate', () => {
  it('scores openness ahead of distance (openness×1000 outweighs small distanceSq difference)', () => {
    expect(scoreSpawnCandidate({ openness: 12, distanceSq: 400 })).toBeGreaterThan(
      scoreSpawnCandidate({ openness: 11, distanceSq: 1 }),
    )
  })

  it('returns openness×1000 − distanceSq', () => {
    expect(scoreSpawnCandidate({ openness: 20, distanceSq: 100 })).toBe(19900)
  })

  it('returns 0 for zero openness and zero distance', () => {
    expect(scoreSpawnCandidate({ openness: 0, distanceSq: 0 })).toBe(0)
  })

  it('can produce a negative score for a low-openness far-away column', () => {
    expect(scoreSpawnCandidate({ openness: 0, distanceSq: 5000 })).toBe(-5000)
  })
})

// ─── candidateAt ──────────────────────────────────────────────────────────────
describe('candidateAt', () => {
  it('returns Option.none when the chunk map is empty', () => {
    expect(Option.isNone(candidateAt(new Map(), { x: 0, z: 0 }, 0, 0))).toBe(true)
  })

  it('returns Option.none for an all-AIR column (no solid surface)', () => {
    const chunk = emptyChunk()
    const result = candidateAt(new Map([['0,0', chunk]]), { x: 0, z: 0 }, 8, 8)
    expect(Option.isNone(result)).toBe(true)
  })

  it('rejects surface candidates without sky-visible headroom', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 64, DIRT)
    setBlock(chunk, 8, 65, 8, LEAVES)

    const candidate = candidateAt(new Map([['0,0', chunk]]), { x: 8.5, z: 8.5 }, 8, 8)

    expect(Option.isNone(candidate)).toBe(true)
  })

  it('returns the correct surfaceY and spawn position for a STONE-topped column', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 60, STONE)

    const result = candidateAt(new Map([['0,0', chunk]]), { x: 0, z: 0 }, 8, 8)

    expect(Option.isSome(result)).toBe(true)
    const c = Option.getOrThrow(result)
    expect(c.surfaceY).toBe(60)
    // position is block-centred: x+0.5, y=surfaceY+1+PLAYER_HALF_HEIGHT, z+0.5
    expect(c.position.x).toBe(8.5)
    expect(c.position.z).toBe(8.5)
    expect(c.position.y).toBeCloseTo(60 + 1 + PLAYER_HALF_HEIGHT)
  })

  it('computes distanceSq from the base position', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 60, STONE)

    const c = Option.getOrThrow(candidateAt(new Map([['0,0', chunk]]), { x: 0, z: 0 }, 8, 8))

    // distanceSq = (8.5 - 0)² + (8.5 - 0)² = 72.25 + 72.25 = 144.5
    expect(c.distanceSq).toBeCloseTo(144.5)
  })

  it('reports openness = 20 for a fully open column in an otherwise empty chunk', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 60, STONE)

    const c = Option.getOrThrow(candidateAt(new Map([['0,0', chunk]]), { x: 0, z: 0 }, 8, 8))

    expect(c.openness).toBe(20)
  })
})

// ─── clampAboveWater ──────────────────────────────────────────────────────────
describe('clampAboveWater', () => {
  it('clamps submerged spawn bodies above the water line', () => {
    expect(clampAboveWater({ position: { x: 1, y: 63, z: 2 }, yaw: 0 }).position.y).toBe(64.9)
  })

  it('returns the same object reference when position.y is already at or above MIN_SPAWN_BODY_Y', () => {
    const sel = { position: { x: 0, y: MIN_SPAWN_BODY_Y, z: 0 }, yaw: 0 }
    expect(clampAboveWater(sel)).toBe(sel)
  })

  it('preserves x, z, and yaw when lifting y to the water line', () => {
    const result = clampAboveWater({ position: { x: 5, y: 1, z: 7 }, yaw: -1.5 })
    expect(result.position.x).toBe(5)
    expect(result.position.z).toBe(7)
    expect(result.yaw).toBe(-1.5)
    expect(result.position.y).toBeCloseTo(MIN_SPAWN_BODY_Y)
  })
})

// ─── findFallbackSurfaceY ──────────────────────────────────────────────────────
describe('findFallbackSurfaceY', () => {
  it('returns undefined when no chunks are loaded', () => {
    expect(findFallbackSurfaceY(new Map(), { x: 0, z: 0 })).toBeUndefined()
  })

  it('returns topSolidY + 1 + PLAYER_HALF_HEIGHT for a dry column', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 0, 0, 0, 60, STONE)

    expect(findFallbackSurfaceY(new Map([['0,0', chunk]]), { x: 0, z: 0 }))
      .toBeCloseTo(60 + 1 + PLAYER_HALF_HEIGHT)
  })

  it('selects the nearest dry fallback column over wet ground', () => {
    const dry = emptyChunk(0, 0)
    fillColumn(dry, 2, 2, 0, 64, STONE)
    const wet = emptyChunk(1, 0)
    fillColumn(wet, 2, 2, 0, 63, WATER)
    fillColumn(wet, 2, 2, 64, 64, STONE)

    const y = findFallbackSurfaceY(new Map([
      ['0,0', wet],
      ['1,0', dry],
    ]), { x: 2.5, z: 2.5 })

    expect(y).toBe(65.9)
  })

  it('spawns above the water surface (not at the seabed) for a submerged column', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 0, 0, 0, 40, STONE) // seabed
    fillColumn(chunk, 0, 0, 41, 55, WATER) // water column up to y=55

    // topY = Math.max(solidTop=40, fluidTop=55) = 55 → spawn at 55+1+PLAYER_HALF_HEIGHT
    expect(findFallbackSurfaceY(new Map([['0,0', chunk]]), { x: 0, z: 0 }))
      .toBeCloseTo(55 + 1 + PLAYER_HALF_HEIGHT)
  })

  it('among equally-dry columns picks the nearer one to the base position', () => {
    const chunk = emptyChunk()
    // Near column at world (1,1): STONE at y=40
    fillColumn(chunk, 1, 1, 0, 40, STONE)
    // Far column at world (15,15): STONE at y=60 (higher y but farther from origin)
    fillColumn(chunk, 15, 15, 0, 60, STONE)

    const y = findFallbackSurfaceY(new Map([['0,0', chunk]]), { x: 0, z: 0 })

    // Near column wins: y=40+1+PLAYER_HALF_HEIGHT
    expect(y).toBeCloseTo(40 + 1 + PLAYER_HALF_HEIGHT)
  })
})
