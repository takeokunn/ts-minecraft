/**
 * Raycast Port - Interface for raycast operations
 *
 * This port defines the contract for ray casting operations,
 * allowing the domain layer to perform ray queries without
 * depending on specific raycast implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Option from 'effect/Option'
import { EntityId } from '@domain/entities'

export interface Ray {
  readonly origin: { x: number; y: number; z: number }
  readonly direction: { x: number; y: number; z: number }
}

export interface RaycastHit {
  readonly entityId: EntityId
  readonly point: { x: number; y: number; z: number }
  readonly normal: { x: number; y: number; z: number }
  readonly distance: number
  readonly face?: { x: number; y: number; z: number }
}

export interface RaycastOptions {
  readonly maxDistance?: number
  readonly layerMask?: number
  readonly ignoreEntities?: ReadonlyArray<EntityId>
}

export interface IRaycastPort {
  // Basic raycast operations
  readonly cast: (ray: Ray, options?: RaycastOptions) => Effect.Effect<Option.Option<RaycastHit>, never, never>
  readonly castAll: (ray: Ray, options?: RaycastOptions) => Effect.Effect<ReadonlyArray<RaycastHit>, never, never>

  // Convenience methods
  readonly castFromCamera: (
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance?: number,
  ) => Effect.Effect<Option.Option<RaycastHit>, never, never>

  // Shape-based queries
  readonly sphereCast: (
    center: { x: number; y: number; z: number },
    radius: number,
    direction: { x: number; y: number; z: number },
    maxDistance?: number,
  ) => Effect.Effect<Option.Option<RaycastHit>, never, never>
}

export class RaycastPort extends Context.GenericTag('RaycastPort')<RaycastPort, IRaycastPort>() {}
