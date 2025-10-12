/**
 * @fileoverview Crafting Domain Layer
 * Domain層の依存関係を提供（Repository層 + Domain Service層）
 */

import { Layer } from 'effect'
import { CraftingDomainServicesLayer } from './domain_service/layer'
import { RecipeRepositoryLive } from './repository'

/**
 * Crafting Domain Layer
 * - Repository: RecipeRepositoryLive
 * - Domain Service: CraftingDomainServicesLayer (6 services)
 *   - CraftingCalculationServiceLive
 *   - CraftingEngineServiceLive
 *   - PatternMatchingServiceLive
 *   - RecipeDiscoveryServiceLive
 *   - RecipeRegistryServiceLive
 *   - RecipeValidationServiceLive
 */
export const CraftingDomainLive = Layer.mergeAll(RecipeRepositoryLive, CraftingDomainServicesLayer)
