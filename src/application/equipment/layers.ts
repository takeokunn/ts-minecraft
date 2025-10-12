/**
 * @fileoverview Equipment Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { EquipmentDomainLive } from './domain-layer'
import { Layer } from 'effect'
import { EquipmentServiceLive } from './service'

/**
 * Equipment Application Layer
 * - Application Service: EquipmentServiceLive
 * - 依存: EquipmentDomainLive (Repository層)
 */
export const EquipmentApplicationLive = Layer.provide(EquipmentServiceLive, EquipmentDomainLive)
