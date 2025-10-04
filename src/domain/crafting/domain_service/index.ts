export * from './crafting_calculation'
export * from './pattern_matching'
export * from './recipe_discovery'
export * from './recipe_validation'

import { Layer } from 'effect'
import {
  CraftingCalculationService,
  CraftingCalculationServiceLive,
} from './crafting_calculation'
import { PatternMatchingService, PatternMatchingServiceLive } from './pattern_matching'
import { RecipeDiscoveryService, RecipeDiscoveryServiceLive } from './recipe_discovery'
import { RecipeValidationService, RecipeValidationServiceLive } from './recipe_validation'

export const CraftingDomainServicesLayer = Layer.mergeAll(
  CraftingCalculationServiceLive,
  PatternMatchingServiceLive,
  RecipeDiscoveryServiceLive,
  RecipeValidationServiceLive
)

export {
  CraftingCalculationService as CraftingCalculationTag,
  PatternMatchingService as PatternMatchingTag,
  RecipeDiscoveryService as RecipeDiscoveryTag,
  RecipeValidationService as RecipeValidationTag,
}
