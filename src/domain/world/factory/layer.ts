import type { GenerationSessionFactory } from '@/domain/world_generation/factory/generation_session_factory/factory'
import {
  GenerationSessionFactoryLive,
  GenerationSessionFactoryTag,
} from '@/domain/world_generation/factory/generation_session_factory/index'
import type { WorldGeneratorFactory } from '@/domain/world_generation/factory/world_generator_factory/factory'
import {
  WorldGeneratorFactoryLive,
  WorldGeneratorFactoryTag,
} from '@/domain/world_generation/factory/world_generator_factory/index'
import { Effect, Layer } from 'effect'
import type { BiomeSystemFactory } from './biome_system_factory/factory'
import { BiomeSystemFactoryLive, BiomeSystemFactoryTag } from './biome_system_factory/index'
import type { WorldConfigurationFactory } from './world_configuration_factory/factory'
import { WorldConfigurationFactoryLive, WorldConfigurationFactoryTag } from './world_configuration_factory/index'

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
 *
 * 各FactoryのモックはEffect.dieで実装を強制し、
 * テストで必要な場合は適切なモック実装を提供する必要がある
 */
export const createTestWorldFactoryLayer = () => {
  const mockWorldGeneratorFactory: WorldGeneratorFactory = {
    create: () => Effect.die('WorldGeneratorFactory.create is not implemented in test mock'),
    createFromPreset: () => Effect.die('WorldGeneratorFactory.createFromPreset is not implemented in test mock'),
  }

  const mockGenerationSessionFactory: GenerationSessionFactory = {
    create: () => Effect.die('GenerationSessionFactory.create is not implemented in test mock'),
    createFromTemplate: () => Effect.die('GenerationSessionFactory.createFromTemplate is not implemented in test mock'),
  }

  const mockBiomeSystemFactory: BiomeSystemFactory = {
    create: () => Effect.die('BiomeSystemFactory.create is not implemented in test mock'),
  }

  const mockWorldConfigurationFactory: WorldConfigurationFactory = {
    create: () => Effect.die('WorldConfigurationFactory.create is not implemented in test mock'),
  }

  return Layer.mergeAll(
    Layer.succeed(WorldGeneratorFactoryTag, mockWorldGeneratorFactory),
    Layer.succeed(GenerationSessionFactoryTag, mockGenerationSessionFactory),
    Layer.succeed(BiomeSystemFactoryTag, mockBiomeSystemFactory),
    Layer.succeed(WorldConfigurationFactoryTag, mockWorldConfigurationFactory)
  )
}
