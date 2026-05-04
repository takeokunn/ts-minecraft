import { describe, it, expect } from 'vitest'
import { Array as Arr, MutableHashMap, Option } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { makeEmptyChunk, makeChunkWithBlock, ZERO_COORD, ZERO_OFFSET } from './greedy-meshing-test-utils'

describe('greedyMeshChunk', () => {
  describe('block colors (AO grayscale factors)', () => {
    it('assigns a non-zero color to a DIRT block', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.colors.length).toBe(72)  // 6 faces × 4 verts × 3 channels
      // Colors are grayscale AO factors (1.0 = no darkening) — must be non-zero
      const hasNonZero = Arr.some(Arr.fromIterable(result.toMeshed().opaque.colors), (v) => v > 0)
      expect(hasNonZero).toBe(true)
    })

    it('assigns equal grayscale AO colors to DIRT and STONE at same position (texture provides color)', () => {
      const dirtChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const stoneChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'STONE')
      const dirtResult = greedyMeshChunk(dirtChunk, ZERO_OFFSET)
      const stoneResult = greedyMeshChunk(stoneChunk, ZERO_OFFSET)

      // Both have ao=0 (no solid neighbors), so both should be factor=255 (1.0 * 255)
      expect(dirtResult.toMeshed().opaque.colors[0]).toBe(255)
      expect(stoneResult.toMeshed().opaque.colors[0]).toBe(255)
    })

    it('assigns different tile indexes to DIRT and STONE blocks (atlas tile lookup)', () => {
      const dirtChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const stoneChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'STONE')
      const dirtResult = greedyMeshChunk(dirtChunk, ZERO_OFFSET)
      const stoneResult = greedyMeshChunk(stoneChunk, ZERO_OFFSET)

      // DIRT maps to atlas tile 0, STONE to tile 1 — tile indexes must differ
      expect(dirtResult.toMeshed().opaque.tileIndexes[0]).not.toBe(stoneResult.toMeshed().opaque.tileIndexes[0])
    })
  })

  describe('UV coordinates', () => {
    it('returns uvs as Float32Array', () => {
      const chunk = makeEmptyChunk(ZERO_COORD)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.toMeshed().opaque.uvs).toBeInstanceOf(Float32Array)
    })

    it('uvs length equals 2 UV components per vertex', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      const vertexCount = result.toMeshed().opaque.positions.length / 3
      expect(result.toMeshed().opaque.uvs.length).toBe(vertexCount * 2)
    })

    it('tile indexes length equals one atlas tile per vertex', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      const vertexCount = result.toMeshed().opaque.positions.length / 3
      expect(result.toMeshed().opaque.tileIndexes.length).toBe(vertexCount)
    })

    it('all UV values are in [0, 1] range', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      Arr.forEach(Arr.fromIterable(result.toMeshed().opaque.uvs), uv => {
        expect(uv).toBeGreaterThanOrEqual(0)
        expect(uv).toBeLessThanOrEqual(1)
      })
    })

    it('GRASS top face has different tile index than GRASS side face', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Collect first tile index per face direction by checking normals
      const tileIndexesByNormal = MutableHashMap.empty<string, number>()
      const vertCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < vertCount; v += 4) {
        const ny = Option.getOrElse(Option.fromNullable(result.toMeshed().opaque.normals[v * 3 + 1]), () => 0)
        const nz = Option.getOrElse(Option.fromNullable(result.toMeshed().opaque.normals[v * 3 + 2]), () => 0)
        const key = ny === 1 ? 'top' : nz !== 0 ? 'side' : 'other'
        if (!MutableHashMap.has(tileIndexesByNormal, key)) {
          MutableHashMap.set(tileIndexesByNormal, key, Option.getOrElse(Option.fromNullable(result.toMeshed().opaque.tileIndexes[v]), () => 0))
        }
      }

      // grass_top (tile 4) and grass_side (tile 5) have different u0
      expect(Option.getOrElse(MutableHashMap.get(tileIndexesByNormal, 'top'), () => -1))
        .not.toBe(Option.getOrElse(MutableHashMap.get(tileIndexesByNormal, 'side'), () => -2))
    })
  })
})
