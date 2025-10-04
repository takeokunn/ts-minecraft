import { Schema } from 'effect'
import { WorldDomainConfig, WorldDomainConfigSchema } from './config'

const WorldDataSchema = Schema.Struct({
  seed: Schema.Number,
  generator: Schema.Any,
  biomeSystem: Schema.Any,
})

export const WorldDomainTypeGuards = {
  isWorldDomainConfig: (value: unknown): value is WorldDomainConfig =>
    Schema.decodeUnknownEither(WorldDomainConfigSchema)(value)._tag === 'Right',

  isValidWorldData: (value: unknown): boolean => Schema.decodeUnknownEither(WorldDataSchema)(value)._tag === 'Right',

  isWorldDomainLayer: (value: unknown): boolean => typeof value === 'object' && value !== null && '_tag' in value,
} as const
