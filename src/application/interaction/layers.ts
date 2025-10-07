/**
 * @fileoverview Interaction Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { Layer } from 'effect'
import { InteractionDomainLive } from '@/domain/interaction/layer'
import { SessionManagerLive } from './application_service'

/**
 * Interaction Application Layer
 * - Application Service: SessionManagerLive
 * - 依存: InteractionDomainLive (Repository層)
 */
export const InteractionApplicationLive = Layer.provide(SessionManagerLive, InteractionDomainLive)
