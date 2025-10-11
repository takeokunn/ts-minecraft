import { Layer } from 'effect'
import {
  CraftingCalculationServiceLive,
  CraftingEngineServiceLive,
  PatternMatchingServiceLive,
  RecipeDiscoveryServiceLive,
  RecipeRegistryServiceLive,
  RecipeValidationServiceLive,
} from './index'

export const CraftingDomainServicesLayer = Layer.mergeAll(
  CraftingCalculationServiceLive,
  CraftingEngineServiceLive,
  PatternMatchingServiceLive,
  RecipeDiscoveryServiceLive,
  RecipeRegistryServiceLive,
  RecipeValidationServiceLive
)
