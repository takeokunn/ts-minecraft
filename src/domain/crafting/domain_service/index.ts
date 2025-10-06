export * from './index'
export * from './index'
export * from './index'
export * from './index'

import { Layer } from 'effect'
import { CraftingCalculationService, CraftingCalculationServiceLive } from './index'
import { PatternMatchingService, PatternMatchingServiceLive } from './index'
import { RecipeDiscoveryService, RecipeDiscoveryServiceLive } from './index'
import { RecipeValidationService, RecipeValidationServiceLive } from './index'

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
