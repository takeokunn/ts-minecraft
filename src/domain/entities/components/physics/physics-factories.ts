/**
 * Physics Component Factory Functions
 * 
 * Provides factory functions for creating physics components with sensible defaults
 */

import * as Data from 'effect/Data'
import type { 
  PositionComponent,
  VelocityComponent,
  AccelerationComponent,
  MassComponent,
  ColliderComponent
} from './physics-components'

// Factory for efficient position creation
export const createPosition = (x: number, y: number, z: number): PositionComponent =>
  Data.struct({
    x,
    y,
    z,
    dirty: true,
    lastUpdated: Date.now(),
  })

export const createVelocity = (x: number = 0, y: number = 0, z: number = 0, options?: { damping?: number; maxMagnitude?: number }): VelocityComponent =>
  Data.struct({
    x,
    y,
    z,
    ...options,
  })

export const createAcceleration = (x: number = 0, y: number = 0, z: number = 0): AccelerationComponent =>
  Data.struct({
    x,
    y,
    z,
    forceAccumulator: { x: 0, y: 0, z: 0 },
  })

export const createMass = (value: number, type: 'static' | 'kinematic' | 'dynamic' = 'dynamic'): MassComponent =>
  Data.struct({
    value,
    inverseMass: type === 'static' ? 0 : 1 / value,
    type,
  })

export const createBoxCollider = (
  halfExtents: { x: number; y: number; z: number },
  options?: Partial<Pick<ColliderComponent, 'restitution' | 'friction' | 'layer' | 'mask'>>,
): ColliderComponent =>
  Data.struct({
    shape: { type: 'box' as const, halfExtents },
    restitution: options?.restitution ?? 0.3,
    friction: options?.friction ?? 0.5,
    layer: options?.layer ?? 0,
    mask: options?.mask ?? 0xffffffff,
    isSensor: false,
    isActive: true,
    isStatic: false,
  })

export const createSphereCollider = (radius: number, options?: Partial<Pick<ColliderComponent, 'restitution' | 'friction' | 'layer' | 'mask'>>): ColliderComponent =>
  Data.struct({
    shape: { type: 'sphere' as const, radius },
    restitution: options?.restitution ?? 0.3,
    friction: options?.friction ?? 0.5,
    layer: options?.layer ?? 0,
    mask: options?.mask ?? 0xffffffff,
    isSensor: false,
    isActive: true,
    isStatic: false,
  })

// Physics component factory functions
export const PhysicsComponentFactories = {
  createPosition,
  createVelocity,
  createAcceleration,
  createMass,
  createBoxCollider,
  createSphereCollider,
} as const