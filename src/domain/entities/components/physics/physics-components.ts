/**
 * Physics Components - Redesigned for Performance Optimization
 *
 * Features:
 * - SoA-optimized data structures for physics simulation
 * - SIMD-friendly memory layouts
 * - Automatic registration with ComponentRegistry
 * - Type-safe component definitions
 */

import * as S from 'effect/Schema'
import { RegisterComponent } from '@domain/entities/components/registry'

// ===== POSITION COMPONENT =====

export const PositionComponent = RegisterComponent({
  id: 'position',
  category: 'physics',
  priority: 1, // High priority for SoA optimization
})(
  S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
    // Additional metadata for optimization
    dirty: S.optional(S.Boolean),
    lastUpdated: S.optional(S.Number),
  }),
)

export type PositionComponent = S.Schema.Type<typeof PositionComponent>

// ===== VELOCITY COMPONENT =====

export const VelocityComponent = RegisterComponent({
  id: 'velocity',
  category: 'physics',
  priority: 1,
  dependencies: ['position'] as const,
})(
  S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
    // Linear damping factor
    damping: S.optional(S.Number.pipe(S.between(0, 1))),
    // Maximum velocity magnitude
    maxMagnitude: S.optional(S.Number.pipe(S.positive())),
  }),
)

export type VelocityComponent = S.Schema.Type<typeof VelocityComponent>

// ===== ACCELERATION COMPONENT =====

export const AccelerationComponent = RegisterComponent({
  id: 'acceleration',
  category: 'physics',
  priority: 1,
  dependencies: ['velocity', 'position'] as const,
})(
  S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
    // Accumulated forces
    forceAccumulator: S.optional(
      S.Struct({
        x: S.Number,
        y: S.Number,
        z: S.Number,
      }),
    ),
  }),
)

export type AccelerationComponent = S.Schema.Type<typeof AccelerationComponent>

// ===== MASS COMPONENT =====

export const MassComponent = RegisterComponent({
  id: 'mass',
  category: 'physics',
  priority: 1,
})(
  S.Struct({
    value: S.Number.pipe(S.positive()),
    // Inverse mass for performance (1/mass)
    inverseMass: S.Number,
    // Mass type classification
    type: S.Literal('static', 'kinematic', 'dynamic'),
    // Center of mass offset
    centerOfMass: S.optional(
      S.Struct({
        x: S.Number,
        y: S.Number,
        z: S.Number,
      }),
    ),
  }),
)

export type MassComponent = S.Schema.Type<typeof MassComponent>

// ===== COLLIDER COMPONENT =====

export const ColliderShape = S.Union(
  S.Struct({
    type: S.Literal('box'),
    halfExtents: S.Struct({
      x: S.Number.pipe(S.positive()),
      y: S.Number.pipe(S.positive()),
      z: S.Number.pipe(S.positive()),
    }),
  }),
  S.Struct({
    type: S.Literal('sphere'),
    radius: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('capsule'),
    radius: S.Number.pipe(S.positive()),
    height: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('mesh'),
    vertices: S.Array(S.Number),
    indices: S.Array(S.Number),
  }),
)

export const ColliderComponent = RegisterComponent({
  id: 'collider',
  category: 'physics',
  priority: 2,
  dependencies: ['position'] as const,
})(
  S.Struct({
    shape: ColliderShape,
    // Physics properties
    restitution: S.Number.pipe(S.between(0, 1)), // Bounciness
    friction: S.Number.pipe(S.between(0, 1)),
    density: S.optional(S.Number.pipe(S.positive())),
    // Collision filtering
    layer: S.Number.pipe(S.int(), S.between(0, 31)),
    mask: S.Number.pipe(S.int(), S.between(0, 0xffffffff)),
    // State
    isSensor: S.Boolean,
    isActive: S.Boolean,
    // Optimization flags
    isStatic: S.Boolean,
  }),
)

export type ColliderComponent = S.Schema.Type<typeof ColliderComponent>
export type ColliderShape = S.Schema.Type<typeof ColliderShape>
