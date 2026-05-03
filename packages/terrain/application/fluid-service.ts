import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkManagerService } from './chunk-manager-service'
import type { Chunk } from '../domain/chunk'
import { resolveContact } from '../domain/fluid-contact'
import {
  AIR_INDEX, FLUID_TICK_BUDGET, FLOW_OFFSETS, INITIAL_STATE,
  LAVA_INDEX, LAVA_TICK_INTERVAL, NOTIFY_OFFSETS, WATER_INDEX,
  blockIndexFor, blockKey, chunkCoordsForPosition,
  enqueue, getBlockIndex, maxLevelFor, parseKey,
} from '@ts-minecraft/world-state'
import type { FluidCell, FluidType, FluidState } from '@ts-minecraft/world-state'
import { ChunkCacheKey, type Position } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import {
  setFluidBlockIfLoaded,
  setAirBlockIfLoaded,
  setSolidBlockIfLoaded,
} from './fluid-chunk-ops'
import { type WorkItem, splitBudget } from './fluid-tick-budget'
import { setCell, removeCell, hydrateChunk } from './fluid-state-ops'

export { resolveContact } from '../domain/fluid-contact'

export class FluidService extends Effect.Service<FluidService>()(
  '@minecraft/application/FluidService',
  {
    effect: Effect.all([
      ChunkManagerService,
      Ref.make<FluidState>(INITIAL_STATE),
      Ref.make<HashMap.HashMap<ChunkCacheKey, Chunk>>(HashMap.empty()),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([chunkManagerService, stateRef, loadedCacheRef]) => {

      const isAirAt = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position): boolean =>
        Option.match(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))), {
          onNone: () => false,
          onSome: (chunk) => {
            const idx = getBlockIndex(position)
            return idx >= 0 && chunk.blocks[idx] === AIR_INDEX
          },
        })

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
        Ref.get(loadedCacheRef).pipe(
          Effect.flatMap((cached) =>
            HashMap.size(cached) > 0
              ? Effect.succeed(cached)
              : chunkManagerService.getLoadedChunks().pipe(
                  Effect.map((chunks) => HashMap.fromIterable(Arr.map(chunks, (chunk) => [ChunkCacheKey.make(chunk.coord), chunk] as const)))
                )
          )
        )

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
          const hit = Arr.findFirst(NOTIFY_OFFSETS, (offset) => {
            const neighborPos = { x: position.x + offset.x, y: position.y + offset.y, z: position.z + offset.z }
            return Option.match(HashMap.get(state.cells, blockKey(neighborPos)), {
              onNone: () => false,
              onSome: (nc) => nc.type !== cell.type,
            })
          })
          return yield* Option.match(hit, {
            onNone: () => Effect.succeed(false),
            onSome: (offset) => Effect.gen(function* () {
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
              return yield* Option.match(solid, {
                /* c8 ignore next */
                onNone: () => Effect.succeed(false),
                onSome: (blockType) => Effect.gen(function* () {
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
                }),
              })
            }),
          })
        })

      const tryFlowDownward = (
        loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
        tickStateRef: Ref.Ref<FluidState>,
        position: Position,
        cell: FluidCell,
        nextLevel: number,
      ): Effect.Effect<boolean, never> => {
        const below = { x: position.x, y: position.y - 1, z: position.z }
        if (!isAirAt(loaded, below)) return Effect.succeed(false)
        const targetKey = blockKey(below)
        return Ref.modify(tickStateRef, (s) => {
          const existing = HashMap.get(s.cells, targetKey)
          /* c8 ignore next */
          if (Option.exists(existing, (e) => e.type === cell.type && e.level <= nextLevel)) return [false, s] as const
          const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
          const next = setCell(s, below, newCell)
          return [true, { ...next, frontier: HashSet.add(next.frontier, targetKey) }] as const
        }).pipe(
          Effect.flatMap((shouldWrite) =>
            /* c8 ignore next */
            shouldWrite ? writeFluid(loaded, below, { level: nextLevel, source: false, type: cell.type }) : Effect.void,
          ),
          Effect.as(true),
        )
      }

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
            const isOpposite = Option.match(otherIdx, {
              onNone: () => false,
              /* c8 ignore next */
              onSome: (b) => (cell.type === 'lava' ? b === WATER_INDEX : b === LAVA_INDEX),
            })
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
            const next = setCell(s, target, newCell)
            return [true, { ...next, frontier: HashSet.add(next.frontier, targetKey) }] as const
          })
          if (shouldWrite) yield* writeFluid(loaded, target, { level: nextLevel, source: false, type: cell.type })
        }), { concurrency: 1 })

      const processFluidCell = (
        loaded: HashMap.HashMap<ChunkCacheKey, Chunk>,
        tickStateRef: Ref.Ref<FluidState>,
        position: Position,
        cell: FluidCell,
      ): Effect.Effect<void, never> =>
        Option.match(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))), {
          /* c8 ignore next */
          onNone: () => Effect.void,
          onSome: (currentChunk) => Effect.gen(function* () {
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
          }),
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
          Effect.all([
            Ref.set(stateRef, Arr.reduce(chunks, INITIAL_STATE, hydrateChunk)),
            Ref.set(loadedCacheRef, HashMap.fromIterable(Arr.map(chunks, (chunk) => [ChunkCacheKey.make(chunk.coord), chunk] as const))),
          ], { concurrency: 'unbounded', discard: true }),

        tick: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const loaded = yield* Ref.get(loadedCacheRef)

            const state = yield* Ref.get(stateRef)
            const tickCounter = state.tickCounter + 1
            const lavaTickActive = tickCounter % LAVA_TICK_INTERVAL === 0

            const queued = Arr.fromIterable(state.frontier)
            if (queued.length === 0) {
              yield* Ref.update(stateRef, (s) => ({ ...s, tickCounter }))
              return
            }

            const workWithCells: ReadonlyArray<WorkItem> = Arr.filterMap(queued, (key) =>
              Option.map(HashMap.get(state.cells, key), (cell) => ({ key, cell }))
            )

            const { work, retainedLavaFrontier } = splitBudget(workWithCells, lavaTickActive, FLUID_TICK_BUDGET)
            const processedKeys = HashSet.fromIterable(Arr.map(work, (w) => w.key))
            const carry = Arr.filter(queued, (k) => !HashSet.has(processedKeys, k))

            const tickStateRef = yield* Ref.make<FluidState>({
              ...state,
              tickCounter,
              frontier: HashSet.fromIterable([...carry, ...retainedLavaFrontier]),
            })

            yield* Effect.forEach(work, ({ key, cell }) =>
              processFluidCell(loaded, tickStateRef, parseKey(key), cell),
            { concurrency: 1 })

            yield* Ref.set(stateRef, yield* Ref.get(tickStateRef))
          }),
      }
    })),
  }
) {}

export const FluidServiceLive = FluidService.Default
