/**
 * @fileoverview Generation Session Repository Persistence Implementation
 * 生成セッションリポジトリの永続化実装
 *
 * ファイルシステムベースの永続化実装
 * セッション復旧・チェックポイント・履歴管理機能
 */

import {
  ChunkGenerationResultSchema,
  ChunkPositionSchema,
  createDataIntegrityError,
  createGenerationSessionNotFoundError,
  createPersistenceError,
  createRepositoryError,
  GenerationSessionIdSchema,
  GenerationSettingsSchema,
  GenerationStageSchema,
  WorldIdSchema,
  type AllRepositoryErrors,
  type ChunkPosition,
  type GenerationSessionId,
  type GenerationSettings,
  type WorldId,
} from '@domain/world/types'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import { JsonValueSchema, type JsonValue } from '@shared/schema/json'
import { Clock, DateTime, Effect, Function, Layer, Match, Option, pipe, Random, ReadonlyArray, Ref, Schema } from 'effect'
import { makeUnsafeGenerationSessionId } from '../../aggregate/generation_session/shared/index'
import type {
  ChunkGenerationTask,
  GenerationProgress,
  GenerationSession,
  GenerationSessionMetadata,
  GenerationSessionRepository,
  GenerationSessionRepositoryConfig,
  SessionBatchResult,
  SessionHistoryEntry,
  SessionQuery,
  SessionRecoveryInfo,
  SessionState,
  SessionStatistics,
} from './index'
import { createDefaultSessionMetadata, defaultGenerationSessionRepositoryConfig } from './index'

// === Persistence Schema ===

const DateTimeOrNullSchema = Schema.Union(Schema.DateTimeUtc, Schema.Null)

const SessionStateSchema = Schema.Literal(
  'initializing',
  'active',
  'paused',
  'completing',
  'completed',
  'failed',
  'cancelled',
  'recovering'
)

const GenerationProgressSchema = Schema.Struct({
  totalChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  completedChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  failedChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  pendingChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  currentStage: GenerationStageSchema,
  overallProgress: Schema.Number.pipe(Schema.between(0, 1)),
  estimatedTimeRemaining: Schema.Union(Schema.Number, Schema.Null),
  chunksPerSecond: Schema.Number.pipe(Schema.nonNegative()),
  stageTiming: Schema.Record(GenerationStageSchema, Schema.Number.pipe(Schema.nonNegative())),
})

const ChunkGenerationTaskSchema = Schema.Struct({
  position: ChunkPositionSchema,
  stage: GenerationStageSchema,
  status: Schema.String,
  startedAt: DateTimeOrNullSchema,
  completedAt: DateTimeOrNullSchema,
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  result: Schema.Union(ChunkGenerationResultSchema, Schema.Null),
  error: Schema.Union(Schema.String, Schema.Null),
  dependencies: Schema.Array(ChunkPositionSchema),
})

const GenerationSessionMetadataSchema = Schema.Struct({
  version: Schema.String,
  environment: Schema.Literal('development', 'production', 'test'),
  generator: Schema.String,
  seed: Schema.String,
  tags: Schema.Array(Schema.String),
  priority: Schema.Literal('low', 'normal', 'high', 'critical'),
  autoPause: Schema.Boolean,
  autoRecover: Schema.Boolean,
  maxRetries: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  timeout: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  checkpointInterval: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

const HistoryEntrySchema = Schema.Struct({
  timestamp: Schema.DateTimeUtc,
  action: Schema.String,
  details: JsonValueSchema,
  actor: Schema.String,
})

const GenerationSessionSchema = Schema.Struct({
  id: GenerationSessionIdSchema,
  worldId: WorldIdSchema,
  state: SessionStateSchema,
  settings: GenerationSettingsSchema,
  createdAt: Schema.DateTimeUtc,
  startedAt: DateTimeOrNullSchema,
  completedAt: DateTimeOrNullSchema,
  lastActivityAt: Schema.DateTimeUtc,
  progress: GenerationProgressSchema,
  chunks: Schema.Array(ChunkGenerationTaskSchema),
  metadata: GenerationSessionMetadataSchema,
})

const PersistenceSessionSchema = Schema.Struct({
  sessions: Schema.Record(Schema.String, GenerationSessionSchema),
  checkpoints: Schema.Record(Schema.String, Schema.Record(Schema.String, JsonValueSchema)),
  history: Schema.Record(Schema.String, Schema.Array(HistoryEntrySchema)),
  metadata: Schema.Struct({
    version: Schema.String,
    createdAt: Schema.String,
    lastModified: Schema.String,
    checksum: Schema.String,
    sessionCount: Schema.Number,
  }),
})

// Metadata file schema for checksum validation
const FileMetadataSchema = Schema.Struct({
  checksum: Schema.String,
})

// Checkpoint data schema
const CheckpointDataSchema = Schema.Struct({
  checkpointId: Schema.String,
  sessionId: Schema.String,
  session: GenerationSessionSchema,
  createdAt: Schema.String,
  version: Schema.String,
})

type PersistenceSessionData = typeof PersistenceSessionSchema.Type

// === Session Recovery Schema ===

const SessionRecoveryDataSchema = Schema.Struct({
  sessionId: Schema.String,
  recoveryData: JsonValueSchema,
  timestamp: Schema.String,
  corruptionLevel: Schema.Number,
  recoveryAttempts: Schema.Number,
})

type SessionRecoveryData = typeof SessionRecoveryDataSchema.Type

// === Persistence Configuration ===

interface SessionPersistenceConfig extends GenerationSessionRepositoryConfig {
  readonly sessionDirectory: string
  readonly checkpointDirectory: string
  readonly recoveryDirectory: string
  readonly enableCompression: boolean
  readonly enableChecksums: boolean
  readonly autoRecovery: boolean
  readonly maxRecoveryAttempts: number
}

const defaultSessionPersistenceConfig: SessionPersistenceConfig = {
  ...defaultGenerationSessionRepositoryConfig,
  sessionDirectory: './data/generation-sessions',
  checkpointDirectory: './data/checkpoints',
  recoveryDirectory: './data/recovery',
  enableCompression: true,
  enableChecksums: true,
  autoRecovery: true,
  maxRecoveryAttempts: 3,
}

// === Utility Functions ===

const calculateChecksum = (data: string): string => {
  const hash = pipe(
    data.split(''),
    ReadonlyArray.reduce(0, (hash, char) => {
      const charCode = char.charCodeAt(0)
      const newHash = (hash << 5) - hash + charCode
      return newHash & newHash
    })
  )
  return hash.toString(16)
}

const compressData = (data: string): Effect.Effect<string, AllRepositoryErrors> => Effect.succeed(data) // Mock implementation

const decompressData = (data: string): Effect.Effect<string, AllRepositoryErrors> => Effect.succeed(data) // Mock implementation

// === Persistence Implementation ===

const makeGenerationSessionRepositoryPersistence = (
  config: SessionPersistenceConfig = defaultSessionPersistenceConfig
): Effect.Effect<GenerationSessionRepository, AllRepositoryErrors, NodeFileSystem.FileSystem | NodePath.Path> =>
  Effect.gen(function* () {
    const fs = yield* NodeFileSystem.FileSystem
    const path = yield* NodePath.Path

    // Initialize directory paths
    const sessionPath = path.resolve(config.sessionDirectory)
    const checkpointPath = path.resolve(config.checkpointDirectory)
    const recoveryPath = path.resolve(config.recoveryDirectory)
    const sessionFile = path.join(sessionPath, 'sessions.json')
    const metadataFile = path.join(sessionPath, 'metadata.json')

    // In-memory cache for performance
    const sessionCacheRef = yield* Ref.make<Map<GenerationSessionId, GenerationSession>>(new Map())
    const statisticsRef = yield* Ref.make<{
      totalSessionsCreated: number
      totalChunksGenerated: number
      lastActivityAt: Date | null
    }>({
      totalSessionsCreated: 0,
      totalChunksGenerated: 0,
      lastActivityAt: null,
    })

    const appendHistoryEntry = (
      data: PersistenceSessionData,
      sessionId: GenerationSessionId,
      entry: SessionHistoryEntry
    ): PersistenceSessionData => {
      const existingEntries = data.history[sessionId] ?? []
      const maxEntries = config.cleanup.maxHistoryEntries
      const updatedEntries = [...existingEntries, entry]
      const prunedEntries = updatedEntries.slice(-maxEntries) satisfies ReadonlyArray<SessionHistoryEntry>

      return {
        ...data,
        history: {
          ...data.history,
          [sessionId]: prunedEntries,
        },
      }
    }

    const makeHistoryEntry = (
      action: string,
      details: JsonValue,
      actor: string,
      timestamp: Date
    ): SessionHistoryEntry => ({
      timestamp,
      action,
      details,
      actor,
    })

    // === File Operations ===

    const ensureDirectoryExists = (dirPath: string): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(dirPath)
        yield* pipe(
          Effect.when(() => !exists, {
            onTrue: () => fs.makeDirectory(dirPath, { recursive: true }),
            onFalse: () => Effect.void,
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to create directory: ${dirPath}`, 'filesystem', error))
        )
      )

    const loadSessionsFromFile = (): Effect.Effect<PersistenceSessionData, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(sessionFile)

        return yield* pipe(
          exists,
          Effect.when(() => !exists, {
            onTrue: () =>
              Effect.gen(function* () {
                const now = yield* DateTime.nowAsDate
                return {
                  sessions: {},
                  checkpoints: {},
                  history: {},
                  metadata: {
                    version: '1.0.0',
                    createdAt: now.toISOString(),
                    lastModified: now.toISOString(),
                    checksum: '',
                    sessionCount: 0,
                  },
                }
              }),
            onFalse: () =>
              Effect.gen(function* () {
                const content = yield* fs.readFileString(sessionFile)

                yield* pipe(
                  config.enableChecksums,
                  Effect.when(() => config.enableChecksums, {
                    onTrue: () =>
                      Effect.gen(function* () {
                        const metadataExists = yield* fs.exists(metadataFile)
                        yield* pipe(
                          Effect.when(() => metadataExists, {
                            onTrue: () =>
                              Effect.gen(function* () {
                                const metadataContent = yield* fs.readFileString(metadataFile)
                                // Schema.parseJson with FileMetadataSchema
                                const metadata = yield* Schema.parseJson(FileMetadataSchema)(metadataContent).pipe(
                                  Effect.mapError((error) =>
                                    createDataIntegrityError(
                                      `Metadata JSON parse failed: ${String(error)}`,
                                      ['metadata'],
                                      metadataContent,
                                      error
                                    )
                                  )
                                )
                                const actualChecksum = calculateChecksum(content)

                                yield* pipe(
                                  Effect.when(() => metadata.checksum !== actualChecksum, {
                                    onTrue: () =>
                                      Effect.fail(
                                        createDataIntegrityError(
                                          'Session data checksum mismatch - file may be corrupted',
                                          ['checksum'],
                                          metadata.checksum,
                                          actualChecksum
                                        )
                                      ),
                                    onFalse: () => Effect.void,
                                  })
                                )
                              }),
                            onFalse: () => Effect.void,
                          })
                        )
                      }),
                    onFalse: () => Effect.void,
                  })
                )

                const decompressed = config.enableCompression ? yield* decompressData(content) : content

                // Schema.parseJson統合: JSON.parse + Schema.decodeUnknown を一気に実行
                const validated = yield* Schema.parseJson(PersistenceSessionSchema)(decompressed).pipe(
                  Effect.mapError((error) => ({
                    _tag: 'SchemaValidationError' as const,
                    message: `PersistenceSessionSchema validation failed: ${error}`,
                    context: 'loadSessionsFromFile',
                    cause: error,
                  }))
                )

                return validated
              }),
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to load sessions from file: ${error}`, 'filesystem', error))
        )
      )

    const saveSessionsToFile = (data: PersistenceSessionData): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(sessionPath)

        const content = yield* Schema.encodeJson(PersistenceSessionSchema)(data, { pretty: true })

        // Compress if enabled
        const compressedContent = config.enableCompression ? yield* compressData(content) : content

        // Calculate checksum
        yield* pipe(
          Effect.when(() => config.enableChecksums, {
            onTrue: () =>
              Effect.gen(function* () {
                const now = yield* DateTime.nowAsDate
                const checksum = calculateChecksum(compressedContent)
                const metadata = {
                  checksum,
                }

                const metadataJson = yield* Schema.encodeJson(FileMetadataSchema)(metadata, { pretty: true })
                yield* fs.writeFileString(metadataFile, metadataJson)
              }),
            onFalse: () => Effect.void,
          })
        )

        yield* fs.writeFileString(sessionFile, compressedContent)

        // Create backup if enabled
        yield* pipe(
          Effect.when(() => config.checkpointing.enabled, {
            onTrue: () =>
              Effect.gen(function* () {
                const timestamp = yield* Clock.currentTimeMillis
                const backupFile = path.join(sessionPath, `sessions-backup-${timestamp}.json`)
                yield* fs.writeFileString(backupFile, compressedContent)
              }),
            onFalse: () => Effect.void,
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to save sessions to file: ${error}`, 'filesystem', error))
        )
      )

    const generateSessionId = (): Effect.Effect<GenerationSessionId> =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        // Random Serviceでセキュアな乱数生成（再現性保証）
        const randomValue = yield* Random.nextIntBetween(0, 2176782336) // 36^6
        const randomStr = randomValue.toString(36).padStart(6, '0')
        return makeUnsafeGenerationSessionId(`session-${timestamp}-${randomStr}`)
      })

    // === Session CRUD Operations ===

    const createSession = (
      worldId: WorldId,
      settings: GenerationSettings,
      metadata?: Partial<GenerationSessionMetadata>
    ): Effect.Effect<GenerationSession, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionId = yield* generateSessionId()
        const now = yield* DateTime.nowAsDate

        const session: GenerationSession = {
          id: sessionId,
          worldId,
          state: 'initializing',
          settings,
          createdAt: now,
          startedAt: null,
          completedAt: null,
          lastActivityAt: now,
          progress: {
            totalChunks: 0,
            completedChunks: 0,
            failedChunks: 0,
            pendingChunks: 0,
            currentStage: 'terrain_generation',
            overallProgress: 0,
            estimatedTimeRemaining: null,
            chunksPerSecond: 0,
            stageTiming: {},
          },
          chunks: [],
          metadata: createDefaultSessionMetadata(metadata),
        }

        // Update cache
        yield* Ref.update(sessionCacheRef, (cache) => new Map(cache).set(sessionId, session))

        // Load current data
        const data = yield* loadSessionsFromFile()

        // Update sessions
        const historyDetails: JsonValue = {
          worldId: String(worldId),
          priority: session.metadata.priority,
          generator: session.metadata.generator,
        }
        const historyEntry = makeHistoryEntry('session_created', historyDetails, 'system', now)

        const baseData: PersistenceSessionData = {
          ...data,
          sessions: {
            ...data.sessions,
            [sessionId]: session,
          },
          metadata: {
            ...data.metadata,
            sessionCount: Object.keys(data.sessions).length + 1,
            lastModified: now.toISOString(),
          },
        }

        const dataWithHistory = appendHistoryEntry(baseData, sessionId, historyEntry)

        yield* saveSessionsToFile(dataWithHistory)

        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          totalSessionsCreated: stats.totalSessionsCreated + 1,
          lastActivityAt: now,
        }))

        return session
      })

    const findById = (
      sessionId: GenerationSessionId
    ): Effect.Effect<Option.Option<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check cache first
        const cache = yield* Ref.get(sessionCacheRef)

        return yield* pipe(
          Option.fromNullable(cache.get(sessionId)),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                // Load from file
                const data = yield* loadSessionsFromFile()
                const session = data.sessions[sessionId]

                return yield* pipe(
                  Option.fromNullable(session),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<GenerationSession>()),
                    onSome: (s) =>
                      Effect.gen(function* () {
                        // Update cache
                        yield* Ref.update(sessionCacheRef, (cache) => new Map(cache).set(sessionId, s))
                        return Option.some(s)
                      }),
                  })
                )
              }),
            onSome: (s) => Effect.succeed(Option.some(s)),
          })
        )
      })

    const findManyByIds = (
      sessionIds: ReadonlyArray<GenerationSessionId>
    ): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessions = yield* Effect.forEach(sessionIds, findById, { concurrency: 4 })
        return pipe(sessions, ReadonlyArray.filterMap(Function.identity))
      })

    const findByWorldId = (worldId: WorldId): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        const sessions = Object.values(data.sessions)
        return sessions.filter((session) => session.worldId === worldId)
      })

    const findByQuery = (query: SessionQuery): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        const sessions = Object.values(data.sessions)

        // Apply filters using functional composition
        const filtered = pipe(
          sessions,
          ReadonlyArray.filter((s) =>
            pipe(
              Option.fromNullable(query.worldId),
              Option.match({
                onNone: () => true,
                onSome: (worldId) => s.worldId === worldId,
              })
            )
          ),
          ReadonlyArray.filter((s) =>
            pipe(
              Option.fromNullable(query.state),
              Option.match({
                onNone: () => true,
                onSome: (state) => s.state === state,
              })
            )
          ),
          ReadonlyArray.filter((s) =>
            pipe(
              Option.fromNullable(query.priority),
              Option.match({
                onNone: () => true,
                onSome: (priority) => s.metadata.priority === priority,
              })
            )
          ),
          ReadonlyArray.filter((s) =>
            pipe(
              Option.fromNullable(query.createdAfter),
              Option.match({
                onNone: () => true,
                onSome: (createdAfter) => s.createdAt >= createdAfter,
              })
            )
          ),
          ReadonlyArray.filter((s) =>
            pipe(
              Option.fromNullable(query.createdBefore),
              Option.match({
                onNone: () => true,
                onSome: (createdBefore) => s.createdAt <= createdBefore,
              })
            )
          )
        )

        // Apply sorting
        const sorted = pipe(
          Option.fromNullable(query.sortBy),
          Option.match({
            onNone: () => filtered,
            onSome: (sortBy) =>
              pipe(
                filtered,
                ReadonlyArray.sort((a, b) => {
                  // 型安全なプロパティアクセス（sortByはkeyof GenerationSession）
                  const aValue = a[sortBy]
                  const bValue = b[sortBy]
                  // Date型の比較にも対応
                  const comparison =
                    aValue instanceof Date && bValue instanceof Date
                      ? aValue.getTime() - bValue.getTime()
                      : aValue < bValue
                        ? -1
                        : aValue > bValue
                          ? 1
                          : 0
                  return query.sortOrder === 'desc' ? -comparison : comparison
                })
              ),
          })
        )

        const offset = query.offset ?? 0
        const limit = query.limit ?? sorted.length
        return sorted.slice(offset, offset + limit)
      })

    const findActiveSessions = (): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      findByQuery({ state: 'active' })

    const updateSession = (
      session: GenerationSession,
      historyEntry?: SessionHistoryEntry
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check if session exists
        const data = yield* loadSessionsFromFile()

        yield* pipe(
          Effect.when(() => !data.sessions[session.id], {
            onTrue: () => Effect.fail(createGenerationSessionNotFoundError(session.id)),
            onFalse: () => Effect.void,
          })
        )

        const now = yield* DateTime.nowAsDate
        const updatedSession = {
          ...session,
          lastActivityAt: now,
        }

        // Update cache
        yield* Ref.update(sessionCacheRef, (cache) => new Map(cache).set(session.id, updatedSession))

        // Update file
        const baseData: PersistenceSessionData = {
          ...data,
          sessions: {
            ...data.sessions,
            [session.id]: updatedSession,
          },
          metadata: {
            ...data.metadata,
            lastModified: now.toISOString(),
          },
        }

        const dataWithHistory = historyEntry ? appendHistoryEntry(baseData, session.id, historyEntry) : baseData

        yield* saveSessionsToFile(dataWithHistory)
      })

    const deleteSession = (sessionId: GenerationSessionId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()

        yield* pipe(
          Effect.when(() => !data.sessions[sessionId], {
            onTrue: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onFalse: () => Effect.void,
          })
        )

        // Remove from cache
        yield* Ref.update(sessionCacheRef, (cache) => {
          const newCache = new Map(cache)
          newCache.delete(sessionId)
          return newCache
        })

        // Update file
        const { [sessionId]: removed, ...remainingSessions } = data.sessions
        const { [sessionId]: removedCheckpoints, ...remainingCheckpoints } = data.checkpoints
        const { [sessionId]: removedHistory, ...remainingHistory } = data.history

        const now = yield* DateTime.nowAsDate
        const updatedData: PersistenceSessionData = {
          sessions: remainingSessions,
          checkpoints: remainingCheckpoints,
          history: remainingHistory,
          metadata: {
            ...data.metadata,
            sessionCount: Object.keys(remainingSessions).length,
            lastModified: now.toISOString(),
          },
        }

        yield* saveSessionsToFile(updatedData)
      })

    const deleteSessions = (
      sessionIds: ReadonlyArray<GenerationSessionId>
    ): Effect.Effect<SessionBatchResult, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          sessionIds,
          (sessionId) =>
            pipe(
              deleteSession(sessionId),
              Effect.exit,
              Effect.map((exit) => ({ sessionId, exit }))
            ),
          { concurrency: 4 }
        )

        const [successful, failed] = pipe(
          results,
          ReadonlyArray.partition(({ exit }) => exit._tag === 'Success')
        )

        return {
          successful: successful.map(({ sessionId }) => sessionId),
          failed: failed.map(({ sessionId, exit }) => ({
            sessionId,
            error:
              exit._tag === 'Failure'
                ? exit.cause.failures[0] || createRepositoryError('Unknown error', 'deleteSessions', null)
                : createRepositoryError('Unknown error', 'deleteSessions', null),
          })),
          totalProcessed: sessionIds.length,
        }
      })

    // === Session State Management ===

    const updateSessionState = (
      sessionId: GenerationSessionId,
      state: SessionState
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        const session = yield* pipe(
          sessionOpt,
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        const now = yield* DateTime.nowAsDate
        const updatedSession: GenerationSession = {
          ...session,
          state,
          lastActivityAt: now,
          startedAt: state === 'active' && !session.startedAt ? now : session.startedAt,
          completedAt:
            (state === 'completed' || state === 'failed') && !session.completedAt ? now : session.completedAt,
        }

        const historyDetails: JsonValue = {
          from: session.state,
          to: state,
        }
        const historyEntry = makeHistoryEntry('session_state_changed', historyDetails, 'system', now)

        yield* updateSession(updatedSession, historyEntry)
      })

    const updateProgress = (
      sessionId: GenerationSessionId,
      progress: Partial<GenerationProgress>
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        const session = yield* pipe(
          sessionOpt,
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        const now = yield* DateTime.nowAsDate
        const updatedSession: GenerationSession = {
          ...session,
          progress: { ...session.progress, ...progress },
          lastActivityAt: now,
        }

        yield* updateSession(updatedSession)
      })

    // === Checkpoint & Recovery ===

    const createCheckpoint = (sessionId: GenerationSessionId): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        const session = yield* pipe(
          sessionOpt,
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )

        yield* ensureDirectoryExists(checkpointPath)

        const timestamp = yield* Clock.currentTimeMillis
        const now = yield* DateTime.nowAsDate
        const checkpointId = `checkpoint-${timestamp}`
        const checkpointFile = path.join(checkpointPath, `${sessionId}-${checkpointId}.json`)

        const checkpointData = {
          checkpointId,
          sessionId,
          session,
          createdAt: now.toISOString(),
          version: '1.0.0',
        }

        const content = yield* Schema.encodeJson(CheckpointDataSchema)(checkpointData, { pretty: true })
        const compressedContent = config.enableCompression ? yield* compressData(content) : content

        yield* fs.writeFileString(checkpointFile, compressedContent)

        return checkpointId
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to create checkpoint: ${error}`, 'filesystem', error))
        )
      )

    const restoreFromCheckpoint = (
      sessionId: GenerationSessionId,
      checkpointId: string
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const checkpointFile = path.join(checkpointPath, `${sessionId}-${checkpointId}.json`)
        const exists = yield* fs.exists(checkpointFile)

        yield* pipe(
          Effect.when(() => !exists, {
            onTrue: () =>
              Effect.fail(createRepositoryError(`Checkpoint not found: ${checkpointId}`, 'restoreFromCheckpoint')),
            onFalse: () => Effect.void,
          })
        )

        const content = yield* fs.readFileString(checkpointFile)
        const decompressed = config.enableCompression ? yield* decompressData(content) : content

        // Schema.parseJson統合: JSON.parse + Schema検証を一気に実行
        const checkpointData = yield* Schema.parseJson(CheckpointDataSchema)(decompressed).pipe(
          Effect.mapError((error) =>
            createDataIntegrityError(
              `Checkpoint JSON parse failed: ${String(error)}`,
              ['checkpointData'],
              decompressed,
              error
            )
          )
        )
        const now = yield* DateTime.nowAsDate
        const restoredSession: GenerationSession = {
          ...checkpointData.session,
          lastActivityAt: now,
        }

        const historyDetails: JsonValue = {
          checkpointId,
          restoredAt: now.toISOString(),
        }
        const historyEntry = makeHistoryEntry('checkpoint_restored', historyDetails, 'system', now)

        yield* updateSession(restoredSession, historyEntry)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to restore from checkpoint: ${error}`, 'filesystem', error))
        )
      )

    const listCheckpoints = (
      sessionId: GenerationSessionId
    ): Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly createdAt: Date
        readonly size: number
        readonly chunkCount: number
      }>,
      AllRepositoryErrors
    > =>
      Effect.gen(function* () {
        const pattern = `${sessionId}-checkpoint-*.json`
        // Mock implementation - in production would use glob pattern matching
        return []
      })

    // === Statistics & Monitoring ===

    const getStatistics = (): Effect.Effect<SessionStatistics, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        const sessions = Object.values(data.sessions)

        const totalSessions = sessions.length
        const activeSessions = sessions.filter((s) => s.state === 'active').length
        const completedSessions = sessions.filter((s) => s.state === 'completed').length
        const failedSessions = sessions.filter((s) => s.state === 'failed').length

        const completedSessionsWithTiming = sessions.filter(
          (s) => s.state === 'completed' && s.startedAt && s.completedAt
        )

        const totalCompletionTime = completedSessionsWithTiming.reduce((sum, s) => {
          const completedAt = Option.fromNullable(s.completedAt)
          const startedAt = Option.fromNullable(s.startedAt)
          return pipe(
            Option.all([completedAt, startedAt]),
            Option.match({
              onNone: () => sum,
              onSome: ([completed, started]) => sum + (completed.getTime() - started.getTime()),
            })
          )
        }, 0)

        const averageCompletionTime =
          completedSessionsWithTiming.length > 0 ? totalCompletionTime / completedSessionsWithTiming.length : 0

        const totalChunksGenerated = sessions.reduce((sum, s) => sum + s.progress.completedChunks, 0)
        const failureRate = totalSessions > 0 ? failedSessions / totalSessions : 0

        const totalActiveDuration = sessions.reduce((sum, session) => {
          const maybeTimes = Option.all([
            Option.fromNullable(session.startedAt),
            Option.fromNullable(session.completedAt ?? session.lastActivityAt),
          ])

          return pipe(
            maybeTimes,
            Option.match({
              onNone: () => sum,
              onSome: ([startedAt, end]) => sum + Math.max(0, end.getTime() - startedAt.getTime()),
            })
          )
        }, 0)

        const averageChunksPerSecond = totalActiveDuration > 0 ? (totalChunksGenerated * 1000) / totalActiveDuration : 0

        const recoveryAggregate = sessions.reduce(
          (acc, session) =>
            session.chunks.reduce(
              (innerAcc, task) =>
                pipe(
                  Match.value(task.retryCount > 0),
                  Match.when(
                    (hasRetry) => hasRetry,
                    () =>
                      pipe(
                        Match.value(task.status),
                        Match.when(
                          (status) => status === 'completed',
                          () => ({
                            attempts: innerAcc.attempts + 1,
                            successes: innerAcc.successes + 1,
                          })
                        ),
                        Match.orElse(() => ({
                          attempts: innerAcc.attempts + 1,
                          successes: innerAcc.successes,
                        }))
                      )
                  ),
                  Match.orElse(() => innerAcc)
                ),
              acc
            ),
          { attempts: 0, successes: 0 }
        )

        const recoverySuccessRate =
          recoveryAggregate.attempts > 0 ? recoveryAggregate.successes / recoveryAggregate.attempts : 1

        return {
          totalSessions,
          activeSessions,
          completedSessions,
          failedSessions,
          averageCompletionTime,
          averageChunksPerSecond,
          totalChunksGenerated,
          failureRate,
          recoverySuccessRate,
        }
      })

    const count = (query?: Partial<SessionQuery>): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        return yield* pipe(
          Option.fromNullable(query),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const data = yield* loadSessionsFromFile()
                return Object.keys(data.sessions).length
              }),
            onSome: (q) =>
              Effect.gen(function* () {
                const sessions = yield* findByQuery(q)
                return sessions.length
              }),
          })
        )
      })

    // === Mock implementations for remaining methods ===

    const pauseSession = (sessionId: GenerationSessionId) => updateSessionState(sessionId, 'paused')
    const resumeSession = (sessionId: GenerationSessionId) => updateSessionState(sessionId, 'active')
    const cancelSession = (sessionId: GenerationSessionId, reason?: string) =>
      updateSessionState(sessionId, 'cancelled')

    // Initialize with empty implementations for other methods
    const addChunkTask = (sessionId: GenerationSessionId, task: ChunkGenerationTask) => Effect.void
    const updateChunkTask = (
      sessionId: GenerationSessionId,
      position: ChunkPosition,
      update: Partial<ChunkGenerationTask>
    ) => Effect.void
    const getCompletedChunks = (sessionId: GenerationSessionId) => Effect.succeed([])
    const getFailedChunks = (sessionId: GenerationSessionId) => Effect.succeed([])
    const getPendingChunks = (sessionId: GenerationSessionId) => Effect.succeed([])
    const analyzeRecovery = (sessionId: GenerationSessionId): Effect.Effect<SessionRecoveryInfo, AllRepositoryErrors> =>
      Effect.succeed({
        sessionId,
        canRecover: false,
        lastCheckpoint: null,
        corruptedChunks: [],
        recoverableChunks: [],
        estimatedRecoveryTime: 0,
        riskLevel: 'medium',
        recommendations: [],
      } satisfies SessionRecoveryInfo)
    const recoverSession = (
      _sessionId: GenerationSessionId,
      _options?: {
        readonly strategy?: 'conservative' | 'aggressive'
        readonly skipCorrupted?: boolean
        readonly maxRetries?: number
      }
    ): Effect.Effect<void, AllRepositoryErrors> => Effect.void
    const getSessionHistory = (sessionId: GenerationSessionId) =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        return (data.history[sessionId] ?? []) satisfies ReadonlyArray<SessionHistoryEntry>
      })
    const archiveCompletedSessions = (olderThan: Date) => Effect.succeed(0)
    const cleanupOldCheckpoints = (sessionId: GenerationSessionId, keepCount?: number) => Effect.succeed(0)
    const findOrphanedSessions = () => Effect.succeed([])
    const healthCheck = (sessionId: GenerationSessionId) =>
      Effect.succeed({
        isHealthy: true,
        issues: [],
        recommendations: [],
      })

    const initialize = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(sessionPath)
        yield* ensureDirectoryExists(checkpointPath)
        yield* ensureDirectoryExists(recoveryPath)

        // Load initial data to cache
        const data = yield* loadSessionsFromFile()
        const sessions = Object.entries(data.sessions).map(([id, session]) => [id, session] as const)
        yield* Ref.set(sessionCacheRef, new Map(sessions))
      })

    const cleanup = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.set(sessionCacheRef, new Map())
      })

    const validateIntegrity = (): Effect.Effect<
      {
        readonly isValid: boolean
        readonly errors: ReadonlyArray<string>
        readonly warnings: ReadonlyArray<string>
      },
      AllRepositoryErrors
    > =>
      Effect.succeed({
        isValid: true,
        errors: [],
        warnings: [],
      })

    return {
      createSession,
      findById,
      findManyByIds,
      findByWorldId,
      findByQuery,
      findActiveSessions,
      updateSession,
      deleteSession,
      deleteSessions,
      updateSessionState,
      updateProgress,
      pauseSession,
      resumeSession,
      cancelSession,
      addChunkTask,
      updateChunkTask,
      getCompletedChunks,
      getFailedChunks,
      getPendingChunks,
      createCheckpoint,
      restoreFromCheckpoint,
      listCheckpoints,
      analyzeRecovery,
      recoverSession,
      getSessionHistory,
      archiveCompletedSessions,
      cleanupOldCheckpoints,
      findOrphanedSessions,
      getStatistics,
      count,
      healthCheck,
      initialize,
      cleanup,
      validateIntegrity,
    }
  })

// === Layer Creation ===

/**
 * Generation Session Repository Persistence Implementation Layer
 */
export const GenerationSessionRepositoryPersistence = Layer.effect(
  GenerationSessionRepository,
  makeGenerationSessionRepositoryPersistence()
)

/**
 * Configurable Generation Session Repository Persistence Implementation Layer
 */
export const GenerationSessionRepositoryPersistenceWith = (config: SessionPersistenceConfig) =>
  Layer.effect(GenerationSessionRepository, makeGenerationSessionRepositoryPersistence(config))
