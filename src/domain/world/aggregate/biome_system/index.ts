/**
 * @fileoverview BiomeSystem Aggregate Index
 */

export {
  BiomeDistributionSchema,
  BiomeSystemConfigurationSchema,
  BiomeSystemIdSchema,
  BiomeSystemLive,
  BiomeSystemSchema,
  BiomeSystemTag,
  GenerateBiomeDistributionCommandSchema,
  UpdateClimateModelCommandSchema,
  addTransitionRule,
  create,
  createBiomeSystemId,
  generateBiomeDistribution,
  optimize,
  updateClimateModel,
  type BiomeDistribution,
  type BiomeSystem,
  type BiomeSystemConfiguration,
  type BiomeSystemId,
  type GenerateBiomeDistributionCommand,
  type UpdateClimateModelCommand,
} from './biome_system.js'

export {
  BiomeRegistrySchema,
  createDefault as createDefaultRegistry,
  findCompatibleBiomes,
  type BiomeRegistry,
} from './biome_registry.js'

export {
  TransitionRuleSchema,
  calculateTransitions,
  createDefaultRules,
  optimizeRules,
  validateRule,
  type TransitionRule,
} from './biome_transitions.js'

export {
  ClimateModelSchema,
  calculateClimateFactors,
  create as createClimateModel,
  update as updateClimateModel,
  type ClimateModel,
} from './climate_model.js'

export {
  BiomeDistributionGeneratedSchema,
  BiomeEventPublisherTag,
  BiomeSystemCreatedSchema,
  ClimateModelUpdatedSchema,
  InMemoryBiomeEventPublisher,
  createBiomeDistributionGenerated,
  createBiomeSystemCreated,
  createClimateModelUpdated,
  publish as publishBiomeEvent,
  type BiomeDistributionGenerated,
  type BiomeSystemCreated,
  type ClimateModelUpdated,
} from './events.js'
