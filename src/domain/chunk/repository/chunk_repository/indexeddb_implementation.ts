import { Clock, Effect, Layer, Match, Option, pipe } from 'effect'
import type { ChunkData } from '../../aggregate/chunk_data'
import type { ChunkId } from '../../value_object/chunk_id'
import type { ChunkPosition } from '../../value_object/chunk_position'
import { RepositoryErrors, type RepositoryError } from '../types'
import {
  ChunkRepository,
  type BatchOperationResult,
  type ChunkQuery,
  type ChunkRegion,
  type ChunkStatistics,
} from './index'

const DB_NAME = 'MinecraftChunkStorage'
const DB_VERSION = 1
const CHUNK_STORE = 'chunks'
const METADATA_STORE = 'metadata'

interface ChunkRecord {
  readonly id: string
  readonly chunkData: ChunkData
  readonly createdAt: number
  readonly modifiedAt: number
  readonly accessCount: number
  readonly lastAccessAt: number
  readonly size: number
}

interface MetadataRecord {
  readonly key: string
  readonly value: unknown
}

const positionKey = (position: ChunkPosition): string => `chunk_${position.x}_${position.z}`
const idKey = (id: ChunkId): string => `chunk_${id}`

const estimateChunkSize = (chunk: ChunkData): number => JSON.stringify(chunk).length

const openDatabase = (): Effect.Effect<IDBDatabase, RepositoryError> =>
  Effect.async((resume) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      resume(Effect.fail(RepositoryErrors.storage('openDatabase', 'Failed to open IndexedDB', request.error)))
    }

    request.onsuccess = () => {
      resume(Effect.succeed(request.result))
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      pipe(
        Match.value(db.objectStoreNames.contains(CHUNK_STORE)),
        Match.when(false, () => {
          const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' })
          chunkStore.createIndex('position', ['chunkData.position.x', 'chunkData.position.z'], { unique: true })
          chunkStore.createIndex('createdAt', 'createdAt')
          chunkStore.createIndex('modifiedAt', 'modifiedAt')
          chunkStore.createIndex('lastAccessAt', 'lastAccessAt')
        }),
        Match.orElse(() => {})
      )

      pipe(
        Match.value(db.objectStoreNames.contains(METADATA_STORE)),
        Match.when(false, () => {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' })
        }),
        Match.orElse(() => {})
      )
    }
  })

const transaction = <T>(
  db: IDBDatabase,
  stores: ReadonlyArray<string>,
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction) => Promise<T>
): Effect.Effect<T, RepositoryError> =>
  Effect.tryPromise({
    try: async () => {
      const tx = db.transaction(stores, mode)
      return await operation(tx)
    },
    catch: (error) => RepositoryErrors.storage('transaction', 'Transaction failed', error),
  })

const requestToPromise = <T>(executor: () => IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const request = executor()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const toRecord = (chunk: ChunkData) =>
  Effect.map(Clock.currentTimeMillis, (timestamp) => ({
    id: positionKey(chunk.position),
    chunkData: chunk,
    createdAt: timestamp,
    modifiedAt: timestamp,
    accessCount: 0,
    lastAccessAt: timestamp,
    size: estimateChunkSize(chunk),
  }))

const matchesQuery = (record: ChunkRecord, query: ChunkQuery): boolean => {
  const positionMatch = pipe(
    Option.fromNullable(query.positions),
    Option.match({
      onNone: () => true,
      onSome: (positions) =>
        positions.some((pos) => pos.x === record.chunkData.position.x && pos.z === record.chunkData.position.z),
    })
  )

  const regionMatch = pipe(
    Option.fromNullable(query.region),
    Option.match({
      onNone: () => true,
      onSome: (region) =>
        record.chunkData.position.x >= region.minX &&
        record.chunkData.position.x <= region.maxX &&
        record.chunkData.position.z >= region.minZ &&
        record.chunkData.position.z <= region.maxZ,
    })
  )

  const loadedAfterMatch = pipe(
    Option.fromNullable(query.loadedAfter),
    Option.match({
      onNone: () => true,
      onSome: (loadedAfter) => record.createdAt > loadedAfter,
    })
  )

  const modifiedAfterMatch = pipe(
    Option.fromNullable(query.modifiedAfter),
    Option.match({
      onNone: () => true,
      onSome: (modifiedAfter) => record.modifiedAt > modifiedAfter,
    })
  )

  return positionMatch && regionMatch && loadedAfterMatch && modifiedAfterMatch
}

const sliceWithLimit = <T>(items: ReadonlyArray<T>, offset: number, limit?: number): ReadonlyArray<T> =>
  pipe(
    Option.fromNullable(limit),
    Option.match({
      onNone: () => items,
      onSome: (value) => items.slice(offset, offset + value),
    })
  )

export const IndexedDBChunkRepositoryLive = Layer.effect(
  ChunkRepository,
  Effect.gen(function* () {
    const db = yield* openDatabase()

    const service = {
      findById: (id: ChunkId) =>
        Effect.flatMap(
          transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
            requestToPromise<ChunkRecord | undefined>(() => tx.objectStore(CHUNK_STORE).get(idKey(id)))
          ),
          (record) =>
            pipe(
              Option.fromNullable(record),
              Option.map((entry) => entry.chunkData)
            )
        ),

      findByPosition: (position: ChunkPosition) =>
        Effect.flatMap(
          transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
            requestToPromise<ReadonlyArray<ChunkRecord>>(() =>
              tx.objectStore(CHUNK_STORE).index('position').getAll([position.x, position.z])
            )
          ),
          (records) =>
            pipe(
              records[0],
              Option.fromNullable,
              Option.map((record) => record.chunkData)
            )
        ),

      findByRegion: (region: ChunkRegion) =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
          requestToPromise(() => tx.objectStore(CHUNK_STORE).getAll())
        ).pipe(
          Effect.map((records: ReadonlyArray<ChunkRecord>) =>
            records
              .filter(
                (record) =>
                  record.chunkData.position.x >= region.minX &&
                  record.chunkData.position.x <= region.maxX &&
                  record.chunkData.position.z >= region.minZ &&
                  record.chunkData.position.z <= region.maxZ
              )
              .map((record) => record.chunkData)
          )
        ),

      findByIds: (ids: ReadonlyArray<ChunkId>) =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
          Promise.all(ids.map((id) => requestToPromise(() => tx.objectStore(CHUNK_STORE).get(idKey(id)))))
        ).pipe(Effect.map((records) => records.flatMap((record) => (record ? [record.chunkData] : [])))),

      findByPositions: (positions: ReadonlyArray<ChunkPosition>) =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
          Promise.all(
            positions.map((position) =>
              requestToPromise(() => tx.objectStore(CHUNK_STORE).index('position').getAll([position.x, position.z]))
            )
          )
        ).pipe(Effect.map((records) => records.flatMap((record) => record?.map((entry) => entry.chunkData) ?? []))),

      save: (chunk: ChunkData) =>
        Effect.flatMap(toRecord(chunk), (record) =>
          transaction(db, [CHUNK_STORE], 'readwrite', (tx) =>
            requestToPromise(() => tx.objectStore(CHUNK_STORE).put(record))
          ).pipe(Effect.as(chunk))
        ),

      saveAll: (chunks: ReadonlyArray<ChunkData>) =>
        Effect.flatMap(Clock.currentTimeMillis, (timestamp) =>
          transaction(db, [CHUNK_STORE], 'readwrite', async (tx) => {
            const store = tx.objectStore(CHUNK_STORE)
            await Promise.all(
              chunks.map((chunk) =>
                requestToPromise(() =>
                  store.put({
                    id: positionKey(chunk.position),
                    chunkData: chunk,
                    createdAt: timestamp,
                    modifiedAt: timestamp,
                    accessCount: 0,
                    lastAccessAt: timestamp,
                    size: estimateChunkSize(chunk),
                  })
                )
              )
            )
            return chunks
          })
        ),

      delete: (id: ChunkId) =>
        transaction(db, [CHUNK_STORE], 'readwrite', (tx) =>
          requestToPromise(() => tx.objectStore(CHUNK_STORE).delete(idKey(id)))
        ).pipe(Effect.asVoid),

      deleteByPosition: (position: ChunkPosition) =>
        transaction(db, [CHUNK_STORE], 'readwrite', (tx) =>
          requestToPromise(() => tx.objectStore(CHUNK_STORE).delete(positionKey(position)))
        ).pipe(Effect.asVoid),

      deleteAll: (ids: ReadonlyArray<ChunkId>) =>
        transaction(db, [CHUNK_STORE], 'readwrite', async (tx) => {
          const store = tx.objectStore(CHUNK_STORE)
          await Promise.all(ids.map((id) => requestToPromise(() => store.delete(idKey(id)))))
        }).pipe(Effect.asVoid),

      exists: (id: ChunkId) =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
          requestToPromise(() => tx.objectStore(CHUNK_STORE).getKey(idKey(id)))
        ).pipe(Effect.map((key) => key !== undefined)),

      existsByPosition: (position: ChunkPosition) =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
          requestToPromise(() => tx.objectStore(CHUNK_STORE).getKey(positionKey(position)))
        ).pipe(Effect.map((key) => key !== undefined)),

      count: () =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) => requestToPromise(() => tx.objectStore(CHUNK_STORE).count())),

      countByRegion: (region: ChunkRegion) =>
        transaction(db, [CHUNK_STORE], 'readonly', async (tx) => {
          const records = await requestToPromise<ReadonlyArray<ChunkRecord>>(() => tx.objectStore(CHUNK_STORE).getAll())
          return records.filter(
            (record) =>
              record.chunkData.position.x >= region.minX &&
              record.chunkData.position.x <= region.maxX &&
              record.chunkData.position.z >= region.minZ &&
              record.chunkData.position.z <= region.maxZ
          ).length
        }),

      findByQuery: (query: ChunkQuery) =>
        transaction(db, [CHUNK_STORE], 'readonly', async (tx) => {
          const records = await requestToPromise<ReadonlyArray<ChunkRecord>>(() => tx.objectStore(CHUNK_STORE).getAll())
          const filtered = records.filter((record) => matchesQuery(record, query))
          const offset = query.offset ?? 0
          return sliceWithLimit(filtered, offset, query.limit).map((record) => record.chunkData)
        }),

      findRecentlyLoaded: (limit: number) =>
        transaction(db, [CHUNK_STORE], 'readonly', (tx) =>
          requestToPromise<ReadonlyArray<ChunkRecord>>(() =>
            tx.objectStore(CHUNK_STORE).index('createdAt').getAll(undefined, limit)
          )
        ).pipe(Effect.map((records) => records.map((record) => record.chunkData))),

      findModified: (since: number) =>
        transaction(db, [CHUNK_STORE], 'readonly', async (tx) => {
          const records = await requestToPromise<ReadonlyArray<ChunkRecord>>(() =>
            tx.objectStore(CHUNK_STORE).index('modifiedAt').getAll(IDBKeyRange.lowerBound(since))
          )
          return records.map((record) => record.chunkData)
        }),

      getStatistics: () =>
        transaction(db, [CHUNK_STORE], 'readonly', async (tx) => {
          const store = tx.objectStore(CHUNK_STORE)
          const records = await requestToPromise<ReadonlyArray<ChunkRecord>>(() => store.getAll())
          const memoryUsage = records.reduce((sum, record) => sum + record.size, 0)
          const loadedChunks = records.length
          const modifiedChunks = records.filter((record) => record.chunkData.isDirty).length

          return {
            totalChunks: records.length,
            loadedChunks,
            modifiedChunks,
            memoryUsage,
            averageLoadTime: 0,
            cacheHitRate: 0,
          } satisfies ChunkStatistics
        }),

      batchSave: (chunks) =>
        Effect.map(
          service.saveAll(chunks),
          (saved) =>
            ({
              successful: saved,
              failed: [] as ReadonlyArray<{ readonly item: ChunkData; readonly error: RepositoryError }>,
            }) satisfies BatchOperationResult<ChunkData>
        ),

      batchDelete: (ids) =>
        Effect.map(
          transaction(db, [CHUNK_STORE], 'readwrite', async (tx) => {
            const store = tx.objectStore(CHUNK_STORE)
            await Promise.all(ids.map((id) => requestToPromise(() => store.delete(idKey(id)))))
            return ids
          }),
          (deleted) =>
            ({
              successful: deleted,
              failed: [] as ReadonlyArray<{ readonly item: ChunkId; readonly error: RepositoryError }>,
            }) satisfies BatchOperationResult<ChunkId>
        ),

      initialize: () =>
        transaction(db, [CHUNK_STORE, METADATA_STORE], 'readwrite', async (tx) => {
          await requestToPromise(() => tx.objectStore(CHUNK_STORE).clear())
          await requestToPromise(() => tx.objectStore(METADATA_STORE).clear())
        }).pipe(Effect.asVoid),

      clear: () =>
        transaction(db, [CHUNK_STORE], 'readwrite', (tx) =>
          requestToPromise(() => tx.objectStore(CHUNK_STORE).clear())
        ).pipe(Effect.asVoid),

      validateIntegrity: () => Effect.succeed(true),
    }

    return service
  })
)
