/**
 * @fileoverview Equipment Domain Layer
 * Domain層の依存関係を提供（Repository層のみ）
 */

import { InMemoryEquipmentRepository } from './repository'

/**
 * Equipment Domain Layer
 * - Repository: InMemoryEquipmentRepository
 * - Domain Service: 純粋関数のためLayerなし
 */
export const EquipmentDomainLive = InMemoryEquipmentRepository
