/**
 * @fileoverview Generation Domain Events
 * 世界生成システムのイベント定義（Event Sourcing対応）
 */

import { Schema } from 'effect'
import {
  BiomeGenerationData,
  ChunkPosition,
  GenerationPerformanceStats,
  GenerationRequestId,
  GenerationSessionId,
  GenerationStage,
  HeightMap,
  StructureInfo,
} from '../core/generation_types'
import { EventMetadata } from './world_events'

// === 生成セッションイベント ===

/** 生成セッション開始イベント */
export interface GenerationSessionStartedEvent {
  readonly type: 'GenerationSessionStarted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly sessionId: GenerationSessionId
    readonly worldId: string
    readonly totalChunksRequested: number
    readonly settings: Record<string, unknown>
    readonly parallelWorkers: number
  }
}

export const GenerationSessionStartedEventSchema = Schema.Struct({
  type: Schema.Literal('GenerationSessionStarted'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    sessionId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationSessionIdSchema)),
    worldId: Schema.String,
    totalChunksRequested: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    settings: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    parallelWorkers: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Generation Session Started Event',
    description: 'Event emitted when generation session begins',
  })
)

/** 生成セッション完了イベント */
export interface GenerationSessionCompletedEvent {
  readonly type: 'GenerationSessionCompleted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly sessionId: GenerationSessionId
    readonly totalDuration: number // milliseconds
    readonly chunksGenerated: number
    readonly chunksSkipped: number
    readonly chunksFailed: number
    readonly performanceStats: GenerationPerformanceStats
  }
}

export const GenerationSessionCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('GenerationSessionCompleted'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    sessionId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationSessionIdSchema)),
    totalDuration: Schema.Number.pipe(Schema.nonNegative()),
    chunksGenerated: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    chunksSkipped: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    chunksFailed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    performanceStats: Schema.suspend(() =>
      import('../core/generation_types').then((m) => m.GenerationPerformanceStatsSchema)
    ),
  }),
}).pipe(
  Schema.annotations({
    title: 'Generation Session Completed Event',
    description: 'Event emitted when generation session completes',
  })
)

/** 生成セッション失敗イベント */
export interface GenerationSessionFailedEvent {
  readonly type: 'GenerationSessionFailed'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly sessionId: GenerationSessionId
    readonly reason: string
    readonly failedAfter: number // milliseconds
    readonly completedChunks: number
    readonly failedChunks: readonly ChunkPosition[]
    readonly recoveryAction: 'retry' | 'skip' | 'abort'
  }
}

export const GenerationSessionFailedEventSchema = Schema.Struct({
  type: Schema.Literal('GenerationSessionFailed'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    sessionId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationSessionIdSchema)),
    reason: Schema.String,
    failedAfter: Schema.Number.pipe(Schema.nonNegative()),
    completedChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    failedChunks: Schema.Array(
      Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema))
    ),
    recoveryAction: Schema.Literal('retry', 'skip', 'abort'),
  }),
}).pipe(
  Schema.annotations({
    title: 'Generation Session Failed Event',
    description: 'Event emitted when generation session fails',
  })
)

// === チャンク生成イベント ===

/** チャンク生成開始イベント */
export interface ChunkGenerationStartedEvent {
  readonly type: 'ChunkGenerationStarted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly requestId: GenerationRequestId
    readonly chunkPosition: ChunkPosition
    readonly priority: number
    readonly requestedBy: string
    readonly expectedStages: readonly GenerationStage[]
  }
}

export const ChunkGenerationStartedEventSchema = Schema.Struct({
  type: Schema.Literal('ChunkGenerationStarted'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    requestId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationRequestIdSchema)),
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 10)),
    requestedBy: Schema.String,
    expectedStages: Schema.Array(
      Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema))
    ),
  }),
}).pipe(
  Schema.annotations({
    title: 'Chunk Generation Started Event',
    description: 'Event emitted when chunk generation begins',
  })
)

/** チャンク生成完了イベント */
export interface ChunkGenerationCompletedEvent {
  readonly type: 'ChunkGenerationCompleted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly requestId: GenerationRequestId
    readonly chunkPosition: ChunkPosition
    readonly generationTime: number // milliseconds
    readonly completedStages: readonly GenerationStage[]
    readonly heightMap: HeightMap
    readonly biomeData: BiomeGenerationData
    readonly memoryUsed: number // bytes
  }
}

export const ChunkGenerationCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('ChunkGenerationCompleted'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    requestId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationRequestIdSchema)),
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    generationTime: Schema.Number.pipe(Schema.nonNegative()),
    completedStages: Schema.Array(
      Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema))
    ),
    heightMap: Schema.suspend(() => import('../core/generation_types').then((m) => m.HeightMapSchema)),
    biomeData: Schema.suspend(() => import('../core/generation_types').then((m) => m.BiomeGenerationDataSchema)),
    memoryUsed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Chunk Generation Completed Event',
    description: 'Event emitted when chunk generation completes successfully',
  })
)

/** チャンク生成失敗イベント */
export interface ChunkGenerationFailedEvent {
  readonly type: 'ChunkGenerationFailed'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly requestId: GenerationRequestId
    readonly chunkPosition: ChunkPosition
    readonly failedStage: GenerationStage
    readonly reason: string
    readonly retryCount: number
    readonly canRetry: boolean
    readonly partialData?: Record<string, unknown>
  }
}

export const ChunkGenerationFailedEventSchema = Schema.Struct({
  type: Schema.Literal('ChunkGenerationFailed'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    requestId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationRequestIdSchema)),
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    failedStage: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema)),
    reason: Schema.String,
    retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    canRetry: Schema.Boolean,
    partialData: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  }),
}).pipe(
  Schema.annotations({
    title: 'Chunk Generation Failed Event',
    description: 'Event emitted when chunk generation fails',
  })
)

// === 生成段階イベント ===

/** 生成段階開始イベント */
export interface GenerationStageStartedEvent {
  readonly type: 'GenerationStageStarted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly requestId: GenerationRequestId
    readonly chunkPosition: ChunkPosition
    readonly stage: GenerationStage
    readonly estimatedDuration?: number // milliseconds
    readonly dependencies: readonly GenerationStage[]
  }
}

export const GenerationStageStartedEventSchema = Schema.Struct({
  type: Schema.Literal('GenerationStageStarted'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    requestId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationRequestIdSchema)),
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    stage: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema)),
    estimatedDuration: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
    dependencies: Schema.Array(
      Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema))
    ),
  }),
}).pipe(
  Schema.annotations({
    title: 'Generation Stage Started Event',
    description: 'Event emitted when generation stage begins',
  })
)

/** 生成段階完了イベント */
export interface GenerationStageCompletedEvent {
  readonly type: 'GenerationStageCompleted'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly requestId: GenerationRequestId
    readonly chunkPosition: ChunkPosition
    readonly stage: GenerationStage
    readonly actualDuration: number // milliseconds
    readonly outputData: Record<string, unknown>
    readonly nextStages: readonly GenerationStage[]
  }
}

export const GenerationStageCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('GenerationStageCompleted'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    requestId: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationRequestIdSchema)),
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    stage: Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema)),
    actualDuration: Schema.Number.pipe(Schema.nonNegative()),
    outputData: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    nextStages: Schema.Array(
      Schema.suspend(() => import('../core/generation_types').then((m) => m.GenerationStageSchema))
    ),
  }),
}).pipe(
  Schema.annotations({
    title: 'Generation Stage Completed Event',
    description: 'Event emitted when generation stage completes',
  })
)

// === 地形生成イベント ===

/** 高度マップ生成イベント */
export interface HeightMapGeneratedEvent {
  readonly type: 'HeightMapGenerated'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly chunkPosition: ChunkPosition
    readonly heightMap: HeightMap
    readonly generationTime: number // milliseconds
    readonly noiseParameters: Record<string, unknown>
  }
}

export const HeightMapGeneratedEventSchema = Schema.Struct({
  type: Schema.Literal('HeightMapGenerated'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    heightMap: Schema.suspend(() => import('../core/generation_types').then((m) => m.HeightMapSchema)),
    generationTime: Schema.Number.pipe(Schema.nonNegative()),
    noiseParameters: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  }),
}).pipe(
  Schema.annotations({
    title: 'Height Map Generated Event',
    description: 'Event emitted when height map is generated',
  })
)

/** 地形形成イベント */
export interface TerrainShapedEvent {
  readonly type: 'TerrainShaped'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly chunkPosition: ChunkPosition
    readonly layersGenerated: readonly string[]
    readonly blocksPlaced: number
    readonly generationTime: number // milliseconds
  }
}

export const TerrainShapedEventSchema = Schema.Struct({
  type: Schema.Literal('TerrainShaped'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    layersGenerated: Schema.Array(Schema.String),
    blocksPlaced: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    generationTime: Schema.Number.pipe(Schema.nonNegative()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Terrain Shaped Event',
    description: 'Event emitted when terrain is shaped',
  })
)

// === バイオーム生成イベント ===

/** バイオーム割り当てイベント */
export interface BiomesAssignedEvent {
  readonly type: 'BiomesAssigned'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly chunkPosition: ChunkPosition
    readonly biomeData: BiomeGenerationData
    readonly assignmentTime: number // milliseconds
    readonly blendingApplied: boolean
  }
}

export const BiomesAssignedEventSchema = Schema.Struct({
  type: Schema.Literal('BiomesAssigned'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    biomeData: Schema.suspend(() => import('../core/generation_types').then((m) => m.BiomeGenerationDataSchema)),
    assignmentTime: Schema.Number.pipe(Schema.nonNegative()),
    blendingApplied: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'Biomes Assigned Event',
    description: 'Event emitted when biomes are assigned to terrain',
  })
)

// === 構造物生成イベント ===

/** 構造物配置イベント */
export interface StructurePlacedEvent {
  readonly type: 'StructurePlaced'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly chunkPosition: ChunkPosition
    readonly structure: StructureInfo
    readonly placementTime: number // milliseconds
    readonly conflictsResolved: readonly string[]
  }
}

export const StructurePlacedEventSchema = Schema.Struct({
  type: Schema.Literal('StructurePlaced'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    structure: Schema.suspend(() => import('../core/generation_types').then((m) => m.StructureInfoSchema)),
    placementTime: Schema.Number.pipe(Schema.nonNegative()),
    conflictsResolved: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'Structure Placed Event',
    description: 'Event emitted when structure is placed in world',
  })
)

/** 構造物配置失敗イベント */
export interface StructurePlacementFailedEvent {
  readonly type: 'StructurePlacementFailed'
  readonly metadata: EventMetadata
  readonly payload: {
    readonly chunkPosition: ChunkPosition
    readonly structureType: string
    readonly attemptedPosition: { x: number; y: number; z: number }
    readonly reason: string
    readonly conflicts: readonly string[]
  }
}

export const StructurePlacementFailedEventSchema = Schema.Struct({
  type: Schema.Literal('StructurePlacementFailed'),
  metadata: Schema.suspend(() => import('./world_events').then((m) => m.EventMetadataSchema)),
  payload: Schema.Struct({
    chunkPosition: Schema.suspend(() => import('../core/generation_types').then((m) => m.ChunkPositionSchema)),
    structureType: Schema.String,
    attemptedPosition: Schema.Struct({
      x: Schema.Number.pipe(Schema.int()),
      y: Schema.Number.pipe(Schema.int()),
      z: Schema.Number.pipe(Schema.int()),
    }),
    reason: Schema.String,
    conflicts: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'Structure Placement Failed Event',
    description: 'Event emitted when structure placement fails',
  })
)

// === 生成イベント統合型 ===

/** 生成ドメインの全イベント型 */
export type GenerationDomainEvent =
  | GenerationSessionStartedEvent
  | GenerationSessionCompletedEvent
  | GenerationSessionFailedEvent
  | ChunkGenerationStartedEvent
  | ChunkGenerationCompletedEvent
  | ChunkGenerationFailedEvent
  | GenerationStageStartedEvent
  | GenerationStageCompletedEvent
  | HeightMapGeneratedEvent
  | TerrainShapedEvent
  | BiomesAssignedEvent
  | StructurePlacedEvent
  | StructurePlacementFailedEvent

export const GenerationDomainEventSchema = Schema.Union(
  GenerationSessionStartedEventSchema,
  GenerationSessionCompletedEventSchema,
  GenerationSessionFailedEventSchema,
  ChunkGenerationStartedEventSchema,
  ChunkGenerationCompletedEventSchema,
  ChunkGenerationFailedEventSchema,
  GenerationStageStartedEventSchema,
  GenerationStageCompletedEventSchema,
  HeightMapGeneratedEventSchema,
  TerrainShapedEventSchema,
  BiomesAssignedEventSchema,
  StructurePlacedEventSchema,
  StructurePlacementFailedEventSchema
).pipe(
  Schema.annotations({
    title: 'Generation Domain Event',
    description: 'Union of all generation domain events',
  })
)

// === イベント作成ヘルパー関数 ===

/** ChunkGenerationStartedEvent作成ヘルパー */
export const createChunkGenerationStartedEvent = (
  requestId: GenerationRequestId,
  chunkPosition: ChunkPosition,
  priority: number,
  requestedBy: string,
  expectedStages: readonly GenerationStage[],
  aggregateVersion: number
): ChunkGenerationStartedEvent => ({
  type: 'ChunkGenerationStarted',
  metadata: {
    eventId: crypto.randomUUID(),
    timestamp: new Date(),
    version: 1,
    causedBy: { systemId: 'generation_system' },
    aggregateId: requestId,
    aggregateVersion,
  },
  payload: {
    requestId,
    chunkPosition,
    priority,
    requestedBy,
    expectedStages,
  },
})

/** StructurePlacedEvent作成ヘルパー */
export const createStructurePlacedEvent = (
  chunkPosition: ChunkPosition,
  structure: StructureInfo,
  placementTime: number,
  conflictsResolved: readonly string[],
  aggregateVersion: number
): StructurePlacedEvent => ({
  type: 'StructurePlaced',
  metadata: {
    eventId: crypto.randomUUID(),
    timestamp: new Date(),
    version: 1,
    causedBy: { systemId: 'structure_generator' },
    aggregateId: `${chunkPosition.x},${chunkPosition.z}`,
    aggregateVersion,
  },
  payload: {
    chunkPosition,
    structure,
    placementTime,
    conflictsResolved,
  },
})

/** BiomesAssignedEvent作成ヘルパー */
export const createBiomesAssignedEvent = (
  chunkPosition: ChunkPosition,
  biomeData: BiomeGenerationData,
  assignmentTime: number,
  blendingApplied: boolean,
  aggregateVersion: number
): BiomesAssignedEvent => ({
  type: 'BiomesAssigned',
  metadata: {
    eventId: crypto.randomUUID(),
    timestamp: new Date(),
    version: 1,
    causedBy: { systemId: 'biome_generator' },
    aggregateId: `${chunkPosition.x},${chunkPosition.z}`,
    aggregateVersion,
  },
  payload: {
    chunkPosition,
    biomeData,
    assignmentTime,
    blendingApplied,
  },
})
