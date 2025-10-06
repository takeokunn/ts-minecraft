import { Layer } from 'effect'
import {
  CraftingCalculationServiceLive,
  PatternMatchingServiceLive,
  RecipeDiscoveryServiceLive,
  RecipeValidationServiceLive,
} from './index'

export const CraftingDomainServicesLayer = Layer.mergeAll(
  CraftingCalculationServiceLive,
  PatternMatchingServiceLive,
  RecipeDiscoveryServiceLive,
  RecipeValidationServiceLive
)
