/**
 * @fileoverview Interaction Domain Layer
 * Domain層の依存関係を提供（Repository層のみ）
 */

import { SessionStoreLive } from './repository'

/**
 * Interaction Domain Layer
 * - Repository: SessionStoreLive
 * - Domain Service: validatePlacement等の純粋関数（Layerなし）
 */
export const InteractionDomainLive = SessionStoreLive
