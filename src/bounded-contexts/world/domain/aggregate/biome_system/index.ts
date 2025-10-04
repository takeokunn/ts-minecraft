/**
 * @fileoverview BiomeSystem Aggregate Index
 */

export {
  type BiomeSystem,
  type BiomeSystemId,
  type BiomeDistribution,
  type BiomeSystemConfiguration,
  type GenerateBiomeDistributionCommand,
  type UpdateClimateModelCommand,

  BiomeSystemSchema,
  BiomeSystemIdSchema,
  BiomeDistributionSchema,
  BiomeSystemConfigurationSchema,
  GenerateBiomeDistributionCommandSchema,
  UpdateClimateModelCommandSchema,

  createBiomeSystemId,
  create,
  generateBiomeDistribution,
  updateClimateModel,
  addTransitionRule,
  optimize,

  BiomeSystemTag,
  BiomeSystemLive,
} from "./biome-system.js"

export {
  type BiomeRegistry,
  BiomeRegistrySchema,
  createDefault as createDefaultRegistry,
  findCompatibleBiomes,
} from "./biome-registry.js"

export {
  type TransitionRule,
  TransitionRuleSchema,
  createDefaultRules,
  validateRule,
  calculateTransitions,
  optimizeRules,
} from "./biome-transitions.js"

export {
  type ClimateModel,
  ClimateModelSchema,
  create as createClimateModel,
  calculateClimateFactors,
  update as updateClimateModel,
} from "./climate-model.js"

export {
  type BiomeSystemCreated,
  type BiomeDistributionGenerated,
  type ClimateModelUpdated,

  BiomeSystemCreatedSchema,
  BiomeDistributionGeneratedSchema,
  ClimateModelUpdatedSchema,

  createBiomeSystemCreated,
  createBiomeDistributionGenerated,
  createClimateModelUpdated,

  publish as publishBiomeEvent,
  BiomeEventPublisherTag,
  InMemoryBiomeEventPublisher,
} from "./events.js"