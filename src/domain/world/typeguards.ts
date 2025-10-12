import { BiomeSystemSchema } from '@domain/biome/aggregate/biome_system/shared'
import { Schema } from 'effect'
import { WorldDomainConfig, WorldDomainConfigSchema } from './index'

const WorldDataSchema = Schema.Struct({
  seed: Schema.Number,
  generator: Schema.Unknown,
  biomeSystem: Schema.suspend(() => BiomeSystemSchema),
})

export const WorldDomainTypeGuards = {
  isWorldDomainConfig: (value: unknown): value is WorldDomainConfig =>
    Schema.decodeUnknownEither(WorldDomainConfigSchema)(value)._tag === 'Right',

  isValidWorldData: (value: unknown): boolean => Schema.decodeUnknownEither(WorldDataSchema)(value)._tag === 'Right',
} as const
