/**
 * @fileoverview Lifecycle Domain Events
 * システムライフサイクルとリソース管理のイベント定義
 */

import { uuid } from '@domain/world/utils'
import { DateTime, Effect, Schema } from 'effect'
import { JsonValueSchema } from '@/shared/schema/json'
import { ChunkPosition, ChunkPositionSchema, WorldId, WorldIdSchema } from '../core'
import type { EventMetadata } from './world_events'
import { EventMetadataSchema } from './world_events'

// === システム起動・停止イベント ===

/** システム起動イベント */
export interface SystemStartedEvent {
  readonly type: 'SystemStarted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly systemVersion: string
    readonly startupTime: number // milliseconds
    readonly initializedModules: readonly string[]
    readonly configurationLoaded: Record<string, unknown>
    readonly resourcesAllocated: {
      readonly memory: number // bytes
      readonly threads: number
      readonly storage: number // bytes
    }
  }
}

export const SystemStartedEventSchema = Schema.Struct({
  type: Schema.Literal('SystemStarted'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    systemVersion: Schema.String,
    startupTime: Schema.Number.pipe(Schema.nonNegative()),
    initializedModules: Schema.Array(Schema.String),
    configurationLoaded: Schema.Record({ key: Schema.String, value: JsonValueSchema }),
    resourcesAllocated: Schema.Struct({
      memory: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      threads: Schema.Number.pipe(Schema.int(), Schema.positive()),
      storage: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    }),
  }),
}).pipe(
  Schema.annotations({
    title: 'System Started Event',
    description: 'Event emitted when system starts up successfully',
  })
)

/** システム停止イベント */
export interface SystemShutdownEvent {
  readonly type: 'SystemShutdown'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly reason: 'manual' | 'error' | 'restart' | 'update'
    readonly gracefulShutdown: boolean
    readonly shutdownTime: number // milliseconds
    readonly pendingOperations: readonly string[]
    readonly dataBackedUp: boolean
    readonly resourcesReleased: {
      readonly memory: number // bytes
      readonly threads: number
      readonly openFiles: number
    }
  }
}

export const SystemShutdownEventSchema = Schema.Struct({
  type: Schema.Literal('SystemShutdown'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    reason: Schema.Literal('manual', 'error', 'restart', 'update'),
    gracefulShutdown: Schema.Boolean,
    shutdownTime: Schema.Number.pipe(Schema.nonNegative()),
    pendingOperations: Schema.Array(Schema.String),
    dataBackedUp: Schema.Boolean,
    resourcesReleased: Schema.Struct({
      memory: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      threads: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      openFiles: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    }),
  }),
}).pipe(
  Schema.annotations({
    title: 'System Shutdown Event',
    description: 'Event emitted when system shuts down',
  })
)

// === リソース管理イベント ===

/** メモリ不足警告イベント */
export interface MemoryWarningEvent {
  readonly type: 'MemoryWarning'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly currentUsage: number // bytes
    readonly maxAvailable: number // bytes
    readonly thresholdBreached: number // percentage
    readonly severityLevel: 'low' | 'medium' | 'high' | 'critical'
    readonly suggestedActions: readonly string[]
    readonly affectedOperations: readonly string[]
  }
}

export const MemoryWarningEventSchema = Schema.Struct({
  type: Schema.Literal('MemoryWarning'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    currentUsage: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    maxAvailable: Schema.Number.pipe(Schema.int(), Schema.positive()),
    thresholdBreached: Schema.Number.pipe(Schema.between(0, 100)),
    severityLevel: Schema.Literal('low', 'medium', 'high', 'critical'),
    suggestedActions: Schema.Array(Schema.String),
    affectedOperations: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'Memory Warning Event',
    description: 'Event emitted when memory usage exceeds threshold',
  })
)

/** ガベージコレクション実行イベント */
export interface GarbageCollectionEvent {
  readonly type: 'GarbageCollection'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly trigger: 'automatic' | 'manual' | 'emergency'
    readonly beforeCollection: {
      readonly heapUsed: number // bytes
      readonly heapTotal: number // bytes
      readonly external: number // bytes
    }
    readonly afterCollection: {
      readonly heapUsed: number // bytes
      readonly heapTotal: number // bytes
      readonly external: number // bytes
    }
    readonly collectionTime: number // milliseconds
    readonly freedMemory: number // bytes
    readonly pauseTime: number // milliseconds
  }
}

export const GarbageCollectionEventSchema = Schema.Struct({
  type: Schema.Literal('GarbageCollection'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    trigger: Schema.Literal('automatic', 'manual', 'emergency'),
    beforeCollection: Schema.Struct({
      heapUsed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      heapTotal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      external: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    }),
    afterCollection: Schema.Struct({
      heapUsed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      heapTotal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      external: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    }),
    collectionTime: Schema.Number.pipe(Schema.nonNegative()),
    freedMemory: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    pauseTime: Schema.Number.pipe(Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Garbage Collection Event',
    description: 'Event emitted when garbage collection occurs',
  })
)

// === チャンクライフサイクルイベント ===

/** チャンク読み込みイベント */
export interface ChunkLoadedEvent {
  readonly type: 'ChunkLoaded'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly chunkPosition: ChunkPosition
    readonly loadTime: number // milliseconds
    readonly source: 'disk' | 'generation' | 'network' | 'cache'
    readonly dataSizeBytes: number
    readonly playersInRange: readonly string[]
  }
}

export const ChunkLoadedEventSchema = Schema.Struct({
  type: Schema.Literal('ChunkLoaded'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    worldId: Schema.suspend(() => WorldIdSchema),
    chunkPosition: Schema.suspend(() => ChunkPositionSchema),
    loadTime: Schema.Number.pipe(Schema.nonNegative()),
    source: Schema.Literal('disk', 'generation', 'network', 'cache'),
    dataSizeBytes: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    playersInRange: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'Chunk Loaded Event',
    description: 'Event emitted when chunk is loaded into memory',
  })
)

/** チャンクアンロードイベント */
export interface ChunkUnloadedEvent {
  readonly type: 'ChunkUnloaded'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly chunkPosition: ChunkPosition
    readonly reason: 'no_players' | 'memory_pressure' | 'manual' | 'server_shutdown'
    readonly timeLoaded: number // milliseconds
    readonly saved: boolean
    readonly modifications: number
  }
}

export const ChunkUnloadedEventSchema = Schema.Struct({
  type: Schema.Literal('ChunkUnloaded'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    worldId: Schema.suspend(() => WorldIdSchema),
    chunkPosition: Schema.suspend(() => ChunkPositionSchema),
    reason: Schema.Literal('no_players', 'memory_pressure', 'manual', 'server_shutdown'),
    timeLoaded: Schema.Number.pipe(Schema.nonNegative()),
    saved: Schema.Boolean,
    modifications: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Chunk Unloaded Event',
    description: 'Event emitted when chunk is unloaded from memory',
  })
)

// === パフォーマンス監視イベント ===

/** パフォーマンス閾値超過イベント */
export interface PerformanceThresholdExceededEvent {
  readonly type: 'PerformanceThresholdExceeded'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly metric: string
    readonly currentValue: number
    readonly threshold: number
    readonly duration: number // milliseconds
    readonly impact: 'low' | 'medium' | 'high'
    readonly suggestedOptimizations: readonly string[]
  }
}

export const PerformanceThresholdExceededEventSchema = Schema.Struct({
  type: Schema.Literal('PerformanceThresholdExceeded'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    metric: Schema.String,
    currentValue: Schema.Number,
    threshold: Schema.Number,
    duration: Schema.Number.pipe(Schema.nonNegative()),
    impact: Schema.Literal('low', 'medium', 'high'),
    suggestedOptimizations: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'Performance Threshold Exceeded Event',
    description: 'Event emitted when performance metric exceeds threshold',
  })
)

/** パフォーマンス統計更新イベント */
export interface PerformanceStatsUpdatedEvent {
  readonly type: 'PerformanceStatsUpdated'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly interval: number // milliseconds
    readonly stats: {
      readonly cpu: {
        readonly usage: number // percentage
        readonly cores: number
        readonly load: readonly number[]
      }
      readonly memory: {
        readonly used: number // bytes
        readonly total: number // bytes
        readonly cached: number // bytes
      }
      readonly io: {
        readonly readOps: number
        readonly writeOps: number
        readonly readBytes: number
        readonly writeBytes: number
      }
      readonly network: {
        readonly bytesIn: number
        readonly bytesOut: number
        readonly packetsIn: number
        readonly packetsOut: number
      }
    }
  }
}

export const PerformanceStatsUpdatedEventSchema = Schema.Struct({
  type: Schema.Literal('PerformanceStatsUpdated'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    interval: Schema.Number.pipe(Schema.positive()),
    stats: Schema.Struct({
      cpu: Schema.Struct({
        usage: Schema.Number.pipe(Schema.between(0, 100)),
        cores: Schema.Number.pipe(Schema.int(), Schema.positive()),
        load: Schema.Array(Schema.Number.pipe(Schema.nonNegative())),
      }),
      memory: Schema.Struct({
        used: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        total: Schema.Number.pipe(Schema.int(), Schema.positive()),
        cached: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      }),
      io: Schema.Struct({
        readOps: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        writeOps: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        readBytes: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        writeBytes: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      }),
      network: Schema.Struct({
        bytesIn: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        bytesOut: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        packetsIn: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        packetsOut: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      }),
    }),
  }),
}).pipe(
  Schema.annotations({
    title: 'Performance Stats Updated Event',
    description: 'Event emitted when performance statistics are updated',
  })
)

// === バックアップ・復旧イベント ===

/** バックアップ開始イベント */
export interface BackupStartedEvent {
  readonly type: 'BackupStarted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly backupId: string
    readonly backupType: 'full' | 'incremental' | 'differential'
    readonly targetLocation: string
    readonly estimatedSize: number // bytes
    readonly worldsIncluded: readonly WorldId[]
    readonly compression: boolean
  }
}

export const BackupStartedEventSchema = Schema.Struct({
  type: Schema.Literal('BackupStarted'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    backupId: Schema.String.pipe(uuid()),
    backupType: Schema.Literal('full', 'incremental', 'differential'),
    targetLocation: Schema.String,
    estimatedSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    worldsIncluded: Schema.Array(Schema.suspend(() => WorldIdSchema)),
    compression: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'Backup Started Event',
    description: 'Event emitted when backup process begins',
  })
)

/** バックアップ完了イベント */
export interface BackupCompletedEvent {
  readonly type: 'BackupCompleted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly backupId: string
    readonly actualSize: number // bytes
    readonly duration: number // milliseconds
    readonly filesBackedUp: number
    readonly checksum: string
    readonly compressionRatio?: number
    readonly success: boolean
  }
}

export const BackupCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('BackupCompleted'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    backupId: Schema.String.pipe(uuid()),
    actualSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    duration: Schema.Number.pipe(Schema.nonNegative()),
    filesBackedUp: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    checksum: Schema.String,
    compressionRatio: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
    success: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'Backup Completed Event',
    description: 'Event emitted when backup process completes',
  })
)

// === エラー・警告イベント ===

/** エラー発生イベント */
export interface ErrorOccurredEvent {
  readonly type: 'ErrorOccurred'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly errorType: string
    readonly severity: 'low' | 'medium' | 'high' | 'critical'
    readonly message: string
    readonly stackTrace?: string
    readonly context: Record<string, unknown>
    readonly recoverable: boolean
    readonly affectedSystems: readonly string[]
  }
}

export const ErrorOccurredEventSchema = Schema.Struct({
  type: Schema.Literal('ErrorOccurred'),
  metadata: Schema.suspend(() => EventMetadataSchema),
  payload: Schema.Struct({
    errorType: Schema.String,
    severity: Schema.Literal('low', 'medium', 'high', 'critical'),
    message: Schema.String,
    stackTrace: Schema.optional(Schema.String),
    context: Schema.Record({ key: Schema.String, value: JsonValueSchema }),
    recoverable: Schema.Boolean,
    affectedSystems: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'Error Occurred Event',
    description: 'Event emitted when system error occurs',
  })
)

// === ライフサイクルイベント統合型 ===

/** ライフサイクルドメインの全イベント型 */
export type LifecycleDomainEvent =
  | SystemStartedEvent
  | SystemShutdownEvent
  | MemoryWarningEvent
  | GarbageCollectionEvent
  | ChunkLoadedEvent
  | ChunkUnloadedEvent
  | PerformanceThresholdExceededEvent
  | PerformanceStatsUpdatedEvent
  | BackupStartedEvent
  | BackupCompletedEvent
  | ErrorOccurredEvent

export const LifecycleDomainEventSchema = Schema.Union(
  SystemStartedEventSchema,
  SystemShutdownEventSchema,
  MemoryWarningEventSchema,
  GarbageCollectionEventSchema,
  ChunkLoadedEventSchema,
  ChunkUnloadedEventSchema,
  PerformanceThresholdExceededEventSchema,
  PerformanceStatsUpdatedEventSchema,
  BackupStartedEventSchema,
  BackupCompletedEventSchema,
  ErrorOccurredEventSchema
).pipe(
  Schema.annotations({
    title: 'Lifecycle Domain Event',
    description: 'Union of all lifecycle domain events',
  })
)

// === イベント作成ヘルパー関数 ===

/** SystemStartedEvent作成ヘルパー */
export const createSystemStartedEvent = (
  systemVersion: string,
  startupTime: number,
  initializedModules: readonly string[],
  configurationLoaded: Record<string, unknown>,
  resourcesAllocated: { memory: number; threads: number; storage: number }
): Effect.Effect<SystemStartedEvent> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return {
      type: 'SystemStarted',
      metadata: {
        eventId: crypto.randomUUID(),
        timestamp,
        version: 1,
        causedBy: { systemId: 'startup_manager' },
        aggregateId: 'system',
        aggregateVersion: 1,
      },
      payload: {
        systemVersion,
        startupTime,
        initializedModules,
        configurationLoaded,
        resourcesAllocated,
      },
    }
  })

/** MemoryWarningEvent作成ヘルパー */
export const createMemoryWarningEvent = (
  currentUsage: number,
  maxAvailable: number,
  thresholdBreached: number,
  severityLevel: 'low' | 'medium' | 'high' | 'critical',
  suggestedActions: readonly string[],
  affectedOperations: readonly string[]
): Effect.Effect<MemoryWarningEvent> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return {
      type: 'MemoryWarning',
      metadata: {
        eventId: crypto.randomUUID(),
        timestamp,
        version: 1,
        causedBy: { systemId: 'memory_monitor' },
        aggregateId: 'system_resources',
        aggregateVersion: 1,
      },
      payload: {
        currentUsage,
        maxAvailable,
        thresholdBreached,
        severityLevel,
        suggestedActions,
        affectedOperations,
      },
    }
  })

/** ChunkLoadedEvent作成ヘルパー */
export const createChunkLoadedEvent = (
  worldId: WorldId,
  chunkPosition: ChunkPosition,
  loadTime: number,
  source: 'disk' | 'generation' | 'network' | 'cache',
  dataSizeBytes: number,
  playersInRange: readonly string[]
): Effect.Effect<ChunkLoadedEvent> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return {
      type: 'ChunkLoaded',
      metadata: {
        eventId: crypto.randomUUID(),
        timestamp,
        version: 1,
        causedBy: { systemId: 'chunk_manager' },
        aggregateId: `${worldId}:${chunkPosition.x},${chunkPosition.z}`,
        aggregateVersion: 1,
      },
      payload: {
        worldId,
        chunkPosition,
        loadTime,
        source,
        dataSizeBytes,
        playersInRange,
      },
    }
  })
