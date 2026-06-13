import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkManagerService } from './chunk-manager-service'
import type { Chunk } from '../domain/chunk'
import { resolveContact } from '../domain/fluid-contact'
import { AIR_INDEX, FLUID_TICK_BUDGET, FLOW_OFFSETS, INITIAL_STATE,
LAVA_INDEX, LAVA_TICK_INTERVAL, NOTIFY_OFFSETS, WATER_INDEX,
blockIndexFor, blockKey, chunkCoordsForPosition,
enqueue, getBlockIndex, maxLevelFor, parseKey, } from '@ts-minecraft/block'
import type { FluidCell, FluidType, FluidState } from '@ts-minecraft/block'
import { ChunkCacheKey, type Position } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import {
  setFluidBlockIfLoaded,
  setAirBlockIfLoaded,
  setSolidBlockIfLoaded,
} from './fluid-chunk-ops'
import { type WorkItem, splitBudget } from './fluid-tick-budget'
import { setCell, setCellAndEnqueueKey, removeCell, hydrateChunk } from './fluid-state-ops'

export { resolveContact } from '../domain/fluid-contact'

// Reused scratch position for the per-cell neighbour scan in resolveNeighborContact.
// The scan loop is fully synchronous (no yield* between writes and reads), so a single
// shared object is safe and avoids allocating 6 neighborPos literals per fluid cell.
const _neighborScratch: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

export class FluidService extends Effect.Service<FluidService>()(
  '@minecraft/application/FluidService',
  {
    effect: Effect.gen(function* () {
      const chunkManagerService = yield* ChunkManagerService
      const stateRef = yield* Ref.make<FluidState>(INITIAL_STATE)
      const loadedCacheRef = yield* Ref.make<HashMap.HashMap<ChunkCacheKey, Chunk>>(HashMap.empty())

      const isAirAt = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position): boolean => {
        const chunk = Option.getOrNull(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))))
        if (chunk === null) return false
        const idx = getBlockIndex(position)
        return idx >= 0 && chunk.blocks[idx] === AIR_INDEX
      }

      const blockAt = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position): Option.Option<number> =>
        Option.flatMap(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))), (chunk) => {
          const idx = getBlockIndex(position)
          /* c8 ignore next */
          return idx >= 0 ? Option.fromNullable(chunk.blocks[idx]) : Option.none()
        })

      const writeFluid = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position, cell: FluidCell): Effect.Effect<void, never> =>
        setFluidBlockIfLoaded(
          HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
          position,
          cell,
          chunkManagerService,
        )

      const writeAir = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position): Effect.Effect<void, never> =>
        setAirBlockIfLoaded(
          HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
          position,
          chunkManagerService,
        )

      const writeSolid = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position, blockType: BlockType): Effect.Effect<void, never> =>
        setSolidBlockIfLoaded(
          HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
          position,
          blockType,
          chunkManagerService,
        )

      const getLoaded: Effect.Effect<HashMap.HashMap<ChunkCacheKey, Chunk>, never> =
        Effect.gen(function* () {
          const cached = yield* Ref.get(loadedCacheRef)
          if (HashMap.size(cached) > 0) return cached
          const chunks = yield* chunkManagerService.getLoadedChunks()
          return HashMap.fromIterable(Arr.map(chunks, (chunk) => [ChunkCacheKey.make(chunk.coord), chunk] as const))
        })

      const seedFluid = (type: FluidType) => (position: Position): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const normalized = {
            x: Math.floor(position.x),
            y: Math.floor(position.y),
            z: Math.floor(position.z),
          }

          const loaded = yield* getLoaded
          const cell: FluidCell = { level: 0, source: true, type }

          yield* Ref.update(stateRef, (state) => ({
            ...setCell(state, normalized, cell),
            frontier: enqueue(state.frontier, normalized),
          }))

          yield* writeFluid(loaded, normalized, cell)
        })

      const removeFluid = (position: Position): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const normalized = {
            x: Math.floor(position.x),
            y: Math.floor(position.y),
            z: Math.floor(position.z),
          }

          const loaded = yield* getLoaded

          yield* Ref.update(stateRef, (state) => ({
            ...removeCell(state, normalized),
            frontier: enqueue(state.frontier, normalized),
          }))

          yield* writeAir(loaded, normalized)
        })

      // Returns true if the current cell was consumed by the lava<->water reaction.
      const resolveNeighborContact = (
        loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
        stateRefLocal: Ref.Ref<FluidState>,
        position: Position,
        cell: FluidCell,
      ): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRefLocal)
          // Imperative scan over the 6 neighbour offsets reusing one scratch position —
          // avoids 6 neighborPos literals + the findFirst closure on every processed cell.
          // Preserves NOTIFY_OFFSETS order (first opposite-type neighbour wins).
          let offset: (typeof NOTIFY_OFFSETS)[number] | null = null
          for (let i = 0; i < NOTIFY_OFFSETS.length; i++) {
            const candidate = NOTIFY_OFFSETS[i]!
            _neighborScratch.x = position.x + candidate.x
            _neighborScratch.y = position.y + candidate.y
            _neighborScratch.z = position.z + candidate.z
            const nc = Option.getOrNull(HashMap.get(state.cells, blockKey(_neighborScratch)))
            if (nc !== null && nc.type !== cell.type) {
              offset = candidate
              break
            }
          }
          if (offset === null) return false
          const neighborPos = { x: position.x + offset.x, y: position.y + offset.y, z: position.z + offset.z }
          const neighborCell = Option.getOrElse(
            HashMap.get(state.cells, blockKey(neighborPos)),
            () => ({ level: 0, source: true, type: 'water' as FluidType }),
          )
          /* c8 ignore next 3 */
          const [lavaCell, lavaPos, waterCell, waterPos] = cell.type === 'lava'
            ? [cell, position, neighborCell, neighborPos] as const
            : [neighborCell, neighborPos, cell, position] as const
          const solid = resolveContact(lavaCell, waterCell)
          /* c8 ignore next */
          /* c8 ignore next */
          const blockType = Option.getOrNull(solid)
          if (blockType === null) return false
          // COBBLESTONE replaces the flowing lava, STONE replaces the water flow around a lava source.
          /* c8 ignore next */
          const targetPos = blockType === 'COBBLESTONE' ? lavaPos : waterPos
          yield* Ref.update(stateRefLocal, (s) => {
            const withoutLava = removeCell(s, lavaPos)
            const withoutWater = removeCell(withoutLava, waterPos)
            return { ...withoutWater, frontier: enqueue(withoutWater.frontier, targetPos) }
          })
          yield* writeSolid(loaded, targetPos, blockType)
          // If the current cell's own position was consumed, report true.
          /* c8 ignore next 4 */
          const consumed = (targetPos.x === position.x && targetPos.y === position.y && targetPos.z === position.z)
            || (blockType === 'STONE' && cell.type === 'water')
            || (blockType === 'COBBLESTONE' && cell.type === 'lava')
          return consumed
        })

      const tryFlowDownward = (
        loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
        tickStateRef: Ref.Ref<FluidState>,
        position: Position,
        cell: FluidCell,
        nextLevel: number,
      ): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const below = { x: position.x, y: position.y - 1, z: position.z }
          if (!isAirAt(loaded, below)) return false
          const targetKey = blockKey(below)
          const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
            const existing = HashMap.get(s.cells, targetKey)
            /* c8 ignore next */
            if (Option.exists(existing, (e) => e.type === cell.type && e.level <= nextLevel)) return [false, s] as const
            const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
            return [true, setCellAndEnqueueKey(s, targetKey, newCell)] as const
          })
          /* c8 ignore next */
          if (shouldWrite) yield* writeFluid(loaded, below, { level: nextLevel, source: false, type: cell.type })
          return true
        })

      const flowLaterally = (
        loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
        tickStateRef: Ref.Ref<FluidState>,
        position: Position,
        cell: FluidCell,
        nextLevel: number,
      ): Effect.Effect<void, never> =>
        Effect.forEach(FLOW_OFFSETS, (offset) => Effect.gen(function* () {
          const target = {
            x: position.x + offset.x,
            y: position.y + offset.y,
            z: position.z + offset.z,
          }
          if (!isAirAt(loaded, target)) {
            const otherIdx = blockAt(loaded, target)
            const otherIdxVal = Option.getOrNull(otherIdx)
            const isOpposite = otherIdxVal !== null &&
              /* c8 ignore next */
              (cell.type === 'lava' ? otherIdxVal === WATER_INDEX : otherIdxVal === LAVA_INDEX)
            /* c8 ignore next 3 */
            if (isOpposite) yield* resolveNeighborContact(loaded, tickStateRef, position, cell)
            return
          }
          const targetKey = blockKey(target)
          const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
            const existing = HashMap.get(s.cells, targetKey)
            /* c8 ignore next */
            if (Option.exists(existing, (e) => e.type === cell.type && e.level <= nextLevel)) return [false, s] as const
            const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
            return [true, setCellAndEnqueueKey(s, targetKey, newCell)] as const
          })
          if (shouldWrite) yield* writeFluid(loaded, target, { level: nextLevel, source: false, type: cell.type })
        }), { concurrency: 1 })

      const processFluidCell = (
        loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
        tickStateRef: Ref.Ref<FluidState>,
        position: Position,
        cell: FluidCell,
      ): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          /* c8 ignore next */
          const currentChunk = Option.getOrNull(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))))
          /* c8 ignore next */
          if (currentChunk === null) return

          const idx = getBlockIndex(position)
          if (idx < 0 || currentChunk.blocks[idx] !== blockIndexFor(cell.type)) {
            yield* Ref.update(tickStateRef, (s) => removeCell(s, position))
            return
          }

          const consumed = yield* resolveNeighborContact(loaded, tickStateRef, position, cell)
          if (consumed) return

          const maxLevel = maxLevelFor(cell.type)
          const nextLevel = cell.source ? 1 : Math.min(cell.level + 1, maxLevel)
          if (!cell.source && cell.level >= maxLevel) return

          const flowedDown = yield* tryFlowDownward(loaded, tickStateRef, position, cell, nextLevel)
          if (!flowedDown) yield* flowLaterally(loaded, tickStateRef, position, cell, nextLevel)
        })

      return {
        notifyBlockChanged: (position: Position): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            frontier: enqueue(state.frontier, position),
          })),

        seedWater: seedFluid('water'),
        seedLava: seedFluid('lava'),

        removeWater: removeFluid,
        removeLava: removeFluid,

        syncLoadedChunks: (chunks: ReadonlyArray<Chunk>): Effect.Effect<void, never> =>
          Ref.set(stateRef, Arr.reduce(chunks, INITIAL_STATE, hydrateChunk)).pipe(
            Effect.flatMap(() => Ref.set(loadedCacheRef, HashMap.fromIterable(Arr.map(chunks, (chunk) => [ChunkCacheKey.make(chunk.coord), chunk] as const)))),
          ),

        tick: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const loaded = yield* Ref.get(loadedCacheRef)

            const state = yield* Ref.get(stateRef)
            const tickCounter = state.tickCounter + 1
            const lavaTickActive = tickCounter % LAVA_TICK_INTERVAL === 0

            // Collect this tick's work by LAZILY iterating the frontier (water up to half
            // the budget; lava fills the rest only on its tick). This is the critical hot
            // path: a body of settled water (sea level) leaves TENS OF THOUSANDS of cells in
            // the frontier, and the previous `Arr.fromIterable(frontier)` + carry-rebuild +
            // `HashSet.fromIterable([...carry])` was O(frontier) EVERY tick — ~37 MB of garbage
            // and ~700 ms/frame in a watery world. Stopping once the budget caps are hit makes
            // it O(budget). `splitBudget` only ever takes prefixes (≤halfBudget water,
            // ≤budget lava), so collecting those prefixes yields the SAME selection.
            const halfBudget = Math.floor(FLUID_TICK_BUDGET / 2)
            const lavaCap = lavaTickActive ? FLUID_TICK_BUDGET : 0
            const collected: WorkItem[] = []
            let waterCollected = 0
            let lavaCollected = 0
            for (const key of state.frontier) {
              const cellOpt = HashMap.get(state.cells, key)
              if (Option.isNone(cellOpt)) continue // stale frontier key (cell already removed)
              const cell = cellOpt.value
              if (cell.type === 'water') {
                if (waterCollected < halfBudget) { collected.push({ key, cell }); waterCollected++ }
              } else if (cell.type === 'lava') {
                if (lavaCollected < lavaCap) { collected.push({ key, cell }); lavaCollected++ }
              }
              if (waterCollected >= halfBudget && lavaCollected >= lavaCap) break
            }

            const { work } = splitBudget(collected, lavaTickActive, FLUID_TICK_BUDGET)
            if (work.length === 0) {
              yield* Ref.update(stateRef, (s) => ({ ...s, tickCounter }))
              return
            }

            // Drop only the keys we will process from the frontier (O(budget)). Unexamined
            // cells and (on a non-lava tick) all lava stay — matching the old carry/retain
            // semantics, but without rebuilding the whole HashSet.
            let nextFrontier = state.frontier
            for (let i = 0; i < work.length; i++) nextFrontier = HashSet.remove(nextFrontier, work[i]!.key)

            const tickStateRef = yield* Ref.make<FluidState>({ ...state, tickCounter, frontier: nextFrontier })

            yield* Effect.forEach(work, ({ key, cell }) =>
              processFluidCell(loaded, tickStateRef, parseKey(key), cell),
            { concurrency: 1 })

            yield* Ref.set(stateRef, yield* Ref.get(tickStateRef))
          }),
      }
    }),
  }
) {}

export const FluidServiceLive = FluidService.Default
