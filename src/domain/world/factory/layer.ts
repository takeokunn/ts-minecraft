import { Layer } from 'effect'
import { BiomeSystemFactoryLive, BiomeSystemFactoryTag } from './biome_system_factory/index'
import { GenerationSessionFactoryLive, GenerationSessionFactoryTag } from './generation_session_factory/index'
import { WorldConfigurationFactoryLive, WorldConfigurationFactoryTag } from './world_configuration_factory/index'
import { WorldGeneratorFactoryLive, WorldGeneratorFactoryTag } from './world_generator_factory/index'

/**
 * World Domain Factory統合Layer
 * 全てのFactoryを統合した単一のLayerです。
 */
export const WorldDomainFactoryLayer = Layer.mergeAll(
  WorldGeneratorFactoryLive,
  GenerationSessionFactoryLive,
  BiomeSystemFactoryLive,
  WorldConfigurationFactoryLive
)

/**
 * テスト用Factory Layer
 */
export const createTestWorldFactoryLayer = () =>
  Layer.mergeAll(
    Layer.succeed(WorldGeneratorFactoryTag, {} as any),
    Layer.succeed(GenerationSessionFactoryTag, {} as any),
    Layer.succeed(BiomeSystemFactoryTag, {} as any),
    Layer.succeed(WorldConfigurationFactoryTag, {} as any)
  )
