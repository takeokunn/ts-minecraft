import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/chunk-manager'
import { setBlockInChunk, type Chunk } from '@ts-minecraft/domain'
import { createFluidBuffer, decodeFluidByte, encodeFluidCell, FLUID_BYTE_LENGTH, type FluidCell, type FluidType } from '@ts-minecraft/domain'
import { ChunkCacheKey, type Position } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/domain'
import {
  AIR_INDEX,
  FLUID_TICK_BUDGET,
  FLOW_OFFSETS,
  INITIAL_STATE,
  LAVA_INDEX,
  LAVA_TICK_INTERVAL,
  NOTIFY_OFFSETS,
  WATER_INDEX,
  type FluidKey,
  type FluidState,
} from '../domain/fluid-model'
import {
  blockIndexFor,
  blockKey,
  blockTypeFor,
  chunkCoordsForPosition,
  enqueue,
  getBlockIndex,
  localX,
  localY,
  localZ,
  maxLevelFor,
  parseKey,
  positionFromChunk,
} from '../domain/fluid-position-utils'

const ensureFluidBuffer = (chunk: Chunk): Effect.Effect<Uint8Array<ArrayBufferLike>> =>
  Option.match(
    Option.filter(chunk.fluid, (b) => b.byteLength === FLUID_BYTE_LENGTH),
    {
      onNone: () =>
        Effect.sync(() => {
          const fluid = createFluidBuffer()
          ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluid)
          return fluid
        }),
      onSome: Effect.succeed,
    }
  )

/**
 * Vanilla-style lava+water contact resolution.
 * Returns the block that should replace one of the cells, or null if no conversion applies.
 * - Flowing lava touching any water -> COBBLESTONE
 * - Lava source touching any water -> OBSIDIAN
 * - Two sources or two flowing of same type -> no reaction
 */
export const resolveContact = (lavaCell: FluidCell, waterCell: FluidCell): Option.Option<BlockType> => {
  if (lavaCell.type !== 'lava' || waterCell.type !== 'water') return Option.none()
  if (!lavaCell.source && waterCell.source) return Option.some('COBBLESTONE')
  if (!lavaCell.source) return Option.some('COBBLESTONE')
  return Option.some('OBSIDIAN')
}

const setFluidBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  cell: FluidCell,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), blockTypeFor(cell.type)))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      if (idx >= 0) {
        fluid[idx] = encodeFluidCell(cell)
      }
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

const setAirBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), 'AIR'))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      if (idx >= 0) {
        fluid[idx] = 0
      }
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

const setSolidBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  blockType: BlockType,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), blockType))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      if (idx >= 0) {
        fluid[idx] = 0
      }
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

type WorkItem = { key: FluidKey; cell: FluidCell }

const splitBudget = (
  workWithCells: ReadonlyArray<WorkItem>,
  lavaTickActive: boolean,
  budget: number,
): {
  work: ReadonlyArray<WorkItem>
  retainedLavaFrontier: ReadonlyArray<FluidKey>
} => {
  const waterWork = Arr.filter(workWithCells, ({ cell }) => cell.type === 'water')
  const lavaWork = lavaTickActive
    ? Arr.filter(workWithCells, ({ cell }) => cell.type === 'lava')
    : []
  const halfBudget = Math.floor(budget / 2)
  const waterSlice = Arr.take(waterWork, halfBudget)
  const lavaSlice = Arr.take(lavaWork, budget - waterSlice.length)
  const retainedLavaFrontier = lavaTickActive
    ? []
    : Arr.map(Arr.filter(workWithCells, ({ cell }) => cell.type === 'lava'), (w) => w.key)
  return {
    work: Arr.appendAll(waterSlice, lavaSlice),
    retainedLavaFrontier,
  }
}

export class FluidService extends Effect.Service<FluidService>()(
  '@minecraft/application/FluidService',
  {
    effect: Effect.all([
      ChunkManagerService,
      Ref.make<FluidState>(INITIAL_STATE),
      Ref.make<HashMap.HashMap<ChunkCacheKey, Chunk>>(HashMap.empty()),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([chunkManagerService, stateRef, loadedCacheRef]) => {

      const setCell = (state: FluidState, position: Position, cell: FluidCell): FluidState => ({
        ...state,
        cells: HashMap.set(state.cells, blockKey(position), cell),
      })

      const removeCell = (state: FluidState, position: Position): FluidState => ({
        ...state,
        cells: HashMap.remove(state.cells, blockKey(position)),
      })

      const hydrateChunk = (state: FluidState, chunk: Chunk): FluidState =>
        Option.match(
          Option.filter(
            chunk.fluid,
            (b) => b.byteLength === FLUID_BYTE_LENGTH && b.some((byte) => byte !== 0)
          ),
          {
            onNone: () =>
              chunk.blocks.reduce((acc: FluidState, blockIdx: number, idx: number): FluidState => {
                if (blockIdx !== WATER_INDEX && blockIdx !== LAVA_INDEX) return acc
                const position = positionFromChunk(chunk, idx)
                const type: FluidType = blockIdx === LAVA_INDEX ? 'lava' : 'water'
                const next = setCell(acc, position, { level: 0, source: true, type })
                return { ...next, frontier: enqueue(next.frontier, position) }
              }, state),
            onSome: (fluid) =>
              fluid.reduce((acc: FluidState, byte: number, idx: number): FluidState => {
                if (byte === 0) return acc
                return Option.match(decodeFluidByte(byte), {
                  onNone: () => acc,
                  onSome: (cell) => {
                    const position = positionFromChunk(chunk, idx)
                    const next = setCell(acc, position, cell)
                    return { ...next, frontier: enqueue(next.frontier, position) }
                  },
                })
              }, state),
          }
        )

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

      /**
       * Check neighbors for cross-fluid contact (lava<->water); convert to solid if detected.
       * Returns true if the current cell was consumed by the reaction.
       */
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
              const [lavaCell, lavaPos, waterCell, waterPos] = cell.type === 'lava'
                ? [cell, position, neighborCell, neighborPos] as const
                : [neighborCell, neighborPos, cell, position] as const
              const solid = resolveContact(lavaCell, waterCell)
              return yield* Option.match(solid, {
                onNone: () => Effect.succeed(false),
                onSome: (blockType) => Effect.gen(function* () {
                  // COBBLESTONE replaces the flowing lava, STONE replaces the water flow around a lava source.
                  const targetPos = blockType === 'COBBLESTONE' ? lavaPos : waterPos
                  yield* Ref.update(stateRefLocal, (s) => {
                    const withoutLava = removeCell(s, lavaPos)
                    const withoutWater = removeCell(withoutLava, waterPos)
                    return { ...withoutWater, frontier: enqueue(withoutWater.frontier, targetPos) }
                  })
                  yield* writeSolid(loaded, targetPos, blockType)
                  // If the current cell's own position was consumed, report true.
                  const consumed = (targetPos.x === position.x && targetPos.y === position.y && targetPos.z === position.z)
                    || (blockType === 'STONE' && cell.type === 'water')
                    || (blockType === 'COBBLESTONE' && cell.type === 'lava')
                  return consumed
                }),
              })
            }),
          })
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

            const workWithCells = Arr.filterMap(queued, (key) =>
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

            yield* Effect.forEach(work, ({ key, cell }) => {
              const position = parseKey(key)
              return Option.match(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))), {
                onNone: () => Effect.void,
                onSome: (currentChunk) => Effect.gen(function* () {
                  const idx = getBlockIndex(position)
                  if (idx < 0 || currentChunk.blocks[idx] !== blockIndexFor(cell.type)) {
                    yield* Ref.update(tickStateRef, (s) => removeCell(s, position))
                    return
                  }

                  // Check neighbor contact (lava<->water). If the current cell was consumed, stop.
                  const consumed = yield* resolveNeighborContact(loaded, tickStateRef, position, cell)
                  if (consumed) return

                  const maxLevel = maxLevelFor(cell.type)
                  const nextLevel = cell.source ? 1 : Math.min(cell.level + 1, maxLevel)
                  if (!cell.source && cell.level >= maxLevel) return

                  const below = { x: position.x, y: position.y - 1, z: position.z }
                  // Flow downward into AIR or into opposite-type fluid (contact handled below).
                  if (isAirAt(loaded, below)) {
                    const targetKey = blockKey(below)
                    const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
                      const existing = HashMap.get(s.cells, targetKey)
                      if (Option.exists(existing, (e) => e.type === cell.type && e.level <= nextLevel)) return [false, s] as const
                      const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
                      const next = setCell(s, below, newCell)
                      return [true, { ...next, frontier: HashSet.add(next.frontier, targetKey) }] as const
                    })
                    if (shouldWrite) yield* writeFluid(loaded, below, { level: nextLevel, source: false, type: cell.type })
                    return
                  }

                  yield* Effect.forEach(FLOW_OFFSETS, (offset) => Effect.gen(function* () {
                    const target = {
                      x: position.x + offset.x,
                      y: position.y + offset.y,
                      z: position.z + offset.z,
                    }
                    if (!isAirAt(loaded, target)) {
                      // Adjacent opposite-type fluid: contact resolution via shared helper.
                      const otherIdx = blockAt(loaded, target)
                      const isOpposite = Option.match(otherIdx, {
                        onNone: () => false,
                        onSome: (b) => (cell.type === 'lava' ? b === WATER_INDEX : b === LAVA_INDEX),
                      })
                      if (isOpposite) {
                        yield* resolveNeighborContact(loaded, tickStateRef, position, cell)
                        return
                      }
                      return
                    }
                    const targetKey = blockKey(target)
                    const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
                      const existing = HashMap.get(s.cells, targetKey)
                      if (Option.exists(existing, (e) => e.type === cell.type && e.level <= nextLevel)) return [false, s] as const
                      const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
                      const next = setCell(s, target, newCell)
                      return [true, { ...next, frontier: HashSet.add(next.frontier, targetKey) }] as const
                    })
                    if (shouldWrite) yield* writeFluid(loaded, target, { level: nextLevel, source: false, type: cell.type })
                  }), { concurrency: 1 })
                }),
              })
            }, { concurrency: 1 })

            yield* Ref.set(stateRef, yield* Ref.get(tickStateRef))
          }),
      }
    })),
  }
) {}

export const FluidServiceLive = FluidService.Default
