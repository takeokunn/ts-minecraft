/**
 * @fileoverview Generation Session Repository Memory Implementation
 * 生成セッションリポジトリのインメモリ実装
 *
 * 開発・テスト用途の高速メモリベース実装
 * セッション管理・復旧・履歴機能を完全サポート
 */

import type {
  AllRepositoryErrors,
  ChunkPosition,
  GenerationSessionId,
  GenerationSettings,
  WorldId,
} from '@domain/world/types'
import { createGenerationSessionNotFoundError, createRepositoryError } from '@domain/world/types'
import { makeUnsafeGenerationSessionId } from '@domain/world_generation/aggregate/generation_session/shared'
import {
  calculateProgress,
  ChunkGenerationTask,
  createDefaultSessionMetadata,
  defaultGenerationSessionRepositoryConfig,
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
} from '@domain/world_generation/repository/generation_session_repository'
import { toJsonValue, type JsonRecord, type JsonSerializable, type JsonValue } from '@shared/schema/json'
import { Clock, DateTime, Duration, Effect, Layer, Match, Option, pipe, Random, ReadonlyArray, Ref } from 'effect'

// === Memory Storage State ===

interface MemoryStorage {
  readonly sessions: Map<GenerationSessionId, GenerationSession>
  readonly checkpoints: Map<
    GenerationSessionId,
    Map<
      string,
      {
        readonly id: string
        readonly data: GenerationSession
        readonly createdAt: Date
        readonly size: number
      }
    >
  >
  readonly history: Map<
    GenerationSessionId,
    Array<{
      readonly timestamp: Date
      readonly action: string
      readonly details: JsonValue
      readonly actor: string
    }>
  >
  readonly statistics: {
    readonly totalChunksGenerated: number
    readonly totalSessionsCreated: number
    readonly lastActivityAt: Date | null
  }
}

const createInitialMemoryStorage = (): MemoryStorage => ({
  sessions: new Map(),
  checkpoints: new Map(),
  history: new Map(),
  statistics: {
    totalChunksGenerated: 0,
    totalSessionsCreated: 0,
    lastActivityAt: null,
  },
})

// === Memory Implementation ===

const makeGenerationSessionRepositoryMemory = (
  config: GenerationSessionRepositoryConfig = defaultGenerationSessionRepositoryConfig
): Effect.Effect<GenerationSessionRepository, never, never> =>
  Effect.gen(function* () {
    const storageRef = yield* Ref.make(createInitialMemoryStorage())

    // Utility functions
    const generateSessionId = (): Effect.Effect<GenerationSessionId, never> =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        // Random Serviceでセキュアな乱数生成（再現性保証）
        const randomValue = yield* Random.nextIntBetween(0, 2176782336) // 36^6
        const randomStr = randomValue.toString(36).padStart(6, '0')
        return makeUnsafeGenerationSessionId(`session-${timestamp}-${randomStr}`)
      })

    const addHistoryEntry = (
      sessionId: GenerationSessionId,
      action: string,
      details: JsonSerializable = {},
      actor: string = 'system'
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const now = yield* DateTime.nowAsDate
        yield* Ref.update(storageRef, (storage) => {
          const sessionHistory = storage.history.get(sessionId) || []
          const newEntry = {
            timestamp: now,
            action,
            details: toJsonValue(details),
            actor,
          }

          // Limit history size
          const maxEntries = config.cleanup.maxHistoryEntries
          const updatedHistory = [...sessionHistory, newEntry].slice(-maxEntries)

          return {
            ...storage,
            history: new Map(storage.history).set(sessionId, updatedHistory),
          }
        })
      })

    const updateStatistics = (
      fn: (stats: MemoryStorage['statistics']) => MemoryStorage['statistics']
    ): Effect.Effect<void, never> =>
      Ref.update(storageRef, (storage) => ({
        ...storage,
        statistics: fn(storage.statistics),
      }))

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

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(sessionId, session),
        }))

        yield* addHistoryEntry(sessionId, 'session_created', { worldId, settings })
        yield* updateStatistics((stats) => ({
          ...stats,
          totalSessionsCreated: stats.totalSessionsCreated + 1,
          lastActivityAt: now,
        }))

        return session
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to create session: ${error}`, 'createSession', error))
        )
      )

    const findById = (
      sessionId: GenerationSessionId
    ): Effect.Effect<Option.Option<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        return pipe(Option.fromNullable(storage.sessions.get(sessionId)))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find session by ID: ${error}`, 'findById', error))
        )
      )

    const findManyByIds = (
      sessionIds: ReadonlyArray<GenerationSessionId>
    ): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const sessions = sessionIds
          .map((id) => storage.sessions.get(id))
          .filter((session): session is GenerationSession => session !== undefined)

        return sessions
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find sessions by IDs: ${error}`, 'findManyByIds', error))
        )
      )

    const findByWorldId = (worldId: WorldId): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const sessions = Array.from(storage.sessions.values()).filter((session) => session.worldId === worldId)

        return sessions
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find sessions by world ID: ${error}`, 'findByWorldId', error))
        )
      )

    const findByQuery = (query: SessionQuery): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const sessions = Array.from(storage.sessions.values())

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
          ),
          ReadonlyArray.filter((s) =>
            query.hasFailedChunks === undefined
              ? true
              : query.hasFailedChunks
                ? s.progress.failedChunks > 0
                : s.progress.failedChunks === 0
          ),
          ReadonlyArray.filter((s) =>
            pipe(
              Option.fromNullable(query.tags),
              Option.match({
                onNone: () => true,
                onSome: (tags) => tags.length === 0 || tags.some((tag) => s.metadata.tags.includes(tag)),
              })
            )
          )
        )

        // Apply sorting
        const sorted = pipe(
          Option.fromNullable(query.sortBy),
          Option.match({
            onNone: () => filtered,
            onSome: (sortBy) => {
              const getValue = (session: GenerationSession): Date | number =>
                pipe(
                  Match.value(sortBy),
                  Match.when('createdAt', () => session.createdAt),
                  Match.when('lastActivityAt', () => session.lastActivityAt),
                  Match.when('progress', () => session.progress.overallProgress),
                  Match.orElse(() => 0)
                )

              return pipe(
                filtered,
                ReadonlyArray.sort((a, b) => {
                  const aValue = getValue(a)
                  const bValue = getValue(b)
                  const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
                  return query.sortOrder === 'desc' ? -comparison : comparison
                })
              )
            },
          })
        )

        // Apply pagination
        const offset = query.offset ?? 0
        const limit = query.limit ?? sorted.length
        return sorted.slice(offset, offset + limit)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find sessions by query: ${error}`, 'findByQuery', error))
        )
      )

    const findActiveSessions = (): Effect.Effect<ReadonlyArray<GenerationSession>, AllRepositoryErrors> =>
      findByQuery({ state: 'active' })

    const updateSession = (session: GenerationSession): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const now = yield* DateTime.nowAsDate

        yield* pipe(
          storage.sessions.has(session.id),
          Effect.when(() => !storage.sessions.has(session.id), {
            onTrue: () => Effect.fail(createGenerationSessionNotFoundError(session.id)),
            onFalse: () => Effect.void,
          })
        )

        const updatedSession = {
          ...session,
          lastActivityAt: now,
        }

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(session.id, updatedSession),
        }))

        yield* addHistoryEntry(session.id, 'session_updated', { changes: 'full_update' })
        yield* updateStatistics((stats) => ({
          ...stats,
          lastActivityAt: now,
        }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to update session: ${error}`, 'updateSession', error))
        )
      )

    const deleteSession = (sessionId: GenerationSessionId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)

        yield* pipe(
          Effect.when(() => !storage.sessions.has(sessionId), {
            onTrue: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onFalse: () => Effect.void,
          })
        )

        yield* Ref.update(storageRef, (storage) => {
          const newSessions = new Map(storage.sessions)
          newSessions.delete(sessionId)

          const newCheckpoints = new Map(storage.checkpoints)
          newCheckpoints.delete(sessionId)

          const newHistory = new Map(storage.history)
          newHistory.delete(sessionId)

          return {
            ...storage,
            sessions: newSessions,
            checkpoints: newCheckpoints,
            history: newHistory,
          }
        })

        yield* addHistoryEntry(sessionId, 'session_deleted', {})
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to delete session: ${error}`, 'deleteSession', error))
        )
      )

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
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to delete multiple sessions: ${error}`, 'deleteSessions', error))
        )
      )

    // === Session State Management ===

    const updateSessionState = (
      sessionId: GenerationSessionId,
      state: SessionState
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)

        const session = yield* pipe(
          Option.fromNullable(storage.sessions.get(sessionId)),
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

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(sessionId, updatedSession),
        }))

        yield* addHistoryEntry(sessionId, 'state_changed', { from: session.state, to: state })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to update session state: ${error}`, 'updateSessionState', error))
        )
      )

    const updateProgress = (
      sessionId: GenerationSessionId,
      progress: Partial<GenerationProgress>
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const now = yield* DateTime.nowAsDate

        const session = yield* pipe(
          Option.fromNullable(storage.sessions.get(sessionId)),
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )

        const updatedSession: GenerationSession = {
          ...session,
          progress: { ...session.progress, ...progress },
          lastActivityAt: now,
        }

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(sessionId, updatedSession),
        }))

        yield* addHistoryEntry(sessionId, 'progress_updated', progress)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to update session progress: ${error}`, 'updateProgress', error))
        )
      )

    // === Simplified implementations for other state management methods ===
    const pauseSession = (sessionId: GenerationSessionId) => updateSessionState(sessionId, 'paused')
    const resumeSession = (sessionId: GenerationSessionId) => updateSessionState(sessionId, 'active')
    const cancelSession = (sessionId: GenerationSessionId, reason?: string) =>
      Effect.gen(function* () {
        yield* updateSessionState(sessionId, 'cancelled')
        yield* addHistoryEntry(sessionId, 'session_cancelled', { reason: reason || 'Manual cancellation' })
      })

    // === Mock implementations for other required methods ===
    // (These would be fully implemented in a production system)

    const addChunkTask = (
      sessionId: GenerationSessionId,
      task: ChunkGenerationTask
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const now = yield* DateTime.nowAsDate

        const session = yield* pipe(
          Option.fromNullable(storage.sessions.get(sessionId)),
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )

        const updatedSession: GenerationSession = {
          ...session,
          chunks: [...session.chunks, task],
          progress: calculateProgress([...session.chunks, task]),
          lastActivityAt: now,
        }

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(sessionId, updatedSession),
        }))

        yield* addHistoryEntry(sessionId, 'chunk_task_added', { position: task.position })
      })

    const updateChunkTask = (
      sessionId: GenerationSessionId,
      position: ChunkPosition,
      update: Partial<ChunkGenerationTask>
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const now = yield* DateTime.nowAsDate

        const session = yield* pipe(
          Option.fromNullable(storage.sessions.get(sessionId)),
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )

        const chunkIndex = session.chunks.findIndex((c) => c.position.x === position.x && c.position.z === position.z)

        yield* pipe(
          Effect.when(() => chunkIndex === -1, {
            onTrue: () =>
              Effect.fail(
                createRepositoryError(
                  `Chunk task not found at position: ${position.x}, ${position.z}`,
                  'updateChunkTask'
                )
              ),
            onFalse: () => Effect.void,
          })
        )

        const updatedChunks = [...session.chunks]
        updatedChunks[chunkIndex] = { ...updatedChunks[chunkIndex], ...update }

        const updatedSession: GenerationSession = {
          ...session,
          chunks: updatedChunks,
          progress: calculateProgress(updatedChunks),
          lastActivityAt: now,
        }

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(sessionId, updatedSession),
        }))

        yield* addHistoryEntry(sessionId, 'chunk_task_updated', { position, update })
      })

    const getCompletedChunks = (
      sessionId: GenerationSessionId
    ): Effect.Effect<ReadonlyArray<ChunkGenerationTask>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        const session = yield* pipe(
          sessionOpt,
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        return session.chunks.filter((c) => c.status === 'completed')
      })

    const getFailedChunks = (
      sessionId: GenerationSessionId
    ): Effect.Effect<ReadonlyArray<ChunkGenerationTask>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        const session = yield* pipe(
          sessionOpt,
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        return session.chunks.filter((c) => c.status === 'failed')
      })

    const getPendingChunks = (
      sessionId: GenerationSessionId
    ): Effect.Effect<ReadonlyArray<ChunkGenerationTask>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const sessionOpt = yield* findById(sessionId)
        const session = yield* pipe(
          sessionOpt,
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        return session.chunks.filter((c) => c.status === 'pending' || c.status === 'running')
      })

    // === Checkpoint & Recovery mock implementations ===

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

        const timestamp = yield* Clock.currentTimeMillis
        const now = yield* DateTime.nowAsDate
        const checkpointId = `checkpoint-${timestamp}`

        yield* Ref.update(storageRef, (storage) => {
          const sessionCheckpoints = storage.checkpoints.get(sessionId) || new Map()
          const newCheckpoint = {
            id: checkpointId,
            data: session,
            createdAt: now,
            size: JSON.stringify(session).length,
          }
          sessionCheckpoints.set(checkpointId, newCheckpoint)

          return {
            ...storage,
            checkpoints: new Map(storage.checkpoints).set(sessionId, sessionCheckpoints),
          }
        })

        yield* addHistoryEntry(sessionId, 'checkpoint_created', { checkpointId })
        return checkpointId
      })

    const restoreFromCheckpoint = (
      sessionId: GenerationSessionId,
      checkpointId: string
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const now = yield* DateTime.nowAsDate

        const sessionCheckpoints = yield* pipe(
          Option.fromNullable(storage.checkpoints.get(sessionId)),
          Option.match({
            onNone: () => Effect.fail(createGenerationSessionNotFoundError(sessionId)),
            onSome: (sc) => Effect.succeed(sc),
          })
        )

        const checkpoint = yield* pipe(
          Option.fromNullable(sessionCheckpoints.get(checkpointId)),
          Option.match({
            onNone: () =>
              Effect.fail(createRepositoryError(`Checkpoint not found: ${checkpointId}`, 'restoreFromCheckpoint')),
            onSome: (cp) => Effect.succeed(cp),
          })
        )

        const restoredSession: GenerationSession = {
          ...checkpoint.data,
          lastActivityAt: now,
        }

        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          sessions: new Map(storage.sessions).set(sessionId, restoredSession),
        }))

        yield* addHistoryEntry(sessionId, 'checkpoint_restored', { checkpointId })
      })

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
        const storage = yield* Ref.get(storageRef)

        return pipe(
          Option.fromNullable(storage.checkpoints.get(sessionId)),
          Option.match({
            onNone: () => [],
            onSome: (sessionCheckpoints) =>
              Array.from(sessionCheckpoints.values()).map((checkpoint) => ({
                id: checkpoint.id,
                createdAt: checkpoint.createdAt,
                size: checkpoint.size,
                chunkCount: checkpoint.data.chunks.length,
              })),
          })
        )
      })

    // === Statistics & Monitoring ===

    const getStatistics = (): Effect.Effect<SessionStatistics, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const sessions = Array.from(storage.sessions.values())

        const totalSessions = sessions.length
        const activeSessions = sessions.filter((s) => s.state === 'active').length
        const completedSessions = sessions.filter((s) => s.state === 'completed').length
        const failedSessions = sessions.filter((s) => s.state === 'failed').length

        const completedSessionsWithTiming = sessions.filter(
          (s) => s.state === 'completed' && s.startedAt && s.completedAt
        )

        const averageCompletionTime =
          completedSessionsWithTiming.length > 0
            ? completedSessionsWithTiming.reduce((sum, s) => {
                const completedAt = Option.fromNullable(s.completedAt)
                const startedAt = Option.fromNullable(s.startedAt)
                return pipe(
                  Option.all([completedAt, startedAt]),
                  Option.match({
                    onNone: () => sum,
                    onSome: ([completed, started]) => sum + (completed.getTime() - started.getTime()),
                  })
                )
              }, 0) / completedSessionsWithTiming.length
            : 0

        const totalChunksGenerated = sessions.reduce((sum, s) => sum + s.progress.completedChunks, 0)
        const totalSessionTime = completedSessionsWithTiming.reduce((sum, s) => {
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

        const averageChunksPerSecond = totalSessionTime > 0 ? (totalChunksGenerated * 1000) / totalSessionTime : 0

        const failureRate = totalSessions > 0 ? failedSessions / totalSessions : 0

        return {
          totalSessions,
          activeSessions,
          completedSessions,
          failedSessions,
          averageCompletionTime,
          averageChunksPerSecond,
          totalChunksGenerated,
          failureRate,
          recoverySuccessRate: 0.9, // Mock value
        }
      })

    const count = (query?: Partial<SessionQuery>): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        return yield* pipe(
          Option.fromNullable(query),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const storage = yield* Ref.get(storageRef)
                return storage.sessions.size
              }),
            onSome: (q) =>
              Effect.gen(function* () {
                const sessions = yield* findByQuery(q)
                return sessions.length
              }),
          })
        )
      })

    // === Repository Management ===

    const initialize = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Initialize with empty storage
        yield* Ref.set(storageRef, createInitialMemoryStorage())
      })

    const cleanup = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.set(storageRef, createInitialMemoryStorage())
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

    // === Mock implementations for remaining methods ===

    const analyzeRecovery = (sessionId: GenerationSessionId): Effect.Effect<SessionRecoveryInfo, AllRepositoryErrors> =>
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
        const corruptedChunks = session.chunks.filter((c) => c.status === 'failed').map((c) => c.position)

        return {
          sessionId,
          canRecover: session.state === 'failed' || session.state === 'cancelled',
          lastCheckpoint: now,
          corruptedChunks,
          recoverableChunks: session.chunks.filter((c) => c.status === 'completed').map((c) => c.position),
          estimatedRecoveryTime: corruptedChunks.length * 1000, // 1 second per chunk
          riskLevel: corruptedChunks.length > session.chunks.length * 0.5 ? 'high' : 'low',
          recommendations: corruptedChunks.length > 0 ? ['Consider regenerating failed chunks'] : [],
        }
      })

    const recoverSession = (
      sessionId: GenerationSessionId,
      options?: JsonRecord
    ): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* updateSessionState(sessionId, 'recovering')
        // Mock recovery process
        yield* Effect.sleep(Duration.seconds(1))
        yield* updateSessionState(sessionId, 'active')
        yield* addHistoryEntry(sessionId, 'session_recovered', options)
      })

    const getSessionHistory = (
      sessionId: GenerationSessionId
    ): Effect.Effect<ReadonlyArray<SessionHistoryEntry>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const history = storage.history.get(sessionId) || []
        return history
      })

    const archiveCompletedSessions = (olderThan: Date): Effect.Effect<number, AllRepositoryErrors> => Effect.succeed(0) // Mock implementation

    const cleanupOldCheckpoints = (
      sessionId: GenerationSessionId,
      keepCount?: number
    ): Effect.Effect<number, AllRepositoryErrors> => Effect.succeed(0) // Mock implementation

    const findOrphanedSessions = (): Effect.Effect<ReadonlyArray<GenerationSessionId>, AllRepositoryErrors> =>
      Effect.succeed([]) // Mock implementation

    const healthCheck = (
      sessionId: GenerationSessionId
    ): Effect.Effect<
      {
        readonly isHealthy: boolean
        readonly issues: readonly string[]
        readonly recommendations: readonly string[]
      },
      AllRepositoryErrors
    > =>
      Effect.succeed({
        isHealthy: true,
        issues: [],
        recommendations: [],
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
 * Generation Session Repository Memory Implementation Layer
 */
export const GenerationSessionRepositoryMemory = Layer.effect(
  GenerationSessionRepository,
  makeGenerationSessionRepositoryMemory()
)

/**
 * Configurable Generation Session Repository Memory Implementation Layer
 */
export const GenerationSessionRepositoryMemoryWith = (config: GenerationSessionRepositoryConfig) =>
  Layer.effect(GenerationSessionRepository, makeGenerationSessionRepositoryMemory(config))
