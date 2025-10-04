import { Layer } from 'effect'
import { ProceduralGenerationLayer } from './procedural-generation.live'
import { NoiseGenerationLayer, NoiseGenerationServices } from './noise-generation.live'
import {
  BiomeClassificationLayer,
  BiomeClassificationServices,
} from './biome-classification.live'
import {
  WorldValidationLayer,
  WorldValidationServices,
} from './world-validation.live'
import {
  MathematicalOperationsLayer,
  MathematicalOperationsServices,
} from './mathematical-operations.live'
import { TerrainGeneratorService } from '@mc/bc-world/domain/domain_service/procedural_generation/terrain-generator'

export const WorldDomainServiceLayer = Layer.mergeAll(
  ProceduralGenerationLayer,
  NoiseGenerationLayer,
  BiomeClassificationLayer,
  WorldValidationLayer,
  MathematicalOperationsLayer,
)

export const WorldDomainServices = {
  ProceduralGeneration: {
    TerrainGenerator: TerrainGeneratorService,
  },
  NoiseGeneration: NoiseGenerationServices,
  BiomeClassification: BiomeClassificationServices,
  WorldValidation: WorldValidationServices,
  MathematicalOperations: MathematicalOperationsServices,
} as const
