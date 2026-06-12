import { describe, it, expect } from 'vitest'
import { lodWithHysteresis } from '@ts-minecraft/rendering/infrastructure/renderer/world-renderer-chunk-sync'
import { LOD1_DISTANCE_CHUNKS, LOD2_DISTANCE_CHUNKS } from '@ts-minecraft/rendering/infrastructure/meshing/lod-simplification'

// Boundaries: lod0|lod1 at LOD1_DISTANCE_CHUNKS (4), lod1|lod2 at LOD2_DISTANCE_CHUNKS (8).
// Hysteresis margin is 1 chunk, so a chunk keeps its current lod until its distance moves a
// full chunk PAST the relevant boundary — absorbing the ≤1-chunk centroid jitter that would
// otherwise flip-flop boundary chunks' LOD (and re-mesh them) every frame the player moves.
describe('lodWithHysteresis', () => {
  it('keeps lod0 across the lod0→1 boundary until distance moves a full margin past it', () => {
    // natural lod at distance 4 is 1, but a chunk currently at lod0 holds until distance ≥ 5.
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS, 0)).toBe(0) // d=4, still 0
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS + 0.9, 0)).toBe(0) // d=4.9, still 0
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS + 1, 0)).toBe(1) // d=5, switches
  })

  it('keeps lod1 inside its widened band on both sides', () => {
    // A chunk at lod1 holds even where the natural lod is 0 (d=3) or 2 (d=8).
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS - 1, 1)).toBe(1) // d=3 (natural 0), holds
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS, 1)).toBe(1) // d=8 (natural 2), holds
    expect(lodWithHysteresis(LOD1_DISTANCE_CHUNKS - 1.1, 1)).toBe(0) // d=2.9, drops to 0
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS + 1, 1)).toBe(2) // d=9, rises to 2
  })

  it('keeps lod2 until distance moves a full margin inside the lod1 band', () => {
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS - 1, 2)).toBe(2) // d=7 (natural 1), holds
    expect(lodWithHysteresis(LOD2_DISTANCE_CHUNKS - 1.1, 2)).toBe(1) // d=6.9, drops to 1
  })

  it('is idempotent: feeding back the natural lod at a settled distance returns the same lod', () => {
    for (const d of [0, 2, 4, 6, 8, 12]) {
      const settled = lodWithHysteresis(d, lodWithHysteresis(d, 0))
      // applying twice from a clean state must converge (no oscillation)
      expect(lodWithHysteresis(d, settled)).toBe(settled)
    }
  })
})
