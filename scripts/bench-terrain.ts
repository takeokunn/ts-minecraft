// Microbenchmark for per-chunk terrain generation (runs ~81× on load + on every
// chunk streamed while walking). Run: npx tsx scripts/bench-terrain.ts
import { performance } from 'node:perf_hooks'
import { buildTerrainLayer, generateTerrainBlocks } from '@ts-minecraft/world/application/terrain-generation'

const SEED = 12345
const bench = (label: string, fn: (i: number) => void, iters: number, warmup = 60) => {
  for (let i = 0; i < warmup; i++) fn(i)
  const s: number[] = []
  for (let r = 0; r < 9; r++) { const a = performance.now(); for (let i = 0; i < iters; i++) fn(i); s.push((performance.now() - a) / iters) }
  s.sort((x, y) => x - y)
  console.log(`${label.padEnd(40)} median ${s[4]!.toFixed(3)} ms/chunk   x81 = ${(s[4]! * 81).toFixed(0)} ms`)
}
// Spread coords so each call generates a distinct chunk (avoids any incidental caching).
const coordFor = (i: number) => ({ x: (i % 64) - 32, z: ((i >> 6) % 64) - 32 })

console.log('per-chunk terrain generation breakdown (median of 9)\n')
bench('buildTerrainLayer(seed) — one-time/seed', () => { buildTerrainLayer(SEED) }, 200, 200)
bench('generateTerrainBlocks (gen + light)', (i) => { generateTerrainBlocks({ coord: coordFor(i), seaLevel: 63, lakeLevel: 63, seed: SEED }) }, 80)
