// Microbenchmark for the greedy-meshing hot path (the dominant per-chunk CPU cost;
// runs ~81× on initial load at renderDistance=4 and on every chunk edit).
// Run: npx tsx scripts/bench-meshing.ts
import { performance } from 'node:perf_hooks'
import { Option } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { greedyMeshChunk } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing'
import { createGreedyMeshScratch } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-types'
import { createAccumulatorPool } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-quads'

const STONE = blockTypeToIndex('STONE')
const GRASS = blockTypeToIndex('GRASS')
const AIR = 0

const newBlocks = () => new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
const set = (b: Uint8Array, x: number, y: number, z: number, v: number) => { b[chunkBlockIndexUnchecked(x, y, z)] = v }

// 1) Flat terrain: solid stone to y=62, grass at 63, air above (few faces — best case).
const flatChunk = () => {
  const b = newBlocks()
  for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y <= 62; y++) set(b, x, y, z, STONE)
    set(b, x, 63, z, GRASS)
  }
  return { coord: { x: 0, z: 0 }, blocks: b, maxY: 63, fluid: Option.none() }
}

// 2) Rolling terrain: per-column height varies 56..72 (realistic surface — moderate faces).
const rollingChunk = () => {
  const b = newBlocks()
  for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) {
    const h = 56 + Math.floor(8 * (1 + Math.sin(x * 0.7) * Math.cos(z * 0.5)))
    for (let y = 0; y < h; y++) set(b, x, y, z, STONE)
    set(b, x, h, z, GRASS)
  }
  return { coord: { x: 0, z: 0 }, blocks: b, maxY: 72, fluid: Option.none() }
}

// 3) Checkerboard in a 16³ volume: every cell alternates solid/air (worst case — max faces).
const checkerChunk = () => {
  const b = newBlocks()
  for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) for (let y = 0; y < CHUNK_SIZE; y++)
    if ((x + y + z) % 2 === 0) set(b, x, y, z, STONE)
  return { coord: { x: 0, z: 0 }, blocks: b, maxY: 16, fluid: Option.none() }
}

const offset = { wx: 0, wz: 0 }
const scratch = createGreedyMeshScratch()
const pool = createAccumulatorPool()

const bench = (name: string, chunk: any, iters: number) => {
  // Warmup (JIT)
  for (let i = 0; i < 50; i++) greedyMeshChunk(chunk, offset, new Set<number>(), scratch, undefined, new Set<number>(), pool)
  const samples: number[] = []
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) greedyMeshChunk(chunk, offset, new Set<number>(), scratch, undefined, new Set<number>(), pool)
    samples.push((performance.now() - t0) / iters)
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]!
  const res = greedyMeshChunk(chunk, offset, new Set<number>(), scratch, undefined, new Set<number>(), pool)
  const verts = res.opaqueRaw.positions.length / 3
  console.log(`${name.padEnd(20)} median ${median.toFixed(3)} ms/chunk   (~${verts} opaque verts)   x81 = ${(median * 81).toFixed(1)} ms`)
}

console.log('greedyMeshChunk microbenchmark (median of 7 runs, pooled accumulators)\n')
bench('flat terrain', flatChunk(), 200)
bench('rolling terrain', rollingChunk(), 200)
bench('checkerboard (worst)', checkerChunk(), 100)
