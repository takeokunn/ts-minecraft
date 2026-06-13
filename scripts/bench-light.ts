// Microbenchmark for per-chunk light computation (runs ~81× on load alongside meshing).
// Run: npx tsx scripts/bench-light.ts
import { performance } from 'node:perf_hooks'
import { blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { computeSkyLight, computeBlockLight, createLightBuffer } from '@ts-minecraft/block'

const STONE = blockTypeToIndex('STONE')
const GRASS = blockTypeToIndex('GRASS')

const newBlocks = () => new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
const set = (b: Uint8Array, x: number, y: number, z: number, v: number) => { b[chunkBlockIndexUnchecked(x, y, z)] = v }

const flatChunk = () => {
  const b = newBlocks()
  for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y <= 62; y++) set(b, x, y, z, STONE)
    set(b, x, 63, z, GRASS)
  }
  return b
}
const rollingChunk = () => {
  const b = newBlocks()
  for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) {
    const h = 56 + Math.floor(8 * (1 + Math.sin(x * 0.7) * Math.cos(z * 0.5)))
    for (let y = 0; y < h; y++) set(b, x, y, z, STONE)
    set(b, x, h, z, GRASS)
  }
  return b
}

const bench = (name: string, fn: () => void, iters: number) => {
  for (let i = 0; i < 50; i++) fn()
  const samples: number[] = []
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) fn()
    samples.push((performance.now() - t0) / iters)
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]!
  console.log(`${name.padEnd(28)} median ${median.toFixed(3)} ms/chunk   x81 = ${(median * 81).toFixed(1)} ms`)
}

console.log('per-chunk light microbenchmark (median of 7 runs)\n')
for (const [label, blocks] of [['flat', flatChunk()], ['rolling', rollingChunk()]] as const) {
  const sky = createLightBuffer()
  const block = createLightBuffer()
  bench(`computeSkyLight (${label})`, () => computeSkyLight(blocks, sky), 300)
  bench(`computeBlockLight (${label})`, () => computeBlockLight(blocks, block), 300)
}
