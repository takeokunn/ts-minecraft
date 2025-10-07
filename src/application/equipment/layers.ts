/**
 * @fileoverview Equipment Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { Layer } from 'effect'
import { EquipmentDomainLive } from '@/domain/equipment/layers'
import { EquipmentServiceLive } from './application_service'

/**
 * Equipment Application Layer
 * - Application Service: EquipmentServiceLive
 * - 依存: EquipmentDomainLive (Repository層)
 */
export const EquipmentApplicationLive = Layer.provide(EquipmentServiceLive, EquipmentDomainLive)
