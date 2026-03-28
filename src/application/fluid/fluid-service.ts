import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, blockTypeToIndex, setBlockInChunk, type Chunk, type ChunkCoord } from '@/domain/chunk'
import type { Position } from '@/shared/kernel'

const AIR_INDEX = blockTypeToIndex('AIR')
const WATER_INDEX = blockTypeToIndex('WATER')
const WATER_MAX_LEVEL = 7
const FLUID_TICK_BUDGET = 512

const FLOW_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
] as const

const NOTIFY_OFFSETS = [
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
] as const

type FluidKey = string

type FluidCell = Readonly<{
  readonly level: number
  readonly source: boolean
}>

type FluidState = Readonly<{
  readonly cells: HashMap.HashMap<FluidKey, FluidCell>
  readonly frontier: HashSet.HashSet<FluidKey>
  readonly hydratedChunks: HashSet.HashSet<string>
}>

const INITIAL_STATE: FluidState = {
  cells: HashMap.empty(),
  frontier: HashSet.empty(),
  hydratedChunks: HashSet.empty(),
}

const blockKey = (position: Position): FluidKey =>
  `${Math.floor(position.x)}:${Math.floor(position.y)}:${Math.floor(position.z)}`

const parseKey = (key: FluidKey): Position => {
  const parts = key.split(':')
  if (parts.length !== 3) {
    return { x: 0, y: 0, z: 0 }
  }

  const [xRaw, yRaw, zRaw] = parts.map(Number) as [number, number, number]
  const x = Number.isFinite(xRaw) ? xRaw : 0
  const y = Number.isFinite(yRaw) ? yRaw : 0
  const z = Number.isFinite(zRaw) ? zRaw : 0
  return { x, y, z }
}

const chunkKey = (coord: ChunkCoord): string => `${coord.x}:${coord.z}`

const floorMod = (value: number, modulo: number): number => ((value % modulo) + modulo) % modulo

const localX = (position: Position): number => floorMod(Math.floor(position.x), CHUNK_SIZE)
const localY = (position: Position): number => Math.floor(position.y)
const localZ = (position: Position): number => floorMod(Math.floor(position.z), CHUNK_SIZE)

const enqueue = (frontier: HashSet.HashSet<FluidKey>, position: Position): HashSet.HashSet<FluidKey> =>
  Arr.reduce(
    NOTIFY_OFFSETS,
    HashSet.add(frontier, blockKey(position)),
    (acc, offset) => HashSet.add(acc, blockKey({
      x: position.x + offset.x,
      y: position.y + offset.y,
      z: position.z + offset.z,
    }))
  )

const chunkCoordsForPosition = (position: Position): ChunkCoord => ({
  x: Math.floor(position.x / CHUNK_SIZE),
  z: Math.floor(position.z / CHUNK_SIZE),
})

const positionFromChunk = (chunk: Chunk, idx: number): Position => {
  const y = idx % CHUNK_HEIGHT
  const column = Math.floor(idx / CHUNK_HEIGHT)
  const z = column % CHUNK_SIZE
  const x = Math.floor(column / CHUNK_SIZE)
  return {
    x: chunk.coord.x * CHUNK_SIZE + x,
    y,
    z: chunk.coord.z * CHUNK_SIZE + z,
  }
}

const getBlockIndex = (position: Position): number => {
  const idxOpt = blockIndex(localX(position), localY(position), localZ(position))
  return Option.getOrElse(idxOpt, () => -1)
}

const setWaterBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* setBlockInChunk(chunk, localX(position), localY(position), localZ(position), 'WATER').pipe(
        Effect.catchAll(() => Effect.void),
      )
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
      yield* setBlockInChunk(chunk, localX(position), localY(position), localZ(position), 'AIR').pipe(
        Effect.catchAll(() => Effect.void),
      )
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

export class FluidService extends Effect.Service<FluidService>()(
  '@minecraft/application/FluidService',
  {
    effect: Effect.gen(function* () {
      const chunkManagerService = yield* ChunkManagerService
      const stateRef = yield* Ref.make<FluidState>(INITIAL_STATE)

      const setCell = (state: FluidState, position: Position, cell: FluidCell): FluidState => ({
        ...state,
        cells: HashMap.set(state.cells, blockKey(position), cell),
      })

      const removeCell = (state: FluidState, position: Position): FluidState => ({
        ...state,
        cells: HashMap.remove(state.cells, blockKey(position)),
      })

      const hydrateChunk = (state: FluidState, chunk: Chunk): FluidState => {
        const key = chunkKey(chunk.coord)
        if (HashSet.has(state.hydratedChunks, key)) {
          return state
        }

        let nextState = state
        for (let idx = 0; idx < chunk.blocks.length; idx += 1) {
          if (chunk.blocks[idx] !== WATER_INDEX) {
            continue
          }

          const position = positionFromChunk(chunk, idx)
          const fluidKey = blockKey(position)
          if (HashMap.has(nextState.cells, fluidKey)) {
            continue
          }

          nextState = setCell(nextState, position, { level: 0, source: true })
          nextState = {
            ...nextState,
            frontier: enqueue(nextState.frontier, position),
          }
        }

        return {
          ...nextState,
          hydratedChunks: HashSet.add(nextState.hydratedChunks, key),
        }
      }

      const isAirAt = (loaded: HashMap.HashMap<string, Chunk>, position: Position): boolean =>
        Option.match(HashMap.get(loaded, chunkKey(chunkCoordsForPosition(position))), {
          onNone: () => false,
          onSome: (chunk) => {
            const idx = getBlockIndex(position)
            return idx >= 0 && chunk.blocks[idx] === AIR_INDEX
          },
        })

      const writeWater = (loaded: HashMap.HashMap<string, Chunk>, position: Position): Effect.Effect<void, never> =>
        setWaterBlockIfLoaded(
          HashMap.get(loaded, chunkKey(chunkCoordsForPosition(position))),
          position,
          chunkManagerService,
        )

      const writeAir = (loaded: HashMap.HashMap<string, Chunk>, position: Position): Effect.Effect<void, never> =>
        setAirBlockIfLoaded(
          HashMap.get(loaded, chunkKey(chunkCoordsForPosition(position))),
          position,
          chunkManagerService,
        )

      return {
        notifyBlockChanged: (position: Position): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            frontier: enqueue(state.frontier, position),
          })),

        seedWater: (position: Position): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const normalized = {
              x: Math.floor(position.x),
              y: Math.floor(position.y),
              z: Math.floor(position.z),
            }

            const loaded = yield* chunkManagerService.getLoadedChunks().pipe(
              Effect.map((chunks) => HashMap.fromIterable(Arr.map(chunks, (chunk) => [chunkKey(chunk.coord), chunk] as const))),
            )

            yield* Ref.update(stateRef, (state) => ({
              ...setCell(state, normalized, { level: 0, source: true }),
              frontier: enqueue(state.frontier, normalized),
            }))

            yield* writeWater(loaded, normalized)
          }),

        removeWater: (position: Position): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const normalized = {
              x: Math.floor(position.x),
              y: Math.floor(position.y),
              z: Math.floor(position.z),
            }

            const loaded = yield* chunkManagerService.getLoadedChunks().pipe(
              Effect.map((chunks) => HashMap.fromIterable(Arr.map(chunks, (chunk) => [chunkKey(chunk.coord), chunk] as const))),
            )

            yield* Ref.update(stateRef, (state) => ({
              ...removeCell(state, normalized),
              frontier: enqueue(state.frontier, normalized),
            }))

            yield* writeAir(loaded, normalized)
          }),

        syncLoadedChunks: (chunks: ReadonlyArray<Chunk>): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => Arr.reduce(chunks, state, hydrateChunk)),

        tick: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const loadedChunks = yield* chunkManagerService.getLoadedChunks()
            const loaded = HashMap.fromIterable(Arr.map(loadedChunks, (chunk) => [chunkKey(chunk.coord), chunk] as const))

            const state = yield* Ref.get(stateRef)
            const queued = Arr.fromIterable(state.frontier)
            if (queued.length === 0) {
              return
            }

            const work = Arr.take(queued, FLUID_TICK_BUDGET)
            const carry = Arr.drop(queued, FLUID_TICK_BUDGET)

            let nextState: FluidState = {
              ...state,
              frontier: HashSet.fromIterable(carry),
            }

            const workWithCells = Arr.filterMap(work, (key) =>
              Option.map(HashMap.get(nextState.cells, key), (cell) => ({ key, cell }))
            )

            for (const { key, cell } of workWithCells) {
              const position = parseKey(key)
              yield* Option.match(HashMap.get(loaded, chunkKey(chunkCoordsForPosition(position))), {
                onNone: () => Effect.void,
                onSome: (currentChunk) => Effect.gen(function* () {
                  const idx = getBlockIndex(position)
                  if (idx < 0 || currentChunk.blocks[idx] !== WATER_INDEX) {
                    nextState = removeCell(nextState, position)
                    return
                  }

                  const nextLevel = cell.source ? 1 : Math.min(cell.level + 1, WATER_MAX_LEVEL)
                  if (!cell.source && cell.level >= WATER_MAX_LEVEL) return

                  const below = { x: position.x, y: position.y - 1, z: position.z }
                  if (isAirAt(loaded, below)) {
                    const targetKey = blockKey(below)
                    const existing = HashMap.get(nextState.cells, targetKey)
                    if (Option.match(existing, { onNone: () => true, onSome: (e) => e.level > nextLevel })) {
                      yield* writeWater(loaded, below)
                      nextState = setCell(nextState, below, { level: nextLevel, source: false })
                      nextState = { ...nextState, frontier: HashSet.add(nextState.frontier, targetKey) }
                    }
                    return
                  }

                  yield* Effect.forEach(FLOW_OFFSETS, (offset) => Effect.gen(function* () {
                    const target = {
                      x: position.x + offset.x,
                      y: position.y + offset.y,
                      z: position.z + offset.z,
                    }
                    if (!isAirAt(loaded, target)) return
                    const targetKey = blockKey(target)
                    const existing = HashMap.get(nextState.cells, targetKey)
                    if (Option.match(existing, { onNone: () => false, onSome: (e) => e.level <= nextLevel })) return
                    yield* writeWater(loaded, target)
                    nextState = setCell(nextState, target, { level: nextLevel, source: false })
                    nextState = { ...nextState, frontier: HashSet.add(nextState.frontier, targetKey) }
                  }), { concurrency: 1 })
                }),
              })
            }

            yield* Ref.set(stateRef, nextState)
          }),
      }
    }),
  }
) {}

export const FluidServiceLive = FluidService.Default
