export * from './crafting-calculation'
export * from './pattern-matching'
export * from './recipe-discovery'
export * from './recipe-validation'

import { Layer } from 'effect'
import {
  CraftingCalculationService,
  CraftingCalculationServiceLive,
} from './crafting-calculation'
import { PatternMatchingService, PatternMatchingServiceLive } from './pattern-matching'
import { RecipeDiscoveryService, RecipeDiscoveryServiceLive } from './recipe-discovery'
import { RecipeValidationService, RecipeValidationServiceLive } from './recipe-validation'

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
