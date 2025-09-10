/**
 * Physics Components
 * Components related to physics simulation and movement
 */

export { PositionComponent, type PositionComponent as PositionComponentType } from './position'
export { VelocityComponent, type VelocityComponent as VelocityComponentType } from './velocity'
export { GravityComponent, type GravityComponent as GravityComponentType } from './gravity'
export { ColliderComponent, type ColliderComponent as ColliderComponentType } from './collider'

// Aggregate physics component schemas for registration
export const PhysicsComponentSchemas = {
  position: () => import('./position').then(m => m.PositionComponent),
  velocity: () => import('./velocity').then(m => m.VelocityComponent),
  gravity: () => import('./gravity').then(m => m.GravityComponent),
  collider: () => import('./collider').then(m => m.ColliderComponent),
} as const