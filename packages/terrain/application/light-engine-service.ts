import { Effect, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe } from '@ts-minecraft/kernel'
import type { Chunk } from '../domain/chunk'
import {
  aabbFromVoxel,
  fullChunkAABB,
  unionAABB,
  type ChunkAABB,
} from '../domain/chunk-aabb'
import {
  computeBlockLight,
  computeSkyLight,
  createLightBuffer,
  emissiveLevelByIndex,
  getLightAt,
  isTransparentIndex,
  LIGHT_BYTE_LENGTH,
  LIGHT_LEVEL_MAX,
  setLightAt,
  type LightGrids,
} from '@ts-minecraft/world-state'

export type { LightGrids } from '@ts-minecraft/world-state'

// FR-3.5 boundary report — flags which 4 cardinal neighbor chunks had a
// boundary voxel touched by the BFS propagation. Diagonal neighbors are
// derived from the conjunction of two cardinal flags by the caller.
export type BoundaryDirty = Readonly<{
  readonly nx: boolean
  readonly px: boolean
  readonly nz: boolean
  readonly pz: boolean
}>

export type IncrementalLightResult = Readonly<{
  readonly skyLight: Uint8Array
  readonly blockLight: Uint8Array
  readonly boundary: BoundaryDirty
  // FR-4.2: bounding box (chunk-local, inclusive) of every voxel whose light
  // value changed during BFS. Option.none() means "either no voxels touched"
  // OR "fell back to full re-compute" — caller treats the latter as
  // `fullChunkAABB`. propagateLightIncremental sets it on the BFS path.
  readonly affectedAABB: Option.Option<ChunkAABB>
}>

export type DirtyVoxel = Readonly<{
  readonly lx: number
  readonly y: number
  readonly lz: number
}>

const inBounds = (lx: number, y: number, lz: number): boolean =>
  lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE

// SEC-W1: BFS DoS cap — past this seed count, full re-compute is faster (and bounded)
// than removal/add BFS (queue can balloon to 6 MB peak per chunk for 65 k voxels).
// 256 = 16x16 = one chunk plane; this is the empirical crossover where per-voxel BFS
// overhead exceeds O(n) full re-compute on a 16x16x256 chunk.
export const FULL_RECOMPUTE_THRESHOLD = 256

const lightBufferOrFresh = (buf: Uint8Array<ArrayBufferLike> | undefined): Uint8Array =>
  Option.match(Option.filter(Option.fromNullable(buf), (b) => b.byteLength === LIGHT_BYTE_LENGTH), {
    onNone: () => createLightBuffer(),
    onSome: (b) => b,
  })

// 6-neighbor offsets (3D)
const NEIGHBOR_DX = [1, -1, 0, 0, 0, 0] as const
const NEIGHBOR_DY = [0, 0, 1, -1, 0, 0] as const
const NEIGHBOR_DZ = [0, 0, 0, 0, 1, -1] as const

// Pack (x:4 | z:4 | y:9 | level:5) into a 32-bit int. CHUNK_SIZE=16 fits in 4
// bits, CHUNK_HEIGHT=256 needs 9 bits, level <= 15 fits in 5 bits.
const packPosLevel = (x: number, y: number, z: number, lvl: number): number =>
  (x << 13) | (z << 9) | y | (lvl << 17)
const unpackX = (p: number): number => (p >> 13) & 0x0f
const unpackZ = (p: number): number => (p >> 9) & 0x0f
const unpackY = (p: number): number => p & 0x1ff
const unpackLevel = (p: number): number => (p >> 17) & 0x1f

// ---------------------------------------------------------------------------
// Block-light incremental BFS (Mojang-equivalent removal/add algorithm).
//
// 1. Seed: for each dirty voxel, push (pos, oldLevel) to removalQueue and
//    zero its grid value. If the new block is emissive, push (pos, newEmit)
//    to addQueue.
// 2. Removal phase: pop (v, oldLevel). For each neighbor n with light L:
//    - L < oldLevel : derived from v — wipe and recurse with (n, L).
//    - L >= oldLevel : independent source — push (n, L) to addQueue for
//      re-saturation.
// 3. Add phase: standard BFS — propagate (level - 1) into transparent
//    neighbors with strictly smaller existing light.
//
// Equivalence to full re-compute: the removal BFS conservatively wipes any
// voxel that *could* have been derived from the dirty seed. The add BFS
// re-saturates from every still-bright source it encounters during removal,
// plus from any new emitters in the dirty set. Because (a) every voxel
// reaches its supremum from the nearest source, and (b) the add BFS
// monotonically increases values, the final grid equals the supremum over
// all sources — identical to the full computeBlockLight result.
// ---------------------------------------------------------------------------
// FR-4.2 — AABB accumulator: every voxel whose grid value changes during BFS
// is fed into `trackTouched`, growing the union. `aabb === null` means "no
// touch yet"; caller wraps the final value in Option.
type AABBAccumulator = { aabb: ChunkAABB | null }

const trackTouched = (acc: AABBAccumulator, x: number, y: number, z: number): void => {
  const v = aabbFromVoxel({ lx: x, y, lz: z })
  acc.aabb = acc.aabb === null ? v : unionAABB(acc.aabb, v)
}

const propagateBlockLightIncremental = (
  blocks: Uint8Array,
  grid: Uint8Array,
  dirty: ReadonlyArray<DirtyVoxel>,
  boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean },
  touched: AABBAccumulator,
): void => {
  const removalQueue: number[] = []
  const addQueue: number[] = []

  for (let i = 0; i < dirty.length; i++) {
    const d = dirty[i]!
    const oldLevel = getLightAt(grid, d.lx, d.y, d.lz)
    const blockIdx = blocks[blockIndexUnsafe(d.lx, d.y, d.lz)] ?? 0
    const newEmit = emissiveLevelByIndex(blockIdx)
    if (oldLevel > 0) {
      setLightAt(grid, d.lx, d.y, d.lz, 0)
      trackTouched(touched, d.lx, d.y, d.lz)
      removalQueue.push(packPosLevel(d.lx, d.y, d.lz, oldLevel))
    }
    if (newEmit > 0) {
      setLightAt(grid, d.lx, d.y, d.lz, newEmit)
      trackTouched(touched, d.lx, d.y, d.lz)
      addQueue.push(packPosLevel(d.lx, d.y, d.lz, newEmit))
    }
  }

  let head = 0
  while (head < removalQueue.length) {
    const packed = removalQueue[head++]!
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const oldLevel = unpackLevel(packed)
    for (let i = 0; i < 6; i++) {
      const nx = x + NEIGHBOR_DX[i]!
      const ny = y + NEIGHBOR_DY[i]!
      const nz = z + NEIGHBOR_DZ[i]!
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        if (nx < 0) boundary.nx = true
        else if (nx >= CHUNK_SIZE) boundary.px = true
        if (nz < 0) boundary.nz = true
        else if (nz >= CHUNK_SIZE) boundary.pz = true
        continue
      }
      const nLevel = getLightAt(grid, nx, ny, nz)
      if (nLevel === 0) continue
      if (nLevel < oldLevel) {
        setLightAt(grid, nx, ny, nz, 0)
        trackTouched(touched, nx, ny, nz)
        removalQueue.push(packPosLevel(nx, ny, nz, nLevel))
      } else {
        addQueue.push(packPosLevel(nx, ny, nz, nLevel))
      }
    }
  }

  head = 0
  while (head < addQueue.length) {
    const packed = addQueue[head++]!
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const level = unpackLevel(packed)
    const cur = getLightAt(grid, x, y, z)
    if (cur > level) continue
    if (level <= 1) continue
    const nextLevel = level - 1
    for (let i = 0; i < 6; i++) {
      const nx = x + NEIGHBOR_DX[i]!
      const ny = y + NEIGHBOR_DY[i]!
      const nz = z + NEIGHBOR_DZ[i]!
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        if (nx < 0) boundary.nx = true
        else if (nx >= CHUNK_SIZE) boundary.px = true
        if (nz < 0) boundary.nz = true
        else if (nz >= CHUNK_SIZE) boundary.pz = true
        continue
      }
      const nBlock = blocks[blockIndexUnsafe(nx, ny, nz)] ?? 0
      if (isTransparentIndex(nBlock) === false) continue
      const existing = getLightAt(grid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(grid, nx, ny, nz, nextLevel)
      trackTouched(touched, nx, ny, nz)
      addQueue.push(packPosLevel(nx, ny, nz, nextLevel))
    }
  }
}

// ---------------------------------------------------------------------------
// Sky-light incremental BFS. The key difference vs. block light: for each
// dirty (lx,lz) column we re-walk top-down to determine new sky exposure;
// the removal/add BFS then cleans up lateral propagation as for block light.
// ---------------------------------------------------------------------------
const propagateSkyLightIncremental = (
  blocks: Uint8Array,
  grid: Uint8Array,
  dirty: ReadonlyArray<DirtyVoxel>,
  boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean },
  touched: AABBAccumulator,
): void => {
  const columnsSeen = new Set<number>()
  const removalQueue: number[] = []
  const addQueue: number[] = []

  for (let i = 0; i < dirty.length; i++) {
    const d = dirty[i]!
    const colKey = (d.lx << 4) | d.lz
    if (columnsSeen.has(colKey)) continue
    columnsSeen.add(colKey)

    let exposed = true
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const idx = blockIndexUnsafe(d.lx, y, d.lz)
      const blockIdx = blocks[idx] ?? 0
      if (isTransparentIndex(blockIdx) === false) {
        exposed = false
      }
      const current = getLightAt(grid, d.lx, y, d.lz)
      if (exposed) {
        if (current < LIGHT_LEVEL_MAX) {
          setLightAt(grid, d.lx, y, d.lz, LIGHT_LEVEL_MAX)
          trackTouched(touched, d.lx, y, d.lz)
          addQueue.push(packPosLevel(d.lx, y, d.lz, LIGHT_LEVEL_MAX))
        }
      } else if (current === LIGHT_LEVEL_MAX) {
        setLightAt(grid, d.lx, y, d.lz, 0)
        trackTouched(touched, d.lx, y, d.lz)
        removalQueue.push(packPosLevel(d.lx, y, d.lz, LIGHT_LEVEL_MAX))
      } else if (isTransparentIndex(blockIdx) === false && current > 0) {
        setLightAt(grid, d.lx, y, d.lz, 0)
        trackTouched(touched, d.lx, y, d.lz)
        removalQueue.push(packPosLevel(d.lx, y, d.lz, current))
      }
    }
  }

  let head = 0
  while (head < removalQueue.length) {
    const packed = removalQueue[head++]!
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const oldLevel = unpackLevel(packed)
    for (let i = 0; i < 6; i++) {
      const nx = x + NEIGHBOR_DX[i]!
      const ny = y + NEIGHBOR_DY[i]!
      const nz = z + NEIGHBOR_DZ[i]!
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        if (nx < 0) boundary.nx = true
        else if (nx >= CHUNK_SIZE) boundary.px = true
        if (nz < 0) boundary.nz = true
        else if (nz >= CHUNK_SIZE) boundary.pz = true
        continue
      }
      const nLevel = getLightAt(grid, nx, ny, nz)
      if (nLevel === 0) continue
      if (nLevel < oldLevel) {
        setLightAt(grid, nx, ny, nz, 0)
        trackTouched(touched, nx, ny, nz)
        removalQueue.push(packPosLevel(nx, ny, nz, nLevel))
      } else {
        addQueue.push(packPosLevel(nx, ny, nz, nLevel))
      }
    }
  }

  head = 0
  while (head < addQueue.length) {
    const packed = addQueue[head++]!
    const x = unpackX(packed)
    const y = unpackY(packed)
    const z = unpackZ(packed)
    const level = unpackLevel(packed)
    const cur = getLightAt(grid, x, y, z)
    if (cur > level) continue
    if (level <= 1) continue
    const nextLevel = level - 1
    for (let i = 0; i < 6; i++) {
      const nx = x + NEIGHBOR_DX[i]!
      const ny = y + NEIGHBOR_DY[i]!
      const nz = z + NEIGHBOR_DZ[i]!
      if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
        if (nx < 0) boundary.nx = true
        else if (nx >= CHUNK_SIZE) boundary.px = true
        if (nz < 0) boundary.nz = true
        else if (nz >= CHUNK_SIZE) boundary.pz = true
        continue
      }
      const nBlock = blocks[blockIndexUnsafe(nx, ny, nz)] ?? 0
      if (isTransparentIndex(nBlock) === false) continue
      const existing = getLightAt(grid, nx, ny, nz)
      if (existing >= nextLevel) continue
      setLightAt(grid, nx, ny, nz, nextLevel)
      trackTouched(touched, nx, ny, nz)
      addQueue.push(packPosLevel(nx, ny, nz, nextLevel))
    }
  }
}

// FR-3.4/3.5: per-chunk BFS halts at boundary; the boundary report tells the
// chunk-manager which neighbor chunks should be re-meshed. Actual neighbor
// chunk light buffers are not mutated — neighbors re-light themselves on
// their own markChunkDirty cycle (their boundary blocks see this chunk's
// latest state via the chunk cache).
export class LightEngineService extends Effect.Service<LightEngineService>()(
  '@minecraft/application/LightEngineService',
  {
    effect: Effect.succeed({
      computeLight: (chunk: Chunk): Effect.Effect<LightGrids, never> =>
        Effect.sync(() => {
          const sky = createLightBuffer()
          const block = createLightBuffer()
          computeSkyLight(chunk.blocks, sky)
          computeBlockLight(chunk.blocks, block)
          return { skyLight: sky, blockLight: block }
        }),

      updateLight: (chunk: Chunk): Effect.Effect<LightGrids, never> =>
        Effect.sync(() => {
          const sky = lightBufferOrFresh(chunk.skyLight)
          const block = lightBufferOrFresh(chunk.blockLight)
          computeSkyLight(chunk.blocks, sky)
          computeBlockLight(chunk.blocks, block)
          return { skyLight: sky, blockLight: block }
        }),

      // FR-3.4: BFS-incremental light update. Reuses the chunk's existing
      // light buffers (or initialises them if absent) and runs a bounded
      // removal + add BFS seeded from `dirtyVoxels`. Equivalent to a full
      // re-compute for any sequence of edits, by induction over dirty voxels.
      // FR-3.5: Boundary report indicates which neighbor chunks were touched.
      propagateLightIncremental: (
        chunk: Chunk,
        dirtyVoxels: ReadonlyArray<DirtyVoxel>,
      ): Effect.Effect<IncrementalLightResult, never> =>
        Effect.sync(() => {
          const sky = lightBufferOrFresh(chunk.skyLight)
          const block = lightBufferOrFresh(chunk.blockLight)
          const boundary = { nx: false, px: false, nz: false, pz: false }
          const valid: DirtyVoxel[] = []
          for (let i = 0; i < dirtyVoxels.length; i++) {
            const d = dirtyVoxels[i]!
            if (inBounds(d.lx, d.y, d.lz)) valid.push(d)
          }
          if (chunk.skyLight === undefined || chunk.blockLight === undefined) {
            // First-time bake: incremental BFS requires a coherent prior
            // state to diff against, so fall back to full compute.
            // FR-4.2: full bake → affected = full chunk.
            computeSkyLight(chunk.blocks, sky)
            computeBlockLight(chunk.blocks, block)
            return {
              skyLight: sky, blockLight: block,
              boundary: { nx: true, px: true, nz: true, pz: true },
              affectedAABB: Option.some(fullChunkAABB),
            }
          }
          if (valid.length === 0) {
            // FR-4.2: nothing changed → no affected voxels (caller skips re-mesh).
            return { skyLight: sky, blockLight: block, boundary, affectedAABB: Option.none() }
          }
          // SEC-W1: Past the crossover, full re-compute is O(n) and bounded;
          // BFS removal/add queue can balloon to 6 MB peak for 65 k voxels.
          // Reports all-boundary dirty since full re-compute may have changed any edge voxel.
          // FR-4.2: full re-compute → affected = full chunk.
          if (valid.length > FULL_RECOMPUTE_THRESHOLD) {
            computeSkyLight(chunk.blocks, sky)
            computeBlockLight(chunk.blocks, block)
            return {
              skyLight: sky, blockLight: block,
              boundary: { nx: true, px: true, nz: true, pz: true },
              affectedAABB: Option.some(fullChunkAABB),
            }
          }
          // FR-4.2: AABB accumulator gathers every voxel touched by both BFS
          // passes. Seed the accumulator with the dirty voxels themselves so
          // even no-op edits (place where the same block already was) report
          // a non-empty AABB — the caller still needs to re-mesh that voxel.
          const touched: AABBAccumulator = { aabb: null }
          for (let i = 0; i < valid.length; i++) {
            const d = valid[i]!
            trackTouched(touched, d.lx, d.y, d.lz)
          }
          propagateBlockLightIncremental(chunk.blocks, block, valid, boundary, touched)
          propagateSkyLightIncremental(chunk.blocks, sky, valid, boundary, touched)
          return {
            skyLight: sky, blockLight: block, boundary,
            affectedAABB: touched.aabb === null ? Option.none() : Option.some(touched.aabb),
          }
        }),

      getSkyLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.skyLight), {
          onNone: () => 15,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },

      getBlockLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.blockLight), {
          onNone: () => 0,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },
    }),
  }
) {}

export const LightEngineLive = LightEngineService.Default
