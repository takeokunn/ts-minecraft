import { describe, it, expect } from 'vitest'
import { generateTerrainBlocks } from '@ts-minecraft/terrain'
import type { TerrainGenerationInput } from '@ts-minecraft/terrain'

// Determinism is the foundation the whole world rests on: a chunk regenerated
// from the same seed must be byte-identical, or save/reload diverges (a chunk
// generated now would differ from the same chunk regenerated after eviction).
// The pipeline seeds every Perlin channel via mulberry32(seed ^ WEYL_x), so it
// is deterministic by construction — but the Perlin primitive has a Math.random
// fallback for an unseeded `rand`, so this pins that the generation path never
// trips it (and guards against any future non-deterministic feature).

const inputFor = (seed: number, x = 0, z = 0): TerrainGenerationInput => ({
  coord: { x, z },
  seaLevel: 63,
  lakeLevel: 63,
  seed,
})

describe('terrain generation determinism', () => {
  it('same seed + coord → byte-identical chunk (save/reload reproducibility)', () => {
    const a = generateTerrainBlocks(inputFor(123456))
    const b = generateTerrainBlocks(inputFor(123456))
    expect(a.blocks).toEqual(b.blocks)
    expect(a.skyLight).toEqual(b.skyLight)
    expect(a.blockLight).toEqual(b.blockLight)
  })

  it('a non-origin chunk is also reproducible from the same seed', () => {
    const a = generateTerrainBlocks(inputFor(987, 4, -7))
    const b = generateTerrainBlocks(inputFor(987, 4, -7))
    expect(a.blocks).toEqual(b.blocks)
  })

  it('different seeds produce different terrain (the seed actually drives generation)', () => {
    const a = generateTerrainBlocks(inputFor(1))
    const b = generateTerrainBlocks(inputFor(2))
    // A full 16×16×256 chunk collision between distinct seeds is astronomically
    // improbable, so inequality reliably proves seed sensitivity.
    expect(a.blocks).not.toEqual(b.blocks)
  })
})
