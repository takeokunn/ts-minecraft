/**
 * @fileoverview Biome Registry - バイオーム登録管理
 */

import { Effect, Schema } from 'effect'
import * as BiomeProperties from '../../value_object/biome_properties/index.js'

export const BiomeRegistrySchema = Schema.Struct({
  biomes: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      properties: BiomeProperties.BiomeConfigurationSchema,
      rarity: Schema.Number.pipe(Schema.between(0, 1)),
      category: Schema.Literal('cold', 'temperate', 'warm', 'hot', 'special'),
    })
  ),
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
})

export type BiomeRegistry = typeof BiomeRegistrySchema.Type

export const createDefault = (): Effect.Effect<BiomeRegistry, never> =>
  Effect.succeed({
    biomes: [
      {
        id: 'plains',
        name: 'Plains',
        properties: BiomeProperties.createDefault(),
        rarity: 0.8,
        category: 'temperate',
      },
      {
        id: 'forest',
        name: 'Forest',
        properties: BiomeProperties.createDefault(),
        rarity: 0.7,
        category: 'temperate',
      },
      {
        id: 'desert',
        name: 'Desert',
        properties: BiomeProperties.createDefault(),
        rarity: 0.3,
        category: 'hot',
      },
    ],
    version: 1,
  })

export const findCompatibleBiomes = (
  registry: BiomeRegistry,
  climateFactors: any
): Effect.Effect<readonly string[], never> => Effect.succeed(registry.biomes.map((b) => b.id))
