/**
 * @fileoverview Biome System Events - バイオームシステムイベント
 */

import { Context, Effect, Schema } from 'effect'
import * as Coordinates from '@domain/world/value_object/coordinates/index.js'
import * as WorldSeed from '@domain/world/value_object/world_seed/index.js'
import {
  BiomeDistributionPayloadSchema,
  BiomeSystemConfigurationSchema,
  BiomeSystemIdSchema,
  createBiomeSystemId,
  type BiomeDistribution,
  type BiomeSystemConfiguration,
  type BiomeSystemId,
} from './shared.js'

export const BaseBiomeEventSchema = Schema.Struct({
  eventId: Schema.String.pipe(Schema.brand('BiomeEventId')),
  biomeSystemId: BiomeSystemIdSchema,
  aggregateVersion: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  timestamp: Schema.DateTimeUtc,
})

export const BiomeSystemCreatedSchema = BaseBiomeEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('BiomeSystemCreated'),
      payload: Schema.Struct({
        worldSeed: WorldSeed.WorldSeedSchema,
        configuration: BiomeSystemConfigurationSchema,
      }),
    })
  )
)

export const BiomeDistributionGeneratedSchema = BaseBiomeEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('BiomeDistributionGenerated'),
      payload: BiomeDistributionPayloadSchema,
    })
  )
)

export const ClimateModelUpdatedSchema = BaseBiomeEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('ClimateModelUpdated'),
      payload: Schema.Struct({
        updateCommand: Schema.Unknown,
      }),
    })
  )
)

export type BiomeSystemCreated = typeof BiomeSystemCreatedSchema.Type
export type BiomeDistributionGenerated = typeof BiomeDistributionGeneratedSchema.Type
export type ClimateModelUpdated = typeof ClimateModelUpdatedSchema.Type

const generateEventId = (): Effect.Effect<string & Schema.Schema.Brand<typeof Schema.String, 'BiomeEventId'>> =>
  Effect.sync(() => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 11)
    return Schema.decodeSync(Schema.String.pipe(Schema.brand('BiomeEventId')))(`bevt_${timestamp}_${random}`)
  })

export const createBiomeSystemCreated = (
  biomeSystemId: BiomeSystemId,
  worldSeed: WorldSeed.WorldSeed,
  configuration: BiomeSystemConfiguration
): Effect.Effect<BiomeSystemCreated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(BiomeSystemCreatedSchema)({
      eventId,
      biomeSystemId,
      aggregateVersion: 1,
      timestamp,
      eventType: 'BiomeSystemCreated',
      payload: { worldSeed, configuration },
    })
  })

export const createBiomeDistributionGenerated = (
  biomeSystemId: BiomeSystemId,
  coordinate: Coordinates.ChunkCoordinate,
  distribution: BiomeDistribution
): Effect.Effect<BiomeDistributionGenerated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(BiomeDistributionGeneratedSchema)({
      eventId,
      biomeSystemId,
      aggregateVersion: 1,
      timestamp,
      eventType: 'BiomeDistributionGenerated',
      payload: { coordinate, distribution },
    })
  })

export const createClimateModelUpdated = (
  biomeSystemId: BiomeSystemId,
  updateCommand: any
): Effect.Effect<ClimateModelUpdated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(ClimateModelUpdatedSchema)({
      eventId,
      biomeSystemId,
      aggregateVersion: 1,
      timestamp,
      eventType: 'ClimateModelUpdated',
      payload: { updateCommand },
    })
  })

interface BiomeEventPublisher {
  readonly publish: (event: any) => Effect.Effect<void, Error>
}

export const BiomeEventPublisherTag = Context.GenericTag<BiomeEventPublisher>(
  '@minecraft/domain/world/BiomeEventPublisher'
)

export const publish = (event: any): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const publisher = yield* BiomeEventPublisherTag
    yield* publisher.publish(event)
  })

export const InMemoryBiomeEventPublisher: BiomeEventPublisher = {
  publish: (event) => Effect.log(`Publishing biome event: ${event.eventType}`),
}
