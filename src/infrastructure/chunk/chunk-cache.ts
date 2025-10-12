/**
 * @fileoverview Chunk Cache Layer
 * ChunkデータをBounded LRUキャッシュとして管理し、ドメイン読み取りを高速化する。
 */

import type { ChunkData } from '@/domain/chunk'
import { getChunkHash, type ChunkHash, type ChunkPosition } from '@/domain/chunk'
import { Clock, Context, Effect, HashMap, HashSet, Layer, Match, Option, Ref, Schema } from 'effect'
import { pipe } from 'effect/Function'

const DEFAULT_MAX_ENTRIES = 512
const DEFAULT_PRELOAD_CONCURRENCY = 4

export const ChunkCacheConfigSchema = Schema.Struct({
  maxEntries: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  staleAfterMs: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
})

export type ChunkCacheConfig = Schema.Schema.Type<typeof ChunkCacheConfigSchema>

const defaultChunkCacheConfig = Schema.decodeSync(ChunkCacheConfigSchema)({
  maxEntries: DEFAULT_MAX_ENTRIES,
  staleAfterMs: undefined,
})

interface CacheEntry {
  readonly chunk: ChunkData
  readonly insertedAt: number
  readonly lastAccessed: number
}

interface ChunkCacheState {
  readonly entries: HashMap.HashMap<ChunkHash, CacheEntry>
  readonly dirty: HashSet.HashSet<ChunkHash>
  readonly hits: number
  readonly misses: number
  readonly evictions: number
}

const makeInitialState = (): ChunkCacheState => ({
  entries: HashMap.empty<ChunkHash, CacheEntry>(),
  dirty: HashSet.empty<ChunkHash>(),
  hits: 0,
  misses: 0,
  evictions: 0,
})

const ChunkCacheStatisticsSchema = Schema.Struct({
  size: Schema.Number,
  capacity: Schema.Number,
  hits: Schema.Number,
  misses: Schema.Number,
  evictions: Schema.Number,
  dirtyEntries: Schema.Number,
})

export type ChunkCacheStatistics = Schema.Schema.Type<typeof ChunkCacheStatisticsSchema>

const decodeStatistics = Schema.decodeUnknown(ChunkCacheStatisticsSchema)

const findLeastRecentlyUsed = (entries: HashMap.HashMap<ChunkHash, CacheEntry>) =>
  HashMap.reduce(entries, Option.none<readonly [ChunkHash, CacheEntry]>(), (accumulator, entry, key) =>
    Option.match(accumulator, {
      onNone: () => Option.some([key, entry] as const),
      onSome: ([candidateKey, candidateEntry]) =>
        entry.lastAccessed < candidateEntry.lastAccessed ? Option.some([key, entry] as const) : accumulator,
    })
  )

const createCacheEntry = (chunk: ChunkData, timestamp: number): CacheEntry => ({
  chunk,
  insertedAt: timestamp,
  lastAccessed: timestamp,
})

const refreshAccess = (entry: CacheEntry, timestamp: number): CacheEntry => ({
  ...entry,
  lastAccessed: timestamp,
})

export interface ChunkCacheService {
  readonly get: (position: ChunkPosition) => Effect.Effect<Option.Option<ChunkData>>
  readonly getOrLoad: (position: ChunkPosition, loader: Effect.Effect<ChunkData>) => Effect.Effect<ChunkData>
  readonly set: (chunk: ChunkData) => Effect.Effect<void>
  readonly invalidate: (position: ChunkPosition) => Effect.Effect<void>
  readonly markDirty: (position: ChunkPosition) => Effect.Effect<void>
  readonly flushDirty: Effect.Effect<ReadonlyArray<ChunkData>>
  readonly preload: (
    positions: ReadonlyArray<ChunkPosition>,
    loader: (position: ChunkPosition) => Effect.Effect<ChunkData>
  ) => Effect.Effect<void>
  readonly clear: Effect.Effect<void>
  readonly stats: Effect.Effect<ChunkCacheStatistics>
}

export const ChunkCacheServiceTag = Context.GenericTag<ChunkCacheService>(
  '@minecraft/infrastructure/chunk/ChunkCacheService'
)

export const ChunkCacheConfigTag = Context.GenericTag<ChunkCacheConfig>(
  '@minecraft/infrastructure/chunk/ChunkCacheConfig'
)

const normalizeConfig = (configOption: Option.Option<ChunkCacheConfig>): ChunkCacheConfig =>
  Option.match(configOption, {
    onNone: () => defaultChunkCacheConfig,
    onSome: (value) => value,
  })

const computeStatistics = (state: ChunkCacheState, config: ChunkCacheConfig) =>
  decodeStatistics({
    size: HashMap.size(state.entries),
    capacity: config.maxEntries,
    hits: state.hits,
    misses: state.misses,
    evictions: state.evictions,
    dirtyEntries: HashSet.size(state.dirty),
  })

const isEntryStale = (entry: CacheEntry, now: number, config: ChunkCacheConfig): boolean =>
  pipe(
    Option.fromNullable(config.staleAfterMs),
    Option.match({
      onNone: () => false,
      onSome: (limit) => now - entry.lastAccessed > limit,
    })
  )

export const ChunkCacheServiceLive = Layer.scoped(
  ChunkCacheServiceTag,
  Effect.gen(function* () {
    const configOption = yield* Effect.serviceOption(ChunkCacheConfigTag)
    const config = normalizeConfig(configOption)
    const maxEntries = config.maxEntries
    const stateRef = yield* Ref.make(makeInitialState())

    const get = (position: ChunkPosition) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const hash = getChunkHash(position)

        return yield* Ref.modify(stateRef, (state) => {
          const entryOption = HashMap.get(state.entries, hash)

          return Option.match(entryOption, {
            onNone: (): readonly [Option.Option<ChunkData>, ChunkCacheState] => [
              Option.none(),
              { ...state, misses: state.misses + 1 },
            ],
            onSome: (entry): readonly [Option.Option<ChunkData>, ChunkCacheState] =>
              Match.value(isEntryStale(entry, now, config)).pipe(
                Match.when(true, () => {
                  const updatedEntries = HashMap.remove(state.entries, hash)
                  const updatedDirty = HashSet.remove(state.dirty, hash)
                  return [
                    Option.none<ChunkData>(),
                    {
                      ...state,
                      entries: updatedEntries,
                      dirty: updatedDirty,
                      misses: state.misses + 1,
                    },
                  ] as const
                }),
                Match.orElse(() => {
                  const refreshed = refreshAccess(entry, now)
                  const updatedEntries = HashMap.set(state.entries, hash, refreshed)

                  return [
                    Option.some(entry.chunk),
                    { ...state, entries: updatedEntries, hits: state.hits + 1 },
                  ] as const
                }),
                Match.exhaustive
              ),
          })
        })
      })

    const set = (chunk: ChunkData) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis

        yield* Ref.update(stateRef, (state) => {
          const hash = getChunkHash(chunk.position)
          const entry = createCacheEntry(chunk, now)
          let entries = HashMap.set(state.entries, hash, entry)
          let dirty = chunk.isDirty ? HashSet.add(state.dirty, hash) : HashSet.remove(state.dirty, hash)
          let evictions = state.evictions

          const evictionResult = Match.value(HashMap.size(entries) > maxEntries).pipe(
            Match.when(true, () =>
              Option.match(findLeastRecentlyUsed(entries), {
                onNone: () => ({ entries, dirty, evictions }),
                onSome: ([oldestHash]) => ({
                  entries: HashMap.remove(entries, oldestHash),
                  dirty: HashSet.remove(dirty, oldestHash),
                  evictions: evictions + 1,
                }),
              })
            ),
            Match.orElse(() => ({ entries, dirty, evictions })),
            Match.exhaustive
          )

          return {
            ...state,
            entries: evictionResult.entries,
            dirty: evictionResult.dirty,
            evictions: evictionResult.evictions,
          }
        })
      })

    const getOrLoad = (position: ChunkPosition, loader: Effect.Effect<ChunkData>) =>
      Effect.gen(function* () {
        const cached = yield* get(position)

        return yield* Option.match(cached, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.gen(function* () {
              const chunk = yield* loader
              yield* set(chunk)
              return chunk
            }),
        })
      })

    const invalidate = (position: ChunkPosition) =>
      Ref.update(stateRef, (state) => {
        const hash = getChunkHash(position)
        return {
          ...state,
          entries: HashMap.remove(state.entries, hash),
          dirty: HashSet.remove(state.dirty, hash),
        }
      })

    const markDirty = (position: ChunkPosition) =>
      Ref.update(stateRef, (state) => {
        const hash = getChunkHash(position)
        const entryOption = HashMap.get(state.entries, hash)

        return Option.match(entryOption, {
          onNone: () => state,
          onSome: (entry) => ({
            ...state,
            entries: HashMap.set(state.entries, hash, { ...entry, chunk: { ...entry.chunk, isDirty: true } }),
            dirty: HashSet.add(state.dirty, hash),
          }),
        })
      })

    const flushDirty = Ref.modify(stateRef, (state) => {
      const hashes = HashSet.toValues(state.dirty)
      const chunks = hashes.flatMap((hash) =>
        pipe(
          HashMap.get(state.entries, hash),
          Option.match({
            onNone: () => [] as ChunkData[],
            onSome: (entry) => [entry.chunk],
          })
        )
      )

      return [chunks as ReadonlyArray<ChunkData>, { ...state, dirty: HashSet.empty<ChunkHash>() }]
    })

    const preload = (
      positions: ReadonlyArray<ChunkPosition>,
      loader: (position: ChunkPosition) => Effect.Effect<ChunkData>
    ) =>
      Effect.forEach(
        positions,
        (position) =>
          Effect.gen(function* () {
            const cached = yield* get(position)

            yield* Option.match(cached, {
              onSome: () => Effect.void,
              onNone: () =>
                Effect.gen(function* () {
                  const chunk = yield* loader(position)
                  yield* set(chunk)
                }),
            })
          }),
        { concurrency: DEFAULT_PRELOAD_CONCURRENCY }
      ).pipe(Effect.asVoid)

    const clear = Ref.set(stateRef, makeInitialState())

    const stats = Ref.get(stateRef).pipe(Effect.flatMap((state) => computeStatistics(state, config)))

    return ChunkCacheServiceTag.of({
      get,
      getOrLoad,
      set,
      invalidate,
      markDirty,
      flushDirty,
      preload,
      clear,
      stats,
    })
  })
)

export const provideChunkCacheConfig = (config: Partial<ChunkCacheConfig>) =>
  Layer.succeed(
    ChunkCacheConfigTag,
    Schema.decodeSync(ChunkCacheConfigSchema)({
      maxEntries: config.maxEntries ?? defaultChunkCacheConfig.maxEntries,
      staleAfterMs: config.staleAfterMs ?? defaultChunkCacheConfig.staleAfterMs,
    })
  )
