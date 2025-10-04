/**
 * @fileoverview Climate Model - 気候モデル管理
 */

import { Effect, Schema } from 'effect'
import * as Coordinates from '../../value_object/coordinates/index.js'
import * as WorldSeed from '../../value_object/world_seed/index.js'

export const ClimateModelSchema = Schema.Struct({
  globalSettings: Schema.Struct({
    baseTemperature: Schema.Number,
    temperatureVariation: Schema.Number,
    humidityBase: Schema.Number,
    humidityVariation: Schema.Number,
    enableSeasonalCycles: Schema.Boolean,
    seasonalIntensity: Schema.Number,
  }),
  regionalModifiers: Schema.Array(
    Schema.Struct({
      region: Schema.Struct({
        centerX: Schema.Number,
        centerZ: Schema.Number,
        radius: Schema.Number,
      }),
      modifiers: Schema.Struct({
        temperatureModifier: Schema.Number,
        humidityModifier: Schema.Number,
        elevationModifier: Schema.Number,
      }),
    })
  ),
  noiseFactors: Schema.Struct({
    temperatureNoise: Schema.Struct({
      scale: Schema.Number,
      octaves: Schema.Number.pipe(Schema.int()),
    }),
    humidityNoise: Schema.Struct({
      scale: Schema.Number,
      octaves: Schema.Number.pipe(Schema.int()),
    }),
  }),
})

export type ClimateModel = typeof ClimateModelSchema.Type

export const create = (
  worldSeed: WorldSeed.WorldSeed,
  globalSettings: ClimateModel['globalSettings']
): Effect.Effect<ClimateModel, never> =>
  Effect.succeed({
    globalSettings,
    regionalModifiers: [],
    noiseFactors: {
      temperatureNoise: { scale: 0.01, octaves: 3 },
      humidityNoise: { scale: 0.008, octaves: 2 },
    },
  })

export const calculateClimateFactors = (
  model: ClimateModel,
  coordinate: Coordinates.ChunkCoordinate
): Effect.Effect<
  {
    temperature: number
    humidity: number
    elevation: number
    windPattern: 'calm' | 'gentle' | 'moderate' | 'strong'
    seasonalVariation: number
  },
  never
> =>
  Effect.succeed({
    temperature: 15,
    humidity: 50,
    elevation: 64,
    windPattern: 'gentle',
    seasonalVariation: 0.1,
  })

export const update = (
  model: ClimateModel,
  globalFactors?: any,
  regionalFactors?: any
): Effect.Effect<ClimateModel, never> => Effect.succeed(model)
