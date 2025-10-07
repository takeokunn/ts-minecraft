/**
 * @fileoverview Interaction Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { InteractionDomainLive } from '@/domain/interaction/layer'
import { Layer } from 'effect'
import { SessionManagerLive } from './session_manager'

/**
 * Interaction Application Layer
 * - Application Service: SessionManagerLive
 * - 依存: InteractionDomainLive (Repository層)
 */
export const InteractionApplicationLive = Layer.provide(SessionManagerLive, InteractionDomainLive)
