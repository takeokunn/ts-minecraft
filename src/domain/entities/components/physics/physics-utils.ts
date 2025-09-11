/**
 * Physics Component Utilities and Constants
 *
 * Provides utility objects and type definitions for physics components
 */

import type { PositionComponent, VelocityComponent, AccelerationComponent, MassComponent, ColliderComponent } from '@domain/entities/components/physics/physics-components'

import {
  PositionComponent as PositionComponentSchema,
  VelocityComponent as VelocityComponentSchema,
  AccelerationComponent as AccelerationComponentSchema,
  MassComponent as MassComponentSchema,
  ColliderComponent as ColliderComponentSchema,
} from '@domain/entities/components/physics/physics-components'

// Aggregate all physics components for easy import
export const PhysicsComponents = {
  Position: PositionComponentSchema,
  Velocity: VelocityComponentSchema,
  Acceleration: AccelerationComponentSchema,
  Mass: MassComponentSchema,
  Collider: ColliderComponentSchema,
} as const

// Type union for any physics component
export type AnyPhysicsComponent = PositionComponent | VelocityComponent | AccelerationComponent | MassComponent | ColliderComponent

// Re-export for backward compatibility
export {
  PositionComponent as PositionComponentType,
  VelocityComponent as VelocityComponentType,
  AccelerationComponent as AccelerationComponentType,
  MassComponent as MassComponentType,
  ColliderComponent as ColliderComponentType,
}

// Type aliases for backward compatibility with existing code
export type Position = PositionComponent
export type Velocity = VelocityComponent
export type Acceleration = AccelerationComponent
export type Mass = MassComponent
export type Collider = ColliderComponent
