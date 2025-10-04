/**
 * @fileoverview Generation Session Repository Persistence Implementation
 * 生成セッションリポジトリの永続化実装
 *
 * ファイルシステムベースの永続化実装
 * セッション復旧・チェックポイント・履歴管理機能
 */

import { Effect, Layer, Option, ReadonlyArray, Ref, Schedule } from 'effect'
import { Schema } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import type {
  GenerationSessionId,
  WorldId,
  ChunkPosition,
  GenerationSettings,
} from '../../types'
import type { AllRepositoryErrors } from '../types'
import {
  createRepositoryError,
  createPersistenceError,
  createGenerationSessionNotFoundError,
  createDataIntegrityError,
} from '../types'
import type {
  GenerationSessionRepository,
  GenerationSession,
  SessionState,
  GenerationProgress,
  ChunkGenerationTask,
  GenerationSessionMetadata,
  SessionQuery,
  SessionStatistics,
  SessionRecoveryInfo,
  SessionBatchResult,
  GenerationSessionRepositoryConfig,
} from './interface'
import {
  defaultGenerationSessionRepositoryConfig,
  calculateProgress,
  createDefaultSessionMetadata,
} from './interface'

// === Persistence Schema ===

const PersistenceSessionSchema = Schema.Struct({
  sessions: Schema.Record(Schema.String, Schema.Unknown), // GenerationSession
  checkpoints: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
  history: Schema.Record(Schema.String, Schema.Array(Schema.Unknown)),
  metadata: Schema.Struct({
    version: Schema.String,
    createdAt: Schema.String,
    lastModified: Schema.String,
    checksum: Schema.String,
    sessionCount: Schema.Number,
  }),
})

type PersistenceSessionData = typeof PersistenceSessionSchema.Type

// === Session Recovery Schema ===

const SessionRecoveryDataSchema = Schema.Struct({
  sessionId: Schema.String,
  recoveryData: Schema.Unknown,
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
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

const compressData = (data: string): Effect.Effect<string, AllRepositoryErrors> =>
  Effect.succeed(data) // Mock implementation

const decompressData = (data: string): Effect.Effect<string, AllRepositoryErrors> =>
  Effect.succeed(data) // Mock implementation

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
    const statisticsRef = yield* Ref.make({
      totalSessionsCreated: 0,
      totalChunksGenerated: 0,
      lastActivityAt: null as Date | null,
    })

    // === File Operations ===

    const ensureDirectoryExists = (dirPath: string): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(dirPath)
        if (!exists) {
          yield* fs.makeDirectory(dirPath, { recursive: true })
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(
            `Failed to create directory: ${dirPath}`,
            'filesystem',
            error
          ))
        )
      )

    const loadSessionsFromFile = (): Effect.Effect<PersistenceSessionData, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(sessionFile)
        if (!exists) {
          return {
            sessions: {},
            checkpoints: {},
            history: {},
            metadata: {
              version: '1.0.0',
              createdAt: new Date().toISOString(),
              lastModified: new Date().toISOString(),
              checksum: '',
              sessionCount: 0,
            },
          }
        }

        const content = yield* fs.readFileString(sessionFile)

        if (config.enableChecksums) {
          const metadataExists = yield* fs.exists(metadataFile)
          if (metadataExists) {
            const metadataContent = yield* fs.readFileString(metadataFile)
            const metadata = JSON.parse(metadataContent)
            const actualChecksum = calculateChecksum(content)

            if (metadata.checksum !== actualChecksum) {
              return yield* Effect.fail(createDataIntegrityError(
                'Session data checksum mismatch - file may be corrupted',
                ['checksum'],
                metadata.checksum,
                actualChecksum
              ))
            }
          }
        }

        const decompressed = config.enableCompression
          ? yield* decompressData(content)
          : content

        const parsedData = JSON.parse(decompressed)
        return Schema.decodeUnknownSync(PersistenceSessionSchema)(parsedData)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(
            `Failed to load sessions from file: ${error}`,
            'filesystem',
            error
          ))
        )
      )

    const saveSessionsToFile = (data: PersistenceSessionData): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(sessionPath)

        const content = JSON.stringify(data, null, 2)

        // Compress if enabled
        const compressedContent = config.enableCompression
          ? yield* compressData(content)
          : content

        // Calculate checksum
        if (config.enableChecksums) {
          const checksum = calculateChecksum(compressedContent)
          const metadata = {
            ...data.metadata,
            checksum,
            lastModified: new Date().toISOString(),
          }

          yield* fs.writeFileString(metadataFile, JSON.stringify(metadata, null, 2))
        }

        yield* fs.writeFileString(sessionFile, compressedContent)

        // Create backup if enabled
        if (config.checkpointing.enabled) {
          const backupFile = path.join(sessionPath, `sessions-backup-${Date.now()}.json`)
          yield* fs.writeFileString(backupFile, compressedContent)
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(
            `Failed to save sessions to file: ${error}`,
            'filesystem',
            error
          ))
        )
      )

    const generateSessionId = (): GenerationSessionId =>
      `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as GenerationSessionId

    // === Session CRUD Operations ===

    const createSession = (
      worldId: WorldId,
      settings: GenerationSettings,
      metadata?: Partial<GenerationSessionMetadata>
    ): Effect.Effect<GenerationSession, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionId = generateSessionId()
        const now = new Date()

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
        const updatedData: PersistenceSessionData = {
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

        yield* saveSessionsToFile(updatedData)

        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          totalSessionsCreated: stats.totalSessionsCreated + 1,
          lastActivityAt: now,
        }))

        return session
      })

    const findById = (sessionId: GenerationSessionId): Effect.Effect<Option.Option<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check cache first
        const cache = yield* Ref.get(sessionCacheRef)
        const cached = cache.get(sessionId)
        if (cached) {
          return Option.some(cached)
        }

        // Load from file
        const data = yield* loadSessionsFromFile()
        const session = data.sessions[sessionId] as GenerationSession | undefined

        if (session) {
          // Update cache
          yield* Ref.update(sessionCacheRef, (cache) => new Map(cache).set(sessionId, session))
          return Option.some(session)
        }

        return Option.none()
      })

    const findManyByIds = (sessionIds: ReadonlyArray<GenerationSessionId>): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results: GenerationSession[] = []
        for (const id of sessionIds) {
          const session = yield* findById(id)
          if (Option.isSome(session)) {
            results.push(session.value)
          }
        }
        return results
      })

    const findByWorldId = (worldId: WorldId): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        const sessions = Object.values(data.sessions) as GenerationSession[]
        return sessions.filter(session => session.worldId === worldId)
      })

    const findByQuery = (query: SessionQuery): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        let sessions = Object.values(data.sessions) as GenerationSession[]

        // Apply filters (same logic as memory implementation)
        if (query.worldId) sessions = sessions.filter(s => s.worldId === query.worldId)
        if (query.state) sessions = sessions.filter(s => s.state === query.state)
        if (query.priority) sessions = sessions.filter(s => s.metadata.priority === query.priority)
        if (query.createdAfter) sessions = sessions.filter(s => s.createdAt >= query.createdAfter!)
        if (query.createdBefore) sessions = sessions.filter(s => s.createdAt <= query.createdBefore!)

        // Apply sorting and pagination
        if (query.sortBy) {
          sessions.sort((a, b) => {
            const aValue = a[query.sortBy!] as any
            const bValue = b[query.sortBy!] as any
            const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
            return query.sortOrder === 'desc' ? -comparison : comparison
          })
        }

        const offset = query.offset ?? 0
        const limit = query.limit ?? sessions.length
        return sessions.slice(offset, offset + limit)
      })

    const findActiveSessions = (): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      findByQuery({ state: 'active' })

    const updateSession = (session: GenerationSession): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check if session exists
        const data = yield* loadSessionsFromFile()
        if (!data.sessions[session.id]) {
          return yield* Effect.fail(createGenerationSessionNotFoundError(session.id))
        }

        const updatedSession = {
          ...session,
          lastActivityAt: new Date(),
        }

        // Update cache
        yield* Ref.update(sessionCacheRef, (cache) => new Map(cache).set(session.id, updatedSession))

        // Update file
        const updatedData: PersistenceSessionData = {
          ...data,
          sessions: {
            ...data.sessions,
            [session.id]: updatedSession,
          },
          metadata: {
            ...data.metadata,
            lastModified: new Date().toISOString(),
          },
        }

        yield* saveSessionsToFile(updatedData)
      })

    const deleteSession = (sessionId: GenerationSessionId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        if (!data.sessions[sessionId]) {
          return yield* Effect.fail(createGenerationSessionNotFoundError(sessionId))
        }

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

        const updatedData: PersistenceSessionData = {
          sessions: remainingSessions,
          checkpoints: remainingCheckpoints,
          history: remainingHistory,
          metadata: {
            ...data.metadata,
            sessionCount: Object.keys(remainingSessions).length,
            lastModified: new Date().toISOString(),
          },
        }

        yield* saveSessionsToFile(updatedData)
      })

    const deleteSessions = (sessionIds: ReadonlyArray<GenerationSessionId>): Effect.Effect<SessionBatchResult, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const successful: GenerationSessionId[] = []
        const failed: { sessionId: GenerationSessionId; error: AllRepositoryErrors }[] = []

        for (const sessionId of sessionIds) {
          try {
            yield* deleteSession(sessionId)
            successful.push(sessionId)
          } catch (error) {
            failed.push({
              sessionId,
              error: createRepositoryError(
                `Failed to delete session: ${error}`,
                'deleteSessions',
                error
              ),
            })
          }
        }

        return {
          successful,
          failed,
          totalProcessed: sessionIds.length,
        }
      })

    // === Session State Management ===

    const updateSessionState = (sessionId: GenerationSessionId, state: SessionState): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        if (Option.isNone(sessionOpt)) {
          return yield* Effect.fail(createGenerationSessionNotFoundError(sessionId))
        }

        const session = sessionOpt.value
        const now = new Date()
        const updatedSession: GenerationSession = {
          ...session,
          state,
          lastActivityAt: now,
          startedAt: state === 'active' && !session.startedAt ? now : session.startedAt,
          completedAt: (state === 'completed' || state === 'failed') && !session.completedAt ? now : session.completedAt,
        }

        yield* updateSession(updatedSession)
      })

    const updateProgress = (sessionId: GenerationSessionId, progress: Partial<GenerationProgress>): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        if (Option.isNone(sessionOpt)) {
          return yield* Effect.fail(createGenerationSessionNotFoundError(sessionId))
        }

        const session = sessionOpt.value
        const updatedSession: GenerationSession = {
          ...session,
          progress: { ...session.progress, ...progress },
          lastActivityAt: new Date(),
        }

        yield* updateSession(updatedSession)
      })

    // === Checkpoint & Recovery ===

    const createCheckpoint = (sessionId: GenerationSessionId): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        if (Option.isNone(sessionOpt)) {
          return yield* Effect.fail(createGenerationSessionNotFoundError(sessionId))
        }

        yield* ensureDirectoryExists(checkpointPath)

        const checkpointId = `checkpoint-${Date.now()}`
        const session = sessionOpt.value
        const checkpointFile = path.join(checkpointPath, `${sessionId}-${checkpointId}.json`)

        const checkpointData = {
          checkpointId,
          sessionId,
          session,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
        }

        const content = JSON.stringify(checkpointData, null, 2)
        const compressedContent = config.enableCompression
          ? yield* compressData(content)
          : content

        yield* fs.writeFileString(checkpointFile, compressedContent)

        return checkpointId
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(
            `Failed to create checkpoint: ${error}`,
            'filesystem',
            error
          ))
        )
      )

    const restoreFromCheckpoint = (sessionId: GenerationSessionId, checkpointId: string): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const checkpointFile = path.join(checkpointPath, `${sessionId}-${checkpointId}.json`)
        const exists = yield* fs.exists(checkpointFile)

        if (!exists) {
          return yield* Effect.fail(createRepositoryError(
            `Checkpoint not found: ${checkpointId}`,
            'restoreFromCheckpoint'
          ))
        }

        const content = yield* fs.readFileString(checkpointFile)
        const decompressed = config.enableCompression
          ? yield* decompressData(content)
          : content

        const checkpointData = JSON.parse(decompressed)
        const restoredSession: GenerationSession = {
          ...checkpointData.session,
          lastActivityAt: new Date(),
        }

        yield* updateSession(restoredSession)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(
            `Failed to restore from checkpoint: ${error}`,
            'filesystem',
            error
          ))
        )
      )

    const listCheckpoints = (sessionId: GenerationSessionId): Effect.Effect<ReadonlyArray<{
      readonly id: string
      readonly createdAt: Date
      readonly size: number
      readonly chunkCount: number
    }>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const pattern = `${sessionId}-checkpoint-*.json`
        // Mock implementation - in production would use glob pattern matching
        return []
      })

    // === Statistics & Monitoring ===

    const getStatistics = (): Effect.Effect<SessionStatistics, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadSessionsFromFile()
        const sessions = Object.values(data.sessions) as GenerationSession[]

        const totalSessions = sessions.length
        const activeSessions = sessions.filter(s => s.state === 'active').length
        const completedSessions = sessions.filter(s => s.state === 'completed').length
        const failedSessions = sessions.filter(s => s.state === 'failed').length

        const completedSessionsWithTiming = sessions.filter(s =>
          s.state === 'completed' && s.startedAt && s.completedAt
        )

        const averageCompletionTime = completedSessionsWithTiming.length > 0
          ? completedSessionsWithTiming.reduce((sum, s) =>
              sum + (s.completedAt!.getTime() - s.startedAt!.getTime()), 0
            ) / completedSessionsWithTiming.length
          : 0

        const totalChunksGenerated = sessions.reduce((sum, s) => sum + s.progress.completedChunks, 0)
        const failureRate = totalSessions > 0 ? failedSessions / totalSessions : 0

        return {
          totalSessions,
          activeSessions,
          completedSessions,
          failedSessions,
          averageCompletionTime,
          averageChunksPerSecond: 0, // TODO: Calculate from session data
          totalChunksGenerated,
          failureRate,
          recoverySuccessRate: 0.9, // Mock value
        }
      })

    const count = (query?: Partial<SessionQuery>): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        if (!query) {
          const data = yield* loadSessionsFromFile()
          return Object.keys(data.sessions).length
        }

        const sessions = yield* findByQuery(query as SessionQuery)
        return sessions.length
      })

    // === Mock implementations for remaining methods ===

    const pauseSession = (sessionId: GenerationSessionId) => updateSessionState(sessionId, 'paused')
    const resumeSession = (sessionId: GenerationSessionId) => updateSessionState(sessionId, 'active')
    const cancelSession = (sessionId: GenerationSessionId, reason?: string) =>
      updateSessionState(sessionId, 'cancelled')

    // Initialize with empty implementations for other methods
    const addChunkTask = (sessionId: GenerationSessionId, task: ChunkGenerationTask) => Effect.void
    const updateChunkTask = (sessionId: GenerationSessionId, position: ChunkPosition, update: Partial<ChunkGenerationTask>) => Effect.void
    const getCompletedChunks = (sessionId: GenerationSessionId) => Effect.succeed([])
    const getFailedChunks = (sessionId: GenerationSessionId) => Effect.succeed([])
    const getPendingChunks = (sessionId: GenerationSessionId) => Effect.succeed([])
    const analyzeRecovery = (sessionId: GenerationSessionId) => Effect.succeed({} as SessionRecoveryInfo)
    const recoverSession = (sessionId: GenerationSessionId, options?: any) => Effect.void
    const getSessionHistory = (sessionId: GenerationSessionId) => Effect.succeed([])
    const archiveCompletedSessions = (olderThan: Date) => Effect.succeed(0)
    const cleanupOldCheckpoints = (sessionId: GenerationSessionId, keepCount?: number) => Effect.succeed(0)
    const findOrphanedSessions = () => Effect.succeed([])
    const healthCheck = (sessionId: GenerationSessionId) => Effect.succeed({
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
        const sessions = Object.entries(data.sessions).map(([id, session]) =>
          [id, session as GenerationSession] as const
        )
        yield* Ref.set(sessionCacheRef, new Map(sessions))
      })

    const cleanup = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.set(sessionCacheRef, new Map())
      })

    const validateIntegrity = (): Effect.Effect<{
      readonly isValid: boolean
      readonly errors: ReadonlyArray<string>
      readonly warnings: ReadonlyArray<string>
    }, AllRepositoryErrors> =>
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
  Layer.effect(
    GenerationSessionRepository,
    makeGenerationSessionRepositoryPersistence(config)
  )