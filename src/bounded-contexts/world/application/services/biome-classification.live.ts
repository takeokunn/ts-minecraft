import { Layer } from 'effect'
import {
  ClimateCalculatorService,
  ClimateCalculatorServiceLive,
} from '@mc/bc-world/domain/domain_service/biome_classification/climate-calculator'
import {
  BiomeMapperService,
  BiomeMapperServiceLive,
} from '@mc/bc-world/domain/domain_service/biome_classification/biome-mapper'
import {
  EcosystemAnalyzerService,
  EcosystemAnalyzerServiceLive,
} from '@mc/bc-world/domain/domain_service/biome_classification/ecosystem-analyzer'

export const ClimateCalculatorLayer = ClimateCalculatorServiceLive
export const BiomeMapperLayer = BiomeMapperServiceLive
export const EcosystemAnalyzerLayer = EcosystemAnalyzerServiceLive

export const BiomeClassificationLayer = Layer.mergeAll(
  ClimateCalculatorLayer,
  BiomeMapperLayer,
  EcosystemAnalyzerLayer,
)

export const BiomeClassificationServices = {
  ClimateCalculator: ClimateCalculatorService,
  BiomeMapper: BiomeMapperService,
  EcosystemAnalyzer: EcosystemAnalyzerService,
} as const
