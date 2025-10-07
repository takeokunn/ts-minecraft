/**
 * @fileoverview Crafting Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { CraftingDomainLive } from '@/domain/crafting/layers'

/**
 * Crafting Application Layer
 * - 依存: CraftingDomainLive (Repository層 + Domain Service層)
 * - Note: CraftingEngine/RecipeRegistryはDomain Serviceへ移動済み
 */
export const CraftingApplicationLive = CraftingDomainLive
