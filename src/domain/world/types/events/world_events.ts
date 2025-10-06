/**
 * @fileoverview World Domain Events
 * 世界ドメインのイベント定義（Event Sourcing対応）
 */

import { Schema } from 'effect'
import { uuid } from '@domain/world/utils'
import { ChunkPosition, DimensionId, GameTime, Vector3D, WorldId, WorldState } from '../core'

// === 基本イベント型 ===

/** イベントメタデータ */
export interface EventMetadata {
  readonly eventId: string
  readonly timestamp: Date
  readonly version: number
  readonly causedBy?: {
    readonly userId?: string
    readonly systemId?: string
    readonly operationId?: string
  }
  readonly correlationId?: string
  readonly aggregateId: string
  readonly aggregateVersion: number
}

export const EventMetadataSchema = Schema.Struct({
  eventId: Schema.String.pipe(uuid()),
  timestamp: Schema.DateFromSelf,
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  causedBy: Schema.optional(
    Schema.Struct({
      userId: Schema.optional(Schema.String),
      systemId: Schema.optional(Schema.String),
      operationId: Schema.optional(Schema.String),
    })
  ),
  correlationId: Schema.optional(Schema.String.pipe(uuid())),
  aggregateId: Schema.String,
  aggregateVersion: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}).pipe(
  Schema.annotations({
    title: 'Event Metadata',
    description: 'Common metadata for all domain events',
  })
)

// === 世界ライフサイクルイベント ===

/** 世界作成開始イベント */
export interface WorldCreationStartedEvent {
  readonly type: 'WorldCreationStarted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly worldName: string
    readonly seed: number
    readonly settings: Record<string, unknown>
    readonly requestedBy: string
  }
}

export const WorldCreationStartedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldCreationStarted'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    worldName: Schema.String,
    seed: Schema.Number.pipe(Schema.int()),
    settings: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    requestedBy: Schema.String,
  }),
}).pipe(
  Schema.annotations({
    title: 'World Creation Started Event',
    description: 'Event emitted when world creation begins',
  })
)

/** 世界作成完了イベント */
export interface WorldCreationCompletedEvent {
  readonly type: 'WorldCreationCompleted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly finalState: WorldState
    readonly generationTime: number // milliseconds
    readonly initialChunks: readonly ChunkPosition[]
  }
}

export const WorldCreationCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldCreationCompleted'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    finalState: Schema.suspend(() => import('../core').then((m) => m.WorldStateSchema)),
    generationTime: Schema.Number.pipe(Schema.nonNegative()),
    initialChunks: Schema.Array(Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema))),
  }),
}).pipe(
  Schema.annotations({
    title: 'World Creation Completed Event',
    description: 'Event emitted when world creation completes successfully',
  })
)

/** 世界作成失敗イベント */
export interface WorldCreationFailedEvent {
  readonly type: 'WorldCreationFailed'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly reason: string
    readonly errorDetails: Record<string, unknown>
    readonly rollbackRequired: boolean
  }
}

export const WorldCreationFailedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldCreationFailed'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    reason: Schema.String,
    errorDetails: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    rollbackRequired: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'World Creation Failed Event',
    description: 'Event emitted when world creation fails',
  })
)

// === 世界状態変更イベント ===

/** 世界読み込みイベント */
export interface WorldLoadedEvent {
  readonly type: 'WorldLoaded'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly loadTime: number // milliseconds
    readonly loadedChunks: readonly ChunkPosition[]
    readonly playerCount: number
  }
}

export const WorldLoadedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldLoaded'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    loadTime: Schema.Number.pipe(Schema.nonNegative()),
    loadedChunks: Schema.Array(Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema))),
    playerCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'World Loaded Event',
    description: 'Event emitted when world is loaded',
  })
)

/** 世界アンロードイベント */
export interface WorldUnloadedEvent {
  readonly type: 'WorldUnloaded'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly reason: 'player_disconnect' | 'server_shutdown' | 'manual' | 'timeout'
    readonly finalState: WorldState
    readonly saveRequired: boolean
  }
}

export const WorldUnloadedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldUnloaded'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    reason: Schema.Literal('player_disconnect', 'server_shutdown', 'manual', 'timeout'),
    finalState: Schema.suspend(() => import('../core').then((m) => m.WorldStateSchema)),
    saveRequired: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'World Unloaded Event',
    description: 'Event emitted when world is unloaded',
  })
)

/** 世界保存イベント */
export interface WorldSavedEvent {
  readonly type: 'WorldSaved'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly saveTime: number // milliseconds
    readonly savedChunks: readonly ChunkPosition[]
    readonly dataSizeBytes: number
    readonly incrementalSave: boolean
  }
}

export const WorldSavedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldSaved'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    saveTime: Schema.Number.pipe(Schema.nonNegative()),
    savedChunks: Schema.Array(Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema))),
    dataSizeBytes: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    incrementalSave: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'World Saved Event',
    description: 'Event emitted when world data is saved',
  })
)

// === プレイヤー関連イベント ===

/** プレイヤー参加イベント */
export interface PlayerJoinedWorldEvent {
  readonly type: 'PlayerJoinedWorld'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly playerId: string
    readonly playerName: string
    readonly spawnPosition: Vector3D
    readonly gameMode: string
    readonly firstJoin: boolean
  }
}

export const PlayerJoinedWorldEventSchema = Schema.Struct({
  type: Schema.Literal('PlayerJoinedWorld'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    playerId: Schema.String,
    playerName: Schema.String,
    spawnPosition: Schema.suspend(() => import('../core').then((m) => m.Vector3DSchema)),
    gameMode: Schema.String,
    firstJoin: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'Player Joined World Event',
    description: 'Event emitted when player joins a world',
  })
)

/** プレイヤー退出イベント */
export interface PlayerLeftWorldEvent {
  readonly type: 'PlayerLeftWorld'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly playerId: string
    readonly reason: 'disconnect' | 'quit' | 'kicked' | 'timeout'
    readonly lastPosition: Vector3D
    readonly sessionDuration: number // milliseconds
  }
}

export const PlayerLeftWorldEventSchema = Schema.Struct({
  type: Schema.Literal('PlayerLeftWorld'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    playerId: Schema.String,
    reason: Schema.Literal('disconnect', 'quit', 'kicked', 'timeout'),
    lastPosition: Schema.suspend(() => import('../core').then((m) => m.Vector3DSchema)),
    sessionDuration: Schema.Number.pipe(Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Player Left World Event',
    description: 'Event emitted when player leaves a world',
  })
)

// === 次元関連イベント ===

/** 次元作成イベント */
export interface DimensionCreatedEvent {
  readonly type: 'DimensionCreated'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly dimensionId: DimensionId
    readonly dimensionType: string
    readonly settings: Record<string, unknown>
  }
}

export const DimensionCreatedEventSchema = Schema.Struct({
  type: Schema.Literal('DimensionCreated'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    dimensionId: Schema.suspend(() => import('../core').then((m) => m.DimensionIdSchema)),
    dimensionType: Schema.String,
    settings: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  }),
}).pipe(
  Schema.annotations({
    title: 'Dimension Created Event',
    description: 'Event emitted when new dimension is created',
  })
)

/** プレイヤー次元移動イベント */
export interface PlayerChangedDimensionEvent {
  readonly type: 'PlayerChangedDimension'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly playerId: string
    readonly fromDimension: DimensionId
    readonly toDimension: DimensionId
    readonly fromPosition: Vector3D
    readonly toPosition: Vector3D
    readonly transferTime: number // milliseconds
  }
}

export const PlayerChangedDimensionEventSchema = Schema.Struct({
  type: Schema.Literal('PlayerChangedDimension'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    playerId: Schema.String,
    fromDimension: Schema.suspend(() => import('../core').then((m) => m.DimensionIdSchema)),
    toDimension: Schema.suspend(() => import('../core').then((m) => m.DimensionIdSchema)),
    fromPosition: Schema.suspend(() => import('../core').then((m) => m.Vector3DSchema)),
    toPosition: Schema.suspend(() => import('../core').then((m) => m.Vector3DSchema)),
    transferTime: Schema.Number.pipe(Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Player Changed Dimension Event',
    description: 'Event emitted when player moves between dimensions',
  })
)

// === 時間・天候イベント ===

/** 時間変更イベント */
export interface WorldTimeChangedEvent {
  readonly type: 'WorldTimeChanged'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly oldTime: GameTime
    readonly newTime: GameTime
    readonly reason: 'natural' | 'command' | 'skip'
  }
}

export const WorldTimeChangedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldTimeChanged'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    oldTime: Schema.suspend(() => import('../core').then((m) => m.GameTimeSchema)),
    newTime: Schema.suspend(() => import('../core').then((m) => m.GameTimeSchema)),
    reason: Schema.Literal('natural', 'command', 'skip'),
  }),
}).pipe(
  Schema.annotations({
    title: 'World Time Changed Event',
    description: 'Event emitted when world time changes',
  })
)

/** 天候変更イベント */
export interface WeatherChangedEvent {
  readonly type: 'WeatherChanged'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly oldWeather: string
    readonly newWeather: string
    readonly duration: GameTime
    readonly natural: boolean
  }
}

export const WeatherChangedEventSchema = Schema.Struct({
  type: Schema.Literal('WeatherChanged'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    oldWeather: Schema.String,
    newWeather: Schema.String,
    duration: Schema.suspend(() => import('../core').then((m) => m.GameTimeSchema)),
    natural: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'Weather Changed Event',
    description: 'Event emitted when weather conditions change',
  })
)

// === 世界設定変更イベント ===

/** 世界設定更新イベント */
export interface WorldSettingsUpdatedEvent {
  readonly type: 'WorldSettingsUpdated'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly worldId: WorldId
    readonly updatedSettings: Record<string, { old: unknown; new: unknown }>
    readonly updatedBy: string
    readonly requiresRestart: boolean
  }
}

export const WorldSettingsUpdatedEventSchema = Schema.Struct({
  type: Schema.Literal('WorldSettingsUpdated'),
  metadata: EventMetadataSchema,
  payload: Schema.Struct({
    worldId: Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema)),
    updatedSettings: Schema.Record({
      key: Schema.String,
      value: Schema.Struct({
        old: Schema.Unknown,
        new: Schema.Unknown,
      }),
    }),
    updatedBy: Schema.String,
    requiresRestart: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'World Settings Updated Event',
    description: 'Event emitted when world settings are modified',
  })
)

// === 世界イベント統合型 ===

/** 世界ドメインの全イベント型 */
export type WorldDomainEvent =
  | WorldCreationStartedEvent
  | WorldCreationCompletedEvent
  | WorldCreationFailedEvent
  | WorldLoadedEvent
  | WorldUnloadedEvent
  | WorldSavedEvent
  | PlayerJoinedWorldEvent
  | PlayerLeftWorldEvent
  | DimensionCreatedEvent
  | PlayerChangedDimensionEvent
  | WorldTimeChangedEvent
  | WeatherChangedEvent
  | WorldSettingsUpdatedEvent

export const WorldDomainEventSchema = Schema.Union(
  WorldCreationStartedEventSchema,
  WorldCreationCompletedEventSchema,
  WorldCreationFailedEventSchema,
  WorldLoadedEventSchema,
  WorldUnloadedEventSchema,
  WorldSavedEventSchema,
  PlayerJoinedWorldEventSchema,
  PlayerLeftWorldEventSchema,
  DimensionCreatedEventSchema,
  PlayerChangedDimensionEventSchema,
  WorldTimeChangedEventSchema,
  WeatherChangedEventSchema,
  WorldSettingsUpdatedEventSchema
).pipe(
  Schema.annotations({
    title: 'World Domain Event',
    description: 'Union of all world domain events',
  })
)

// === イベント作成ヘルパー関数 ===

/** EventMetadata作成ヘルパー */
export const createEventMetadata = (
  aggregateId: string,
  aggregateVersion: number,
  causedBy?: {
    userId?: string
    systemId?: string
    operationId?: string
  },
  correlationId?: string
): EventMetadata => ({
  eventId: crypto.randomUUID(),
  timestamp: new Date(),
  version: 1,
  causedBy,
  correlationId,
  aggregateId,
  aggregateVersion,
})

/** WorldCreationStartedEvent作成ヘルパー */
export const createWorldCreationStartedEvent = (
  worldId: WorldId,
  worldName: string,
  seed: number,
  settings: Record<string, unknown>,
  requestedBy: string,
  aggregateVersion: number = 0
): WorldCreationStartedEvent => ({
  type: 'WorldCreationStarted',
  metadata: createEventMetadata(worldId, aggregateVersion, { userId: requestedBy }),
  payload: {
    worldId,
    worldName,
    seed,
    settings,
    requestedBy,
  },
})

/** PlayerJoinedWorldEvent作成ヘルパー */
export const createPlayerJoinedWorldEvent = (
  worldId: WorldId,
  playerId: string,
  playerName: string,
  spawnPosition: Vector3D,
  gameMode: string,
  firstJoin: boolean,
  aggregateVersion: number
): PlayerJoinedWorldEvent => ({
  type: 'PlayerJoinedWorld',
  metadata: createEventMetadata(worldId, aggregateVersion, { userId: playerId }),
  payload: {
    worldId,
    playerId,
    playerName,
    spawnPosition,
    gameMode,
    firstJoin,
  },
})

/** WeatherChangedEvent作成ヘルパー */
export const createWeatherChangedEvent = (
  worldId: WorldId,
  oldWeather: string,
  newWeather: string,
  duration: GameTime,
  natural: boolean,
  aggregateVersion: number
): WeatherChangedEvent => ({
  type: 'WeatherChanged',
  metadata: createEventMetadata(worldId, aggregateVersion, { systemId: 'weather_system' }),
  payload: {
    worldId,
    oldWeather,
    newWeather,
    duration,
    natural,
  },
})
