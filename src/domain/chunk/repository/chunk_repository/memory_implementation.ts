import { Clock, Effect, Layer, Option, Ref, pipe } from 'effect'
import type { ChunkData } from '../../aggregate/chunk_data'
import type { ChunkId } from '../../value_object/chunk_id'
import type { ChunkPosition } from '../../value_object/chunk_position'
import {
  ChunkRepository,
  type BatchOperationResult,
  type ChunkQuery,
  type ChunkRegion,
  type ChunkStatistics,
} from './interface'

interface ChunkEntry {
  readonly chunk: ChunkData
  readonly createdAt: number
  readonly modifiedAt: number
  readonly accessCount: number
  readonly lastAccessAt: number
}

interface RepositoryState {
  readonly chunks: ReadonlyMap<string, ChunkEntry>
  readonly totalOperations: number
  readonly cacheHits: number
  readonly cacheMisses: number
}

const positionKey = (position: ChunkPosition): string => `${position.x},${position.z}`
const idKey = (id: ChunkId): string => id

const entryWithChunk = (chunk: ChunkData, timestamp: number): ChunkEntry => ({
  chunk,
  createdAt: timestamp,
  modifiedAt: timestamp,
  accessCount: 0,
  lastAccessAt: timestamp,
})

const touchEntry = (entry: ChunkEntry, timestamp: number, update?: ChunkData): ChunkEntry => ({
  ...entry,
  chunk: update ?? entry.chunk,
  modifiedAt: update ? timestamp : entry.modifiedAt,
  accessCount: entry.accessCount + (update ? 0 : 1),
  lastAccessAt: timestamp,
})

const isWithinRegion = (position: ChunkPosition, region: ChunkRegion): boolean =>
  position.x >= region.minX && position.x <= region.maxX && position.z >= region.minZ && position.z <= region.maxZ

const matchesQuery = (entry: ChunkEntry, query: ChunkQuery): boolean => {
  const byPosition = pipe(
    Option.fromNullable(query.positions),
    Option.match({
      onNone: () => true,
      onSome: (positions) =>
        positions.some((pos) => pos.x === entry.chunk.position.x && pos.z === entry.chunk.position.z),
    })
  )

  const byRegion = pipe(
    Option.fromNullable(query.region),
    Option.match({
      onNone: () => true,
      onSome: (region) => isWithinRegion(entry.chunk.position, region),
    })
  )

  const byLoadedAfter = pipe(
    Option.fromNullable(query.loadedAfter),
    Option.match({
      onNone: () => true,
      onSome: (loadedAfter) => entry.createdAt > loadedAfter,
    })
  )

  const byModifiedAfter = pipe(
    Option.fromNullable(query.modifiedAfter),
    Option.match({
      onNone: () => true,
      onSome: (modifiedAfter) => entry.modifiedAt > modifiedAfter,
    })
  )

  return byPosition && byRegion && byLoadedAfter && byModifiedAfter
}

const emptyState: RepositoryState = {
  chunks: new Map(),
  totalOperations: 0,
  cacheHits: 0,
  cacheMisses: 0,
}

const updateStatistics = (state: RepositoryState, { hit }: { readonly hit: boolean }): RepositoryState => ({
  ...state,
  totalOperations: state.totalOperations + 1,
  cacheHits: state.cacheHits + (hit ? 1 : 0),
  cacheMisses: state.cacheMisses + (hit ? 0 : 1),
})

const mapSet = <K, V>(map: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> => new Map(map).set(key, value)

const mapDelete = <K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> => {
  const next = new Map(map)
  next.delete(key)
  return next
}

const collectChunks = (state: RepositoryState): ReadonlyArray<ChunkEntry> => Array.from(state.chunks.values())

const selectByQuery = (state: RepositoryState, query: ChunkQuery): ReadonlyArray<ChunkData> => {
  const filtered = collectChunks(state).filter((entry) => matchesQuery(entry, query))
  const offset = query.offset ?? 0
  const limited = pipe(
    Option.fromNullable(query.limit),
    Option.match({
      onNone: () => filtered,
      onSome: (limit) => filtered.slice(offset, offset + limit),
    })
  )
  return limited.map((entry) => entry.chunk)
}

const regionChunks = (state: RepositoryState, region: ChunkRegion): ReadonlyArray<ChunkData> =>
  collectChunks(state)
    .filter((entry) => isWithinRegion(entry.chunk.position, region))
    .map((entry) => entry.chunk)

const now = Clock.currentTimeMillis

export const InMemoryChunkRepositoryLive = Layer.effect(
  ChunkRepository,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(emptyState)

    const service = {
      findById: (id: ChunkId) =>
        Effect.gen(function* () {
          const key = idKey(id)
          const timestamp = yield* now
          const result = yield* Ref.updateAndGet(stateRef, (state) => {
            const entry = state.chunks.get(key)
            if (!entry) {
              return updateStatistics(state, { hit: false })
            }

            const updatedEntry = touchEntry(entry, timestamp)
            return {
              ...updateStatistics(state, { hit: true }),
              chunks: mapSet(state.chunks, key, updatedEntry),
            }
          })

          const entry = result.chunks.get(key)
          return entry ? Option.some(entry.chunk) : Option.none()
        }),

      findByPosition: (position: ChunkPosition) =>
        Effect.gen(function* () {
          const key = positionKey(position)
          const timestamp = yield* now
          const result = yield* Ref.updateAndGet(stateRef, (state) => {
            const entry = state.chunks.get(key)
            if (!entry) {
              return updateStatistics(state, { hit: false })
            }

            const updatedEntry = touchEntry(entry, timestamp)
            return {
              ...updateStatistics(state, { hit: true }),
              chunks: mapSet(state.chunks, key, updatedEntry),
            }
          })

          const entry = result.chunks.get(key)
          return entry ? Option.some(entry.chunk) : Option.none()
        }),

      findByRegion: (region: ChunkRegion) => Effect.map(Ref.get(stateRef), (state) => regionChunks(state, region)),

      findByIds: (ids: ReadonlyArray<ChunkId>) =>
        Effect.map(Ref.get(stateRef), (state) =>
          ids.flatMap((id) => {
            const entry = state.chunks.get(idKey(id))
            return entry ? [entry.chunk] : []
          })
        ),

      findByPositions: (positions: ReadonlyArray<ChunkPosition>) =>
        Effect.map(Ref.get(stateRef), (state) =>
          positions.flatMap((pos) => {
            const entry = state.chunks.get(positionKey(pos))
            return entry ? [entry.chunk] : []
          })
        ),

      save: (chunk: ChunkData) =>
        Effect.gen(function* () {
          const key = positionKey(chunk.position)
          const timestamp = yield* now
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            chunks: mapSet(state.chunks, key, entryWithChunk(chunk, timestamp)),
          }))
          return chunk
        }),

      saveAll: (chunks: ReadonlyArray<ChunkData>) =>
        Effect.gen(function* () {
          const timestamp = yield* now
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            chunks: chunks.reduce<ReadonlyMap<string, ChunkEntry>>(
              (acc, chunk) => mapSet(acc, positionKey(chunk.position), entryWithChunk(chunk, timestamp)),
              state.chunks
            ),
          }))
          return chunks
        }),

      delete: (id: ChunkId) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          chunks: mapDelete(state.chunks, idKey(id)),
        })),

      deleteByPosition: (position: ChunkPosition) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          chunks: mapDelete(state.chunks, positionKey(position)),
        })),

      deleteAll: (ids: ReadonlyArray<ChunkId>) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          chunks: ids.reduce<ReadonlyMap<string, ChunkEntry>>((acc, id) => mapDelete(acc, idKey(id)), state.chunks),
        })),

      exists: (id: ChunkId) => Effect.map(Ref.get(stateRef), (state) => state.chunks.has(idKey(id))),

      existsByPosition: (position: ChunkPosition) =>
        Effect.map(Ref.get(stateRef), (state) => state.chunks.has(positionKey(position))),

      count: () => Effect.map(Ref.get(stateRef), (state) => state.chunks.size),

      countByRegion: (region: ChunkRegion) =>
        Effect.map(Ref.get(stateRef), (state) => regionChunks(state, region).length),

      findByQuery: (query: ChunkQuery) => Effect.map(Ref.get(stateRef), (state) => selectByQuery(state, query)),

      findRecentlyLoaded: (limit: number) =>
        Effect.map(Ref.get(stateRef), (state) =>
          collectChunks(state)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit)
            .map((entry) => entry.chunk)
        ),

      findModified: (since: number) =>
        Effect.map(Ref.get(stateRef), (state) =>
          collectChunks(state)
            .filter((entry) => entry.modifiedAt > since)
            .map((entry) => entry.chunk)
        ),

      getStatistics: () =>
        Effect.map(Ref.get(stateRef), (state) => {
          const entries = collectChunks(state)
          const memoryUsage = entries.reduce((sum, entry) => sum + entry.chunk.blocks.byteLength, 0)
          const loadedChunks = entries.length
          const modifiedChunks = entries.filter((entry) => entry.chunk.isDirty).length
          const cacheHitRate = state.totalOperations === 0 ? 0 : state.cacheHits / state.totalOperations

          return {
            totalChunks: state.chunks.size,
            loadedChunks,
            modifiedChunks,
            memoryUsage,
            averageLoadTime:
              loadedChunks === 0
                ? 0
                : entries.reduce((sum, entry) => sum + (entry.lastAccessAt - entry.createdAt), 0) / loadedChunks,
            cacheHitRate,
          } satisfies ChunkStatistics
        }),

      batchSave: (chunks) =>
        Effect.gen(function* () {
          const timestamp = yield* now

          yield* Ref.update(stateRef, (state) => ({
            ...state,
            chunks: chunks.reduce<ReadonlyMap<string, ChunkEntry>>(
              (acc, chunk) => mapSet(acc, positionKey(chunk.position), entryWithChunk(chunk, timestamp)),
              state.chunks
            ),
          }))

          const result: BatchOperationResult<ChunkData> = {
            successful: [...chunks],
            failed: [],
          }

          return result
        }),

      batchDelete: (ids) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            chunks: ids.reduce<ReadonlyMap<string, ChunkEntry>>((acc, id) => mapDelete(acc, idKey(id)), state.chunks),
          }))

          return {
            successful: [...ids],
            failed: [],
          } satisfies BatchOperationResult<ChunkId>
        }),

      initialize: () => Ref.set(stateRef, emptyState),

      clear: () => Ref.update(stateRef, (state) => ({ ...state, chunks: new Map() })),

      validateIntegrity: () =>
        Effect.map(Ref.get(stateRef), (state) => state.chunks.size === new Map(state.chunks).size),
    }

    return service
  })
)
