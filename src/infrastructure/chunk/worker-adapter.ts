/**
 * @fileoverview Chunk Worker Adapter
 * Chunk Domainのコマンドをワーカーメッセージへ変換し、Bounded Queueで管理するレイヤー。
 */

import { ChunkDataSchema, ChunkIdSchema, ChunkPositionSchema } from '@/domain/chunk'
import type { ChunkCommand } from '@/domain/chunk/types'
import { ChunkCommandMetadataSchema } from '@/domain/chunk/types'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Context, Data, Effect, Layer, Match, Option, Queue, Ref, Schema } from 'effect'
import { Chunk } from 'effect/Chunk'

const QUEUE_CAPACITY = 256

const WorkerMessageBaseSchema = Schema.Struct({
  ...ChunkCommandMetadataSchema.fields,
})

const LoadChunkWorkerMessageSchema = Schema.Struct({
  ...WorkerMessageBaseSchema.fields,
  _tag: Schema.Literal('LoadChunkRequest'),
  position: ChunkPositionSchema,
})

const SaveChunkWorkerMessageSchema = Schema.Struct({
  ...WorkerMessageBaseSchema.fields,
  _tag: Schema.Literal('SaveChunkRequest'),
  chunk: ChunkDataSchema,
})

const UnloadChunkWorkerMessageSchema = Schema.Struct({
  ...WorkerMessageBaseSchema.fields,
  _tag: Schema.Literal('UnloadChunkRequest'),
  chunkId: ChunkIdSchema,
})

const ChunkWorkerMessageSchema = Schema.Union(
  LoadChunkWorkerMessageSchema,
  SaveChunkWorkerMessageSchema,
  UnloadChunkWorkerMessageSchema
)

export type ChunkWorkerMessage = Schema.Schema.Type<typeof ChunkWorkerMessageSchema>

const decodeWorkerMessage = Schema.decodeUnknown(ChunkWorkerMessageSchema)

const ChunkWorkerAdapterMetricsSchema = Schema.Struct({
  enqueued: Schema.Number,
  processed: Schema.Number,
  dropped: Schema.Number,
  queueSize: Schema.Number,
  capacity: Schema.Number,
})

export type ChunkWorkerAdapterMetrics = Schema.Schema.Type<typeof ChunkWorkerAdapterMetricsSchema>

export const ChunkWorkerAdapterError = Data.taggedEnum('ChunkWorkerAdapterError')({
  QueueFull: Data.struct<{ readonly commandId: string; readonly capacity: number }>(),
  SerializationFailed: Data.struct<{ readonly commandId: string; readonly reason: string }>(),
})

export type ChunkWorkerAdapterError = Data.taggedEnum.Infer<typeof ChunkWorkerAdapterError>

interface AdapterMetricsState {
  readonly enqueued: number
  readonly processed: number
  readonly dropped: number
}

const makeInitialMetrics = (): AdapterMetricsState => ({
  enqueued: 0,
  processed: 0,
  dropped: 0,
})

const toWorkerMessageInput = (command: ChunkCommand) =>
  Match.value(command).pipe(
    Match.tag('LoadChunk', (cmd) => ({
      _tag: 'LoadChunkRequest' as const,
      commandId: cmd.commandId,
      issuedAt: cmd.issuedAt,
      actorId: cmd.actorId,
      position: cmd.position,
    })),
    Match.tag('SaveChunk', (cmd) => ({
      _tag: 'SaveChunkRequest' as const,
      commandId: cmd.commandId,
      issuedAt: cmd.issuedAt,
      actorId: cmd.actorId,
      chunk: cmd.chunk,
    })),
    Match.tag('UnloadChunk', (cmd) => ({
      _tag: 'UnloadChunkRequest' as const,
      commandId: cmd.commandId,
      issuedAt: cmd.issuedAt,
      actorId: cmd.actorId,
      chunkId: cmd.chunkId,
    })),
    Match.exhaustive
  )

const toWorkerMessage = (command: ChunkCommand) =>
  decodeWorkerMessage(toWorkerMessageInput(command)).pipe(
    Effect.mapError((error) =>
      ChunkWorkerAdapterError.SerializationFailed({
        commandId: command.commandId,
        reason: TreeFormatter.formatErrorSync(error),
      })
    )
  )

export interface ChunkWorkerAdapter {
  readonly publish: (command: ChunkCommand) => Effect.Effect<void, ChunkWorkerAdapterError>
  readonly take: Effect.Effect<ChunkWorkerMessage>
  readonly poll: Effect.Effect<Option.Option<ChunkWorkerMessage>>
  readonly drain: Effect.Effect<ReadonlyArray<ChunkWorkerMessage>>
  readonly metrics: Effect.Effect<ChunkWorkerAdapterMetrics>
}

export const ChunkWorkerAdapterTag = Context.GenericTag<ChunkWorkerAdapter>(
  '@minecraft/infrastructure/chunk/ChunkWorkerAdapter'
)

const formatMetrics = (state: AdapterMetricsState, queueSize: number) =>
  Schema.decodeSync(ChunkWorkerAdapterMetricsSchema)({
    enqueued: state.enqueued,
    processed: state.processed,
    dropped: state.dropped,
    queueSize,
    capacity: QUEUE_CAPACITY,
  })

export const ChunkWorkerAdapterLive = Layer.scoped(
  ChunkWorkerAdapterTag,
  Effect.gen(function* () {
    const queue = yield* Effect.acquireRelease(Queue.bounded<ChunkWorkerMessage>(QUEUE_CAPACITY), (instance) =>
      Queue.shutdown(instance)
    )
    const metricsRef = yield* Ref.make<AdapterMetricsState>(makeInitialMetrics())

    const publish = (command: ChunkCommand) =>
      Effect.gen(function* () {
        const message = yield* toWorkerMessage(command)
        const offered = yield* Queue.offer(queue, message)

        yield* Match.value(offered).pipe(
          Match.when(false, () =>
            Effect.gen(function* () {
              yield* Ref.update(metricsRef, (state) => ({ ...state, dropped: state.dropped + 1 }))
              yield* Effect.fail(
                ChunkWorkerAdapterError.QueueFull({
                  commandId: command.commandId,
                  capacity: QUEUE_CAPACITY,
                })
              )
            })
          ),
          Match.orElse(() => Effect.unit()),
          Match.exhaustive
        )

        yield* Ref.update(metricsRef, (state) => ({ ...state, enqueued: state.enqueued + 1 }))
      })

    const take = Queue.take(queue).pipe(
      Effect.tap(() => Ref.update(metricsRef, (state) => ({ ...state, processed: state.processed + 1 })))
    )

    const poll = Effect.gen(function* () {
      const result = yield* Queue.poll(queue)

      yield* Option.match(result, {
        onSome: () => Ref.update(metricsRef, (state) => ({ ...state, processed: state.processed + 1 })),
        onNone: () => Effect.void,
      })

      return result
    })

    const drain = Effect.gen(function* () {
      const chunk = yield* Queue.takeAll(queue)
      const messages = Chunk.toReadonlyArray(chunk)

      yield* Match.value(messages.length > 0).pipe(
        Match.when(true, () =>
          Ref.update(metricsRef, (state) => ({ ...state, processed: state.processed + messages.length }))
        ),
        Match.orElse(() => Effect.void),
        Match.exhaustive
      )

      return messages
    })

    const metrics = Effect.gen(function* () {
      const state = yield* Ref.get(metricsRef)
      const queueSize = yield* Queue.size(queue)
      return formatMetrics(state, queueSize)
    })

    return ChunkWorkerAdapterTag.of({
      publish,
      take,
      poll,
      drain,
      metrics,
    })
  })
)
