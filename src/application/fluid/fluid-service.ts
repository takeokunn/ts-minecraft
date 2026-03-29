import { Array as Arr, Brand, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, blockTypeToIndex, setBlockInChunk, type Chunk, type ChunkCoord } from '@/domain/chunk'
import { createFluidBuffer, decodeFluidByte, encodeFluidCell, FLUID_BYTE_LENGTH, type FluidCell } from '@/domain/fluid'
import { ChunkCacheKey, type Position } from '@/shared/kernel'

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

type FluidKey = number & Brand.Brand<'FluidKey'>
const FluidKey = Brand.nominal<FluidKey>()

type FluidState = Readonly<{
  readonly cells: HashMap.HashMap<FluidKey, FluidCell>
  readonly frontier: HashSet.HashSet<FluidKey>
}>

const INITIAL_STATE: FluidState = {
  cells: HashMap.empty(),
  frontier: HashSet.empty(),
}

const BIAS = 32768
const Y_STRIDE = 65536
const XZ_STRIDE = CHUNK_HEIGHT * Y_STRIDE

const blockKey = (position: Position): FluidKey =>
  FluidKey((Math.floor(position.x) + BIAS) * XZ_STRIDE + Math.floor(position.y) * Y_STRIDE + (Math.floor(position.z) + BIAS))

const parseKey = (key: FluidKey): Position => {
  const biasedX = Math.floor(key / XZ_STRIDE)
  const remainder = key - biasedX * XZ_STRIDE
  const y = Math.floor(remainder / Y_STRIDE)
  const biasedZ = remainder - y * Y_STRIDE
  return {
    x: biasedX - BIAS,
    y,
    z: biasedZ - BIAS,
  }
}

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
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), 'WATER'))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      if (idx >= 0) {
        fluid[idx] = encodeFluidCell({ level: 0, source: true })
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
                if (blockIdx !== WATER_INDEX) return acc
                const position = positionFromChunk(chunk, idx)
                const next = setCell(acc, position, { level: 0, source: true })
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

      const writeWater = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position): Effect.Effect<void, never> =>
        setWaterBlockIfLoaded(
          HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
          position,
          chunkManagerService,
        )

      const writeAir = (loaded: HashMap.HashMap<ChunkCacheKey, Chunk>, position: Position): Effect.Effect<void, never> =>
        setAirBlockIfLoaded(
          HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))),
          position,
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

            const loaded = yield* getLoaded

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

            const loaded = yield* getLoaded

            yield* Ref.update(stateRef, (state) => ({
              ...removeCell(state, normalized),
              frontier: enqueue(state.frontier, normalized),
            }))

            yield* writeAir(loaded, normalized)
          }),

        syncLoadedChunks: (chunks: ReadonlyArray<Chunk>): Effect.Effect<void, never> =>
          Effect.all([
            Ref.set(stateRef, Arr.reduce(chunks, INITIAL_STATE, hydrateChunk)),
            Ref.set(loadedCacheRef, HashMap.fromIterable(Arr.map(chunks, (chunk) => [ChunkCacheKey.make(chunk.coord), chunk] as const))),
          ], { concurrency: 'unbounded', discard: true }),

        tick: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const loaded = yield* Ref.get(loadedCacheRef)

            const state = yield* Ref.get(stateRef)
            const queued = Arr.fromIterable(state.frontier)
            if (queued.length === 0) {
              return
            }

            const work = Arr.take(queued, FLUID_TICK_BUDGET)
            const carry = Arr.drop(queued, FLUID_TICK_BUDGET)

            const tickStateRef = yield* Ref.make<FluidState>({
              ...state,
              frontier: HashSet.fromIterable(carry),
            })

            const workWithCells = Arr.filterMap(work, (key) =>
              Option.map(HashMap.get(state.cells, key), (cell) => ({ key, cell }))
            )

            yield* Effect.forEach(workWithCells, ({ key, cell }) => {
              const position = parseKey(key)
              return Option.match(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))), {
                onNone: () => Effect.void,
                onSome: (currentChunk) => Effect.gen(function* () {
                  const idx = getBlockIndex(position)
                  if (idx < 0 || currentChunk.blocks[idx] !== WATER_INDEX) {
                    yield* Ref.update(tickStateRef, (s) => removeCell(s, position))
                    return
                  }

                  const nextLevel = cell.source ? 1 : Math.min(cell.level + 1, WATER_MAX_LEVEL)
                  if (!cell.source && cell.level >= WATER_MAX_LEVEL) return

                  const below = { x: position.x, y: position.y - 1, z: position.z }
                  if (isAirAt(loaded, below)) {
                    const targetKey = blockKey(below)
                    const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
                      const existing = HashMap.get(s.cells, targetKey)
                      if (Option.exists(existing, (e) => e.level <= nextLevel)) return [false, s] as const
                      const next = setCell(s, below, { level: nextLevel, source: false })
                      return [true, { ...next, frontier: HashSet.add(next.frontier, targetKey) }] as const
                    })
                    if (shouldWrite) yield* writeWater(loaded, below)
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
                    const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
                      const existing = HashMap.get(s.cells, targetKey)
                      if (Option.exists(existing, (e) => e.level <= nextLevel)) return [false, s] as const
                      const next = setCell(s, target, { level: nextLevel, source: false })
                      return [true, { ...next, frontier: HashSet.add(next.frontier, targetKey) }] as const
                    })
                    if (shouldWrite) yield* writeWater(loaded, target)
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
